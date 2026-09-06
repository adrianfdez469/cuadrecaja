# ADR 0078: F-021 añade alcance, no permisos — y la regla del permiso heredado

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

El método de triaje del spec exige **tres cosas** para dar una ruta por protegida: identidad,
permiso y alcance por `negocioId`. De los 39 verbos desprotegidos, muchos no tienen ninguna de las
tres; la tentación natural es añadir las tres de golpe.

Añadir un permiso, sin embargo, **cambia quién puede usar una pantalla**, y este repositorio ya
aprendió lo que cuesta: el docstring de `assertNegocioConfigReadAccess`
(`src/lib/negocioConfigAccess.ts`) deja escrito que exigir el permiso de configuración avanzada en la
lectura de monedas y tasas **dejó al vendedor sin multimoneda en la pantalla de venta**, con un 403
silenciado dentro de `loadMonedas`. Ese es el motivo por el que `assertNegocioAccess` resuelve dos de
tres y no las tres.

El spec pregunta explícitamente si `GET /api/transfer-destinations` debe exigir el mismo permiso que
su `POST` (`configuracion.destinostransferencia.acceder`). Los hechos, leídos del código:

- El `POST` lo exige (`src/app/api/transfer-destinations/route.ts:38`).
- El `GET` lo consume el **POS**, en el arranque, para todo cajero:
  `fetchTransferDestinations(user.localActual.id)` en `src/app/pos/page.tsx:1391`, dentro del mismo
  `Promise.all` que `fetchLastPeriod` (`:1392`), y con un `catch` (`:1403`) que degrada el arranque.
- `configuracion.destinostransferencia.acceder` está **solo** en la plantilla `administrador`
  (`src/constants/permisos/permisos.templates.ts`). El vendedor no lo tiene.

Es decir: exigir en el `GET` el permiso del `POST` rompe el POS del vendedor. Exactamente el mismo
fallo que ya está documentado en `negocioConfigAccess.ts`, repetido.

Y hay un problema de método además del de riesgo: si una tanda añade a la vez el filtro por tenant y
un permiso nuevo, y el POS se rompe, **no se puede saber cuál de los dos lo rompió**. El criterio 5
se vuelve inverificable.

## Decisión

**F-021 añade el eje de tenant. No añade permisos nuevos.** Formulado como regla aplicable sin
juicio caso por caso:

> Un verbo corregido recibe `permisoRequerido: null` salvo que **ya** exigiera un permiso antes de
> este feature, en cuyo caso conserva **exactamente el mismo**.

Consecuencias directas, verbo a verbo:

- `GET /api/transfer-destinations` → `null`. Motivo escrito en el inventario: lo llama el POS de todo
  cajero en el arranque; el permiso del `POST` solo lo tiene `administrador`.
- `GET /api/cierre/[tiendaId]/last` → `null`. Misma llamada de arranque del POS
  (`src/app/pos/page.tsx:1392`).
- `POST`/`PUT` de `productos_tienda/[tiendaId]` → conservan `operaciones.inventario.acceder`, que ya
  comprobaban.
- `PUT /api/locales/[id]` → conserva `configuracion.locales.acceder`.
- `PUT /api/proveedores-consignadores/cierre/[cierreId]/[proveedorId]` → conserva
  `configuracion.proveedores.liquidar`.
- `DELETE /api/app/venta/.../[ventaId]` → conserva **el par exacto que ya exige**, con su disyunción:
  `operaciones.pos-venta.cancelarventa` **o** `operaciones.ventas.eliminar`. Como
  `decideTenantScope` recibe un permiso y no dos, el handler la evalúa con
  `verificarPermisosUsuario` (plural, `requiereTodos: false`) y luego pasa `permisoRequerido: null`.
  Nunca reescribiendo la disyunción en otro sitio: es la lección de E-014 y de E-039.
- `POST /api/app/descuentos/preview` → `null`. Comprobado: el archivo **no contiene ninguna llamada a
  `verificarPermiso*`**. Existe `configuracion.descuentos.preview` en las plantillas `vendedor` y
  `administrador`, pero ponerlo aquí sería un permiso nuevo para este verbo, y la regla lo prohíbe.
