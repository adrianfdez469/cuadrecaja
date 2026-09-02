# ADR 0006: `Negocio.qabToken` invisible por defecto, con el `omit` global de Prisma

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

`Negocio.qabToken` es el secreto de la integración: **un token por negocio, acuñado por
queandabuscando y visible una sola vez**. Con él se puede publicar catálogo, precios y disponibilidad
de ese negocio y leer todos sus pedidos —con nombre, teléfono y dirección de sus compradores—. No
hay rotación automática: si se filtra, se filtra hasta que alguien lo note.

El criterio 6 de F-001 lo dice sin rodeos: *`Negocio.qabToken` no aparece en ninguna respuesta de
API*.

Y el estado de partida es que **ese criterio falla solo con crear la columna**. Las rutas de negocio
devuelven la fila entera:

- `GET /api/negocio` → `prisma.negocio.findMany({ where, orderBy })`, **sin `select`**, y
  `NextResponse.json(negocios)`.
- `POST /api/negocio` → devuelve la fila que crea.
- `PUT /api/negocio/[id]` → devuelve la fila que actualiza.

Ninguna de las tres nombra un solo campo: heredan automáticamente cualquier columna que se añada al
modelo. El día que exista `qabToken`, las tres lo publican, y ninguna prueba ni ningún tipo se queja.

Hay un precedente bueno en el repositorio que conviene no perder: `negocioParaToken` en
`src/utils/authOptions.ts` es una **lista blanca explícita** de nueve campos, así que el JWT y la
sesión —que llegan al navegador de cada usuario— nunca arrastrarán el token. Ese patrón es el
correcto; el problema es que no está aplicado en las rutas.

## Decisión

**El token se hace invisible en el cliente de Prisma, no ruta por ruta.** En `src/lib/prisma.ts`:

```ts
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Server-only secret: invisible to every query unless a caller opts in explicitly.
    omit: { negocio: { qabToken: true } },
  });
```

A partir de ahí, `qabToken` no sale de **ninguna** consulta —las de hoy y las que se escriban dentro
de dos años— salvo que quien la escriba pida el campo a propósito con `omit: { qabToken: false }`.
El descuido deja de ser el camino por defecto: hay que teclear algo para filtrarlo.

Comprobado ejecutando contra `prisma@6.5.0`, la versión fijada en `package.json`: `omit` es GA, no
requiere `previewFeatures`, la consulta normal devuelve la fila sin el campo y el opt-in explícito
lo recupera.

Consecuencias operativas que forman parte de la decisión:

- **Las tres rutas de `negocio` no se tocan.** Su forma de respuesta no cambia y no hay riesgo de
  romper la pantalla de superadmin al recortar campos a mano.
- **El opt-in explícito es el único punto que hay que auditar.** F-003 —que guarda el token— y F-002
  —que lo usa para autenticarse contra QAB— serán las únicas líneas del repositorio con
  `omit: { qabToken: false }`, y ninguna de las dos puede devolver ese valor en una respuesta.
- **`negocioParaToken` se deja como está**: no se le añade `qabToken` jamás.
- La verificación es un `grep -rn "qabToken" src/`: fuera de `src/schemas/` y de esa línea de
  `src/lib/prisma.ts`, no debe haber apariciones al cerrar F-001.
- Ningún schema de `src/schemas/` contiene la clave `qabToken`. Lo que F-003 muestra es
  `negocioQabSettingsSchema`, con un `qabTokenConfigurado: boolean` derivado en el servidor.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Añadir un `select` explícito en cada ruta que devuelve un `Negocio` | Funciona hoy y se rompe mañana: protege exactamente las rutas que alguien se acordó de tocar. La siguiente ruta que haga `findMany` sin `select` vuelve a filtrarlo, y nadie se entera. |
| Una constante `NEGOCIO_SAFE_SELECT` reutilizada en todas esas rutas | Mejor que la anterior porque centraliza la lista, pero sigue dependiendo de que cada autor se acuerde de usarla. La protección sigue siendo opt-in. |
| Sacar el token a una tabla aparte (`NegocioQabCredencial`) | Es la opción más robusta de todas —lo que no está en la tabla no se puede seleccionar por descuido— pero añade una tabla y un `join` a un feature cuyo criterio 1 es «no reescribir nada», y el `omit` global cubre el mismo riesgo. Queda anotada por si el token gana hermanos (refresh, scopes, caducidad): entonces sí merece su tabla. |
| Cifrar el token en reposo y guardarlo cifrado | Es **ortogonal**, no una alternativa: protege un volcado de la base, no una respuesta HTTP. Si `security-guardian` lo exige, cambia el contenido de la columna, no su tipo, y se resuelve en F-003 sin migración ni cambios en este contrato. |
| Un middleware que filtre la clave de las respuestas JSON | Filtra por nombre en la salida: frágil ante anidamientos, renombrados y respuestas que no son JSON plano, y deja el valor circulando por el servidor hasta el último momento. |

## Consecuencias

**A favor:**
- El criterio 6 se cumple para todo el código presente **y futuro**, no solo para las tres rutas que
  hoy conocemos.
- La opción segura es la que no requiere hacer nada; exponer el token requiere un acto deliberado y
  visible en una revisión.
- Cero cambios en la forma de las respuestas existentes: no se rompe ninguna pantalla.

**En contra / coste asumido:**
- Es un comportamiento **implícito y global**: quien lea una ruta de negocio no ve por qué el token
  no está ahí. Hay que buscarlo en `src/lib/prisma.ts`, y ese es el precio de que sea automático.
- Si alguien creara un segundo `PrismaClient` en cualquier parte, ese cliente no llevaría el `omit`.
  El repositorio tiene un singleton y hay que mantenerlo así.
- La protección vive en el cliente de Prisma: no alcanza a `$queryRaw` ni al SQL escrito a mano.

**Impacto en seguridad y escalabilidad:**
- Reduce la superficie de fuga de «cualquier consulta a `Negocio`» a «las dos líneas que piden el
  campo explícitamente».
- El token es **por negocio**: una fuga no compromete a todos los tenants a la vez, pero sí expone
  el catálogo completo y los datos personales de los compradores del negocio afectado. De ahí que
  la defensa sea por defecto y no por convención.
- Sin coste de rendimiento: `omit` se traduce en columnas menos en el `SELECT`.
