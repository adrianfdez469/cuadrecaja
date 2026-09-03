# ADR 0019: `select` explícito en las rutas de `Negocio`, y `GET /api/negocio` pasa a exigir `SUPER_ADMIN` con 403

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-018
**Se apoya en:** [ADR 0013](0013-lectura-del-qabtoken-con-select-explicito.md) ·
[ADR 0006](0006-qabtoken-invisible-por-defecto.md)

## Contexto

`GET /api/negocio` hace `prisma.negocio.findMany({ where, orderBy })` y devuelve la fila entera de
**todos los negocios de la plataforma**, sin comprobar nada. `PUT /api/negocio/[id]` devuelve
también la fila entera de `prisma.negocio.update`. Ninguna de las dos nombra un solo campo: heredan
automáticamente cualquier columna que se añada al modelo.

El ADR 0006 ya vio venir esto y lo tapó por abajo con un `omit` global de `qabToken` en el cliente
de Prisma. Ese `omit` sigue vigente y sigue siendo correcto, pero es una defensa sobre **una**
columna. `Negocio` ya tiene otras que no pintan nada en una respuesta HTTP —`qabUltimoPedidoVisto`,
`qabTokenActualizadoAt`, `avisoPurgeEnviadoAt`— y tendrá más. Los criterios 2 y 7 de F-018 piden
justo lo que el ADR 0006 descartó en su momento como insuficiente por sí solo: `select` explícito.
No se contradicen: el `omit` es el suelo, el `select` es el techo.

Y hay una segunda pregunta, que los criterios rozan sin resolver. El criterio 1 pide 401 **sin
cookie**. El criterio 2 habla de "autenticado como `SUPER_ADMIN`". Entre las dos queda un hueco:
¿qué recibe un `VENDEDOR` autenticado que llame a `GET /api/negocio`? Con solo la puerta del
[ADR 0016](0016-la-puerta-de-api-valida-solo-la-cookie-de-nextauth.md), recibe **la lista completa
de todos los tenants de la plataforma**. Es exactamente la fuga entre negocios que F-018 existe
para cerrar, movida un escalón: de anónimo a "cualquiera con cuenta".

El dato que decide la forma de cerrarlo está en `src/lib/axiosClient.ts`: su interceptor responde a
**cualquier** 401 con `signOut({ callbackUrl: "/login" })`. Un 401 no muestra un error: echa al
usuario de la aplicación.

Los tres consumidores de `getNegocios()` en el repositorio son superficies de superadministrador:
`src/components/Layout.tsx` (dentro de `user.rol === "SUPER_ADMIN"`),
`src/app/configuracion/negocios/page.tsx` y `src/app/configuracion/suspensiones/page.tsx`.

## Decisión

**Tres cosas, y la tercera es la que va más allá de la letra del spec.**

1. **`GET /api/negocio` y `PUT /api/negocio/[id]` responden con un `select` explícito**, la
   constante `NEGOCIO_ADMIN_SELECT` de `src/lib/negocio/negocioSelect.ts`, con once campos:
   `id`, `nombre`, `descripcion`, `createdAt`, `limitTime`, `planId`, `suspended`, `suspendedAt`,
   `creadoPorActivacionLanding`, `monedaBase`, `monedaFuerte`. Cualquier columna que se añada a
   `Negocio` a partir de hoy es invisible en esas respuestas hasta que alguien la ponga en la lista
   a propósito.
2. **Nunca se combina ese `select` con `omit`.** Prisma rechaza las dos claves en la misma consulta
   (*"Please either use `omit` or `select`, but not both at the same time"*) y un `select`
   explícito ya vence al `omit` global por sí solo. Es la lección del ADR 0013, verificada
   ejecutando en F-002.
3. **`GET /api/negocio` pasa a exigir `hasSuperAdminPrivileges()` y responde `403` si no.** No 401:
   un 401 cerraría la sesión de quien lo reciba, y quien lo reciba es un usuario legítimo al que
   solo le falta el rol. 401 significa "no hay sesión"; 403 significa "hay sesión y no te toca".