- El resto → `null`.

Cada `null` **se justifica por escrito en el inventario**, en una línea, igual que los tres
llamadores de `assertNegocioAccess` justifican el suyo en el código. Un `null` sin motivo escrito no
es una clasificación válida: el criterio 8 del spec lo comprueba leyendo esa columna.

Dos precisiones que **sí** entran, porque son eje de tenant y no permiso:

- **Un id de tenant que llega en el cuerpo no es un eje.** `POST /api/movimiento/import` toma hoy
  `data.negocioId`, `data.localId` y `data.usuarioId` del cuerpo y valida el `localId` contra el
  `negocioId` **del propio cuerpo** (`src/lib/movimiento/import.ts:400-422`), con lo que no aísla
  nada. Pasa a rechazarse cuando `data.negocioId` no coincide con el de la sesión.
- **Un actor que llega en el cuerpo se valida contra el tenant.** `POST /api/venta/[tiendaId]/[cierreId]`
  atribuye la venta al `usuarioId` del cuerpo sin contrastarlo con nada. Pasa a exigirse que ese
  `Usuario` sea del negocio de la sesión. **No** se exige que sea el propio usuario de la sesión: la
  sincronización offline puede reproducir la venta de otro cajero del mismo local.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Que el `GET` de `transfer-destinations` exija el permiso de su `POST` | Rompe el POS de todo vendedor. Es el fallo ya documentado en `negocioConfigAccess.ts`, repetido |
| Inventar un permiso de lectura nuevo (`...destinostransferencia.ver`) | Un permiso nuevo hay que darlo: nace vacío en todos los roles existentes y rompe el POS hasta que alguien lo asigne uno a uno. Y `permisos.json` es la fuente de las pantallas de roles, así que arrastra UI — y este feature no toca UI |
| Añadir a cada verbo el permiso «que le tocaría» por su módulo | Es rediseñar el modelo de permisos de 39 rutas dentro de un feature de aislamiento. Cambia pantallas, y hace el criterio 5 inverificable: ante una regresión del POS no se sabría qué de los dos cambios la causó |
| Exigir que el `usuarioId` de `venta POST` sea el de la sesión | Puede romper la reproducción de ventas offline (`syncId`, `wasOffline`), que no se puede comprobar sin dispositivo. Acotarlo al negocio cierra la fuga sin tocar ese flujo |

## Consecuencias

**A favor:**
- Ninguna pantalla cambia de audiencia. El criterio 5 pasa a ser una comprobación de que **nada**
  cambió para el usuario legítimo, que es fácil de recorrer y fácil de creer.
- El feature queda de una sola pieza: todo lo que introduce es el eje de tenant. Si algo se rompe,
  solo hay un sospechoso.
- Toda ruta corregida queda **estrictamente más protegida** que antes: nunca menos.

**En contra / coste asumido (dicho sin adornos):**
- Al cerrar F-021 seguirá habiendo verbos que **escriben** sin exigir permiso —`venta POST`,
  `cierre/open PUT`, `movimiento/rechazo POST`, `cpp/migrate POST`, y en la APK
  `app/venta POST` y `app/periodo/abrir POST`—, protegidos por tenant pero no por rol. Un vendedor
  del negocio A podrá seguir haciendo, dentro de **su** negocio, cosas que su rol quizá no debería
  permitir.
- Es **deuda asumida a propósito**, y el inventario la deja visible: esos verbos quedan marcados
  `permiso: null (deuda F-021)`, distinguidos de los `null (justificado)`. Cerrarlas es un feature
  aparte, con su propio criterio 5 y su propio recorrido de pantallas.

**Impacto en seguridad y escalabilidad:**
- El vector grave —leer o escribir datos de **otro negocio**— queda cerrado en los 39 verbos. El
  residual es intra-negocio, con actores autenticados, identificados y auditables por
  `MovimientoStock.usuarioId`: un orden de magnitud menos grave que una fuga entre tenants, que
  `AGENTS.md` llama el fallo más grave posible.
- Sin impacto en consultas: no se añade ninguna lectura de permisos, que ya viajan en la sesión.
