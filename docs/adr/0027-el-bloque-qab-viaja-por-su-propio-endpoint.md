# ADR 0027: El bloque QAB no entra en `GET /api/negocio` — viaja por su propio endpoint de lista

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md) ·
[ADR 0024](0024-derivar-qabtokenconfigurado-sin-leer-el-token.md)

## Contexto

`/configuracion/negocios` lista **todos** los negocios de la plataforma y ahora tiene que mostrar,
por cada uno, el interruptor de tienda online, si tiene token y de cuándo es. Los nombres ya los
trae `getNegocios()`. Faltan tres campos por fila.

Las dos formas obvias tienen cada una un problema:

- **Meterlos en `GET /api/negocio`** significa ampliar `NEGOCIO_ADMIN_SELECT` y
  `negocioAdminViewSchema`, que el ADR 0019 fijó hace un día con once campos exactos y `.strict()`,
  como respuesta a que esas rutas devolvían la fila entera. Y hay un obstáculo de forma:
  `qabTokenConfigurado` **no es una columna**, es un derivado que el ADR 0024 calcula con una
  segunda consulta. La respuesta dejaría de ser lo que `select` devuelve y pasaría a ser un objeto
  compuesto, que es justo lo que la lista blanca del ADR 0019 existe para evitar.
- **Un `GET /api/negocio/[id]/qab` por fila** es un N+1 sobre HTTP: una pantalla con cuarenta
  negocios haría cuarenta peticiones, cada una con su verificación de sesión y sus dos consultas.

## Decisión

**Un endpoint de lista propio, `GET /api/negocio/qab`, que devuelve el bloque QAB de todos los
negocios en una sola petición, y ningún `GET` por negocio.**

```jsonc
{
  "autoProvisioningAvailable": false,
  "autoProvisioningUnavailableReason": "SECRET_NOT_SET",
  "negocios": [
    { "negocioId": "…", "tiendaOnlineHabilitada": true,
      "qabTokenConfigurado": true, "qabTokenActualizadoAt": "2026-09-03T…" }
  ]
}
```

Tres cosas que forman parte de la decisión:

1. **`GET /api/negocio` y `PUT /api/negocio/[id]` no se tocan.** `NEGOCIO_ADMIN_SELECT` y
   `negocioAdminViewSchema` siguen exactamente como los dejó el ADR 0019. Un feature que empieza a
   guardar un secreto real no es el sitio para ensanchar la lista blanca que protege esas rutas.

2. **No hay `GET /api/negocio/[id]/qab`.** Cada mutación —el interruptor, el alta, el token
   pegado— devuelve el bloque ya actualizado, así que la pantalla nunca necesita releer una fila
   suelta. Es una decisión de superficie, no de comodidad: el criterio 14 se verifica *"recorriendo
   con curl todas las rutas de `/api/` que leen `Negocio`"*, y cada ruta de lectura que no exista
   es una menos que auditar hoy y para siempre.

3. **`autoProvisioningAvailable` va en la raíz de la respuesta, no por negocio.** Depende de dos
   variables de entorno (`QAB_PROVISIONING_SECRET` y `QAB_API_BASE_URL`), que son de despliegue y
   no de negocio — la misma asimetría que ya razonó el ADR 0014. El cliente no puede leerlas, así
   que el criterio 9 («la acción de alta no se ofrece») necesita que el servidor lo diga.
   `autoProvisioningUnavailableReason` es un enum cerrado de cuatro valores: dice **por qué** no se
   ofrece sin publicar ningún valor de configuración, para que una configuración a medias no se
   confunda con «esto todavía no está cableado».

`src/app/api/negocio/qab/` convive con `src/app/api/negocio/[id]/` igual que ya lo hace
`src/app/api/negocio/stats/`: el segmento estático gana al dinámico. Los `Negocio.id` son UUID, así
que ninguno puede llamarse `qab`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ampliar `NEGOCIO_ADMIN_SELECT` y `negocioAdminViewSchema` | Deshace parte del ADR 0019 un día después de escribirlo, y obliga a que una respuesta hasta ahora idéntica a un `select` pase a ser un objeto compuesto con un derivado dentro |
| Un `GET` por negocio | N+1 sobre HTTP, con verificación de sesión y dos consultas por fila. Y añade una ruta de lectura de `Negocio` al recorrido del criterio 14 |
| Un parámetro `?incluirQab=1` en `GET /api/negocio` | Una ruta con dos formas de respuesta, y un schema que ya no puede ser `.strict()` sobre una sola forma. El ADR 0019 fijó esa respuesta precisamente para que no tuviera variantes |
| Cargar el bloque desde un Server Component | La página es cliente y tiene que seguir siéndolo para el interruptor y los diálogos; además E-007 recuerda que un Server Component no puede pedirle a su propia API, y leer por `src/lib/` metería `Negocio` en el árbol de RSC justo en el feature que quiere el token lejos del HTML |
| `autoProvisioningAvailable` repetido en cada fila | Es el mismo valor en todas: información de despliegue disfrazada de dato de negocio |
| Exponer directamente si las variables están definidas | Publica el estado de la configuración del servidor con más detalle del necesario. Un enum cerrado dice lo mismo que la pantalla necesita y nada más |

## Consecuencias

**A favor:**
- Una petición para toda la pantalla, sin N+1 y sin tocar la ruta que el ADR 0019 acaba de cerrar.
- El inventario del criterio 14 crece en **una** ruta de lectura de `Negocio`, no en dos ni en
  cuarenta llamadas.
- El bloque QAB evoluciona sin arrastrar el schema de administración de negocios, y al revés.
- El criterio 9 se puede verificar desde el navegador —el botón no está— y con `curl` sobre la
  lista, sin leer código.

**En contra / coste asumido:**
- La pantalla hace **dos** peticiones (`GET /api/negocio` y `GET /api/negocio/qab`) y tiene que
  cruzarlas por `negocioId`. Se lanzan en paralelo; el cruce es un `Map`.
- Dos fuentes para una misma tabla pueden desincronizarse si una falla. La pantalla trata la
  ausencia del bloque QAB como «desconocido», nunca como «apagado» o «sin token» — eso último sería
  un dato inventado sobre un secreto.
- Un endpoint más que mantener.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento:** la ruta exige `SUPER_ADMIN` y responde 403 si no (ADR 0019). No hay lectura por
  negocio que un `ADMIN` pueda alcanzar con el UUID de otro, porque esa ruta no existe.
- Ninguna de las dos consultas de la lista lee el `qabToken` (ADR 0024), así que la ruta que
  devuelve **todos** los negocios no trae ni un secreto a memoria.
- Escalabilidad: dos proyecciones estrechas sobre `Negocio`, la tabla más pequeña del sistema, en
  una pantalla de superadministrador. Si algún día tuviera cientos de filas, la paginación se
  añadiría a la vez en las dos rutas — hoy `GET /api/negocio` tampoco pagina, y adelantarlo aquí
  dejaría las dos mitades de la tabla desalineadas.
- Reversión: borrar una ruta y un servicio. Nada persistido.