`POST /api/negocio` **no se toca**: está fuera del alcance del spec, su valor de retorno lo ignora
el único llamante, y el `omit` global del ADR 0006 sigue cubriendo la única columna secreta. Un
feature que reescribe el middleware no es el sitio para diffs de más.

La forma de la respuesta queda fijada además por un schema Zod `.strict()`,
`negocioAdminViewSchema` en `src/schemas/negocio.ts`, del que se deriva `INegocioAdminView`. Ese
`.strict()` es lo que convierte el criterio 2 en una prueba de una línea: se añade una columna a
`Negocio`, se parsea la respuesta y el schema falla si aparece sola.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejarlo en el `omit` global del ADR 0006 | Protege una columna. Los criterios 2 y 7 piden que la respuesta sea una lista blanca, no una lista negra de un elemento. |
| `select` + `omit: { qabToken: false }`, como sugería la redacción original del ADR 0006 | Prisma lo rechaza en tiempo de ejecución. Verificado en F-002; ver ADR 0013. |
| Devolver `INegocio` (el tipo que ya existe) en vez de un tipo nuevo | `INegocio` es la forma del negocio **dentro de la sesión**: incluye `locallimit`, `userlimit` y `productlimit`, que no son columnas de `Negocio` sino límites derivados del `Plan`. La API nunca los ha devuelto: el tipo actual del servicio es una mentira que nadie había notado. Son dos formas distintas y merecen dos tipos distintos. |
| Dejar `GET /api/negocio` abierto a cualquier usuario autenticado, como dice la letra del spec | Cumple los 10 criterios y deja en pie una enumeración de todos los tenants para cualquiera con cuenta. El feature nació de un hallazgo de `security-guardian` sobre exactamente esta ruta; cerrarla a medias sería cerrarla dos veces. |
| Responder 401 al no-superadmin | Lo echaría de la aplicación por el interceptor de axios. El código correcto para "autenticado pero sin derecho" es 403, y es además el que ya usan `POST /api/negocio` y `PUT /api/negocio/[id]`. |
| Una constante `NEGOCIO_SAFE_SELECT` reutilizada en todas las rutas que devuelven un `Negocio` | Es a lo que tiende esto, y `NEGOCIO_ADMIN_SELECT` es su primer paso. No se generaliza hoy porque cada ruta tiene una audiencia distinta y una lista blanca compartida acabaría siendo la unión de todas ellas: la más ancha gana, que es justo lo que se quiere evitar. |

## Consecuencias

**A favor:**
- Añadir una columna a `Negocio` deja de ser una decisión de publicación. Hay que teclear el
  nombre del campo para que salga.
- La enumeración de tenants queda cerrada a nivel de rol, no solo de sesión.
- El `.strict()` del schema convierte el criterio 2 en un test, no en una inspección visual.

**En contra / coste asumido:**
- **El tipo de retorno del servicio cambia** (`INegocio[]` → `INegocioAdminView[]`), y con él los
  tres consumidores. Es un renombrado mecánico que `npx tsc --noEmit` verifica entero; no hay
  ningún `any` ni ningún cast que lo tape.
- Si mañana una pantalla necesita un campo que no está en los once, hay que añadirlo a la
  constante y al schema. Es el coste de la lista blanca y es el que se quiere pagar.
- `POST /api/negocio` sigue devolviendo la fila entera. Queda anotado como deuda consciente:
  cuando alguien lo toque, que aplique `NEGOCIO_ADMIN_SELECT`.

**Impacto en seguridad y escalabilidad:**
- Aislamiento multi-tenant: `GET /api/negocio` es, por definición, la ruta que **cruza** tenants —
  es la vista de plataforma del superadministrador—. Por eso su control no es un filtro por
  `negocioId` sino un chequeo de rol: el `negocioId` del llamante es irrelevante ahí, y esa es
  precisamente la razón por la que no puede quedar abierta a cualquier sesión.
- `PUT /api/negocio/[id]` conserva su `hasSuperAdminPrivileges()`; el `select` solo recorta lo que
  devuelve.
- Sin coste de rendimiento: un `select` estrecho trae menos columnas que la fila entera.
