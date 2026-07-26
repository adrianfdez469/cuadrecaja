# Performance Issues — Transacciones Prisma + Supabase Transaction Pooler

> Documento de diagnóstico y hoja de ruta. Generado tras una auditoría de los 24 sitios
> `prisma.$transaction` del proyecto. Pensado para que cualquier dev o LLM pueda retomar
> el trabajo sin contexto previo.

## 1. Contexto

**Cuadre de Caja** es un POS multi-tenant en Next.js 15 (App Router) + Prisma 6 + PostgreSQL,
desplegado en **Vercel** con base de datos en **Supabase**.

### Qué cambió y qué se rompió

Se cambió el `DATABASE_URL` de producción de una conexión directa al **Transaction Pooler**
de Supabase (pgbouncer, modo transaction):

```
postgresql://...@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

Desde entonces, al sincronizar (crear ventas + cargar inventario), muchos usuarios reciben:

```
Invalid `prisma.venta.create()` invocation:
Transaction API error: Transaction already closed: A query cannot be executed on an
expired transaction. The timeout for this transaction was 5000 ms, however 5056 ms
passed since the start of the transaction.
```

### Por qué ocurre (dos causas independientes)

El pooler **no es el culpable, es el mensajero**: expuso problemas latentes.

- **Latencia por query:** cada consulta ahora paga un salto de red extra vía pgbouncer.
  Transacciones con muchos round-trips secuenciales acumulan tiempo y superan el timeout
  interactivo por defecto de Prisma (`timeout: 5000ms`, `maxWait: 2000ms`), que **ningún**
  `$transaction` del proyecto sobreescribe (salvo una rama, ver P2).
- **`connection_limit=1`:** el pool de Prisma tiene una sola conexión. Si dentro de una
  transacción interactiva se ejecuta un query contra el cliente **global** `prisma` (en vez
  de `tx`), ese query pide una segunda conexión que no existe → contención/espera → se suma
  al reloj de la transacción → timeout. A esto lo llamamos **BUG A** en este documento.

### Referencias clave

- Prisma singleton (no configura timeouts): `src/lib/prisma.ts`
- Helper de descuentos que dispara el BUG A: `src/lib/discounts/index.ts` → `applyDiscountsForSale()`
  (importa `prisma` global en la línea 1; ejecuta 3 queries: `tienda.findUnique`,
  `discountRule.findMany`, `productoTienda.findMany`).
- Docs Prisma: opciones de `$transaction` → segundo argumento `{ maxWait, timeout, isolationLevel }`.

### Cómo verificar cualquier arreglo

No hay tests automatizados en el proyecto. Verificación manual:
1. `npm run lint` debe pasar.
2. Reproducir con una venta de ~10+ productos (incluyendo un producto fraccionable) contra
   una BD apuntada al transaction pooler; confirmar que ya no aparece el error de timeout.
3. Para importación/precios/moneda: ejecutar el flujo con un catálogo grande (100+ productos).
4. Revisar logs de Vercel para confirmar ausencia de `Transaction already closed`.

---

## 2. Problemas por prioridad

Cada problema indica: archivo, tipo (**BUG A** = query global dentro del tx / **RIESGO B** =
transacción pesada sin timeout), impacto y propuesta de solución.

### 🔴 P0 — Causa raíz confirmada del error que ven los usuarios (BUG A) — ✅ RESUELTO

> **Estado:** resuelto. En ambos endpoints se movió el fetch de productos, el merge, la
> validación de decimales y `applyDiscountsForSale()` **fuera** del `$transaction`; se batchearon
> `appliedDiscount` y los movimientos de VENTA con `createMany`; y se añadió
> `{ timeout: 20000, maxWait: 10000 }` al `$transaction`. Verificado con `eslint` + `tsc --noEmit`
> (0 errores). El BUG A queda eliminado (dentro del tx ya no se usa el cliente global `prisma`).

Dos endpoints de venta llamaban a `applyDiscountsForSale()` **dentro** del `$transaction`.
Ese helper usa el cliente `prisma` global → bajo `connection_limit=1` provoca contención de
conexión + 3 queries fuera de la transacción. Además ambos son transacciones pesadas
(`~6 + 3N` queries secuenciales para N productos, con loops de fraccionables) y sin timeout.

| # | Archivo | Línea del `applyDiscountsForSale` dentro del tx | Frecuencia |
|---|---------|------------------------------------------------|------------|
| P0.1 | `src/app/api/app/venta/[tiendaId]/[periodoId]/route.ts` | ~244 (tx en ~179) | Muy alta — app móvil, sync offline |
| P0.2 | `src/app/api/venta/[tiendaId]/[cierreId]/route.ts` | ~228 (tx en ~143) | Alta — venta web |

**Propuesta de solución:**
1. **Calcular los descuentos ANTES de abrir la transacción.** `applyDiscountsForSale` solo
   lee datos; no necesita estar dentro del tx. Mover la llamada arriba del `prisma.$transaction`
   y pasar el resultado ya calculado al callback. Elimina el BUG A de raíz.
   - Alternativa equivalente: refactorizar `applyDiscountsForSale` para aceptar un cliente
     opcional (`client: PrismaLike = prisma`) y pasarle `tx` — pero mover la lectura afuera es
     preferible porque además reduce el trabajo dentro de la transacción.
2. **Reducir round-trips dentro del tx:**
   - Eliminar el `findUnique` redundante del loop principal (ya se obtuvo `existencia` en el
     `findMany` inicial de `productosExistentes`).
   - Reemplazar los `movimientoStock.create` en loop por un solo `tx.movimientoStock.createMany`.
3. **Añadir opciones explícitas** al `$transaction`: `{ timeout: 20000, maxWait: 10000 }` como
   red de seguridad.

### 🔴 P1 — Transacciones con número de queries ILIMITADO por los datos (RIESGO B)

Estas no tienen BUG A, pero el tamaño de la transacción crece con el volumen de datos y no
tienen timeout configurado. Son detonantes claros del error en operaciones grandes.

| # | Archivo | Problema |
|---|---------|----------|
| P1.1 ✅ | `src/lib/movimiento/import.ts` (tx en ~430 y ~206) | **RESUELTO (fix dirigido).** Importación de inventario (Excel, lote real y grande): hasta 100 items × ~6 queries = cientos de round-trips secuenciales en un solo tx. Sin timeout. |
| P1.2 ✅ | `src/app/api/productos_tienda/[tiendaId]/route.ts` (tx en ~162) | **RESUELTO.** Guardar/conformar precios en lote: `prisma.$transaction(productos.map(...))` con array de tamaño ilimitado (puede ser todo el catálogo). Sin chunking ni timeout. |
| P1.3 ✅ | `src/app/api/negocio/[id]/cambiar-moneda-base/route.ts` (tx en ~175) | **RESUELTO (fix dirigido).** Recorre TODOS los `productoTienda` del negocio y hace `update` uno por uno + loop de gastos. Escala linealmente con el catálogo. |

> **P1.3 — Estado: resuelto (fix dirigido).** Operación rara de admin (cambiar la moneda base
> del negocio). **La atomicidad es obligatoria y NO se puede chunkear:** un fallo parcial dejaría
> parte del catálogo en la moneda nueva y parte en la vieja, y reintentar re-convertiría los ya
> convertidos (la conversión NO es idempotente, a diferencia de P1.2). Fix: se mantiene una sola
> transacción atómica con semántica idéntica (valores exactos, consistentes con el preview del GET)
> y se le añade `{ timeout: 60000, maxWait: 15000 }`. Se descartó el `UPDATE` masivo en SQL porque
> el redondeo `Math.round(x*100)/100` en float64 de JS no coincide con `ROUND(numeric)` de Postgres
> en casos de medio-centavo, y debe coincidir con el preview. Verificado con `eslint` + `tsc` (0 err).
>
> **Follow-up (solo si aparecen catálogos gigantes):** un `UPDATE ... FROM (VALUES ...)` con los
> valores ya redondeados en JS (un solo round-trip, atómico) o mover a un job en background. Hoy
> innecesario por la baja frecuencia de la operación.

> **P1.1 — Estado: resuelto (fix dirigido).** Caller real: `POST /api/movimiento/import`
> (importación de Excel) → `ImportarExcelMovimiento`. Es un lote grande genuino (inventario
> completo), a diferencia de P1.2. Cambios aplicados: (a) `{ timeout: 30000, maxWait: 10000 }`
> (`IMPORT_TX_OPTIONS`) en ambas transacciones —la del path chunked (`procesarChunk`) y la del
> path de lote pequeño ≤100 items—; (b) `CHUNK_SIZE` reducido de 50 a 25 para acotar la duración
> de cada transacción del path grande. Se mantiene `CHUNK_THRESHOLD=100` y la separación de paths
> para no cambiar la semántica de atomicidad de imports pequeños. Verificado con `eslint` +
> `tsc --noEmit` (0 errores).
>
> **Follow-up recomendado (no aplicado, requiere más pruebas):** unificar los dos paths sobre la
> lógica buena (`procesarLoteProductos`) siempre chunkeada, y batchear el pre-cargado de
> categorías/proveedores/productos existentes fuera del loop para reducir round-trips. Nota: hoy
> `procesarChunk` (path >100 items) **carece** del chequeo de `productoTienda` duplicado y del
> dedup de productos que sí tiene `procesarLoteProductos` — inconsistencia latente a corregir al
> unificar.

> **P1.2 — Estado: resuelto (endurecimiento defensivo).** Los updates se procesan en lotes
> secuenciales de 100 (`CHUNK_SIZE`), cada uno en su propia transacción de array. Los updates
> fijan valores absolutos (idempotentes), así que un fallo parcial se corrige reintentando la
> petición. Nota verificada en el código: la forma de array de `$transaction` **no** admite
> `{ timeout, maxWait }` (solo `{ isolationLevel }`); por eso la contención se ataca acotando
> el tamaño del lote, no con timeout. Verificado con `eslint` + `tsc --noEmit` (0 errores).
>
> **Corrección de severidad (rastreo de callers):** el riesgo de "array ilimitado" era
> **teórico**, deducido del contrato del endpoint, no de su uso real. El único consumidor del
> PUT es `costoPrecioServices.updateProductosTienda`, llamado desde 3 sitios de
> `useGestionInventario.ts` (editar producto / asignar producto a tienda), **siempre con un
> array de 1 elemento**. No existe hoy un caller masivo de "conformar precios". Por tanto NO era
> un problema en vivo; el chunking queda como red de seguridad por si aparece un caller en lote.

**Propuesta de solución (patrón común):**
- Añadir `{ timeout, maxWait }` explícitos y dimensionados a la operación.
- **Batching:** sustituir loops de `update`/`create` individuales por `updateMany`/`createMany`
  donde la lógica lo permita; cuando cada update es distinto, agrupar en chunks y/o usar
  `Promise.all` por lotes.
- Para import (P1.1): pre-cargar categorías/proveedores/productos existentes en batch **fuera**
  del loop; bajar `CHUNK_THRESHOLD`; considerar procesar por chunks más pequeños en
  transacciones separadas.
- Para precios (P1.2): chunkear el array de entrada (p. ej. lotes de 50-100) en varias
  transacciones, o mover a `updateMany` agrupando por valores iguales cuando aplique.

### 🟠 P2 — Transacciones pesadas acotadas, sin timeout (RIESGO B)

Muchos queries pero con cota conocida. Riesgo real bajo latencia del pooler en el peor caso.

| # | Archivo | Nota |
|---|---------|------|
| P2.1 ✅ | `src/lib/movimiento/index.ts` → `CreateMoviento` (tx en ~67) | **RESUELTO.** Loop por item con ~4-6 queries c/u. **Solo** la rama `esCompraEfectivoCaja` tenía `{ timeout: 15000, maxWait: 10000 }`; traspasos, mermas y ajustes corrían con el default de 5000ms. |
| P2.2 ✅ | `src/lib/onboarding/initializeNegocio.ts` (tx en ~59) | **RESUELTO.** Onboarding: ~90-100 queries en peor caso (hasta 19 tiendas + seed de catálogo demo). |
| P2.3 ✅ | `src/lib/negocio/deleteNegocioCompleto.ts` (tx en ~11) | **RESUELTO.** `deleteMany` masivos + loop de hasta 50; costo depende del volumen del negocio. |

> **P2.1 — Estado: resuelto.** Se extrajo `MOVIMIENTO_TX_OPTIONS = { timeout: 20000, maxWait: 10000 }`
> y se aplica a **todos** los tipos de movimiento (antes solo COMPRA+EFECTIVO_CAJA tenía timeout; el
> resto usaba el default de 5000 ms). El valor 20000 ≥ 15000 del caso anterior, así que no reduce el
> presupuesto de la rama con lock de caja. No se batcheó el loop: es demasiado sensible (CPP,
> fraccionados, advisory lock por tienda) para hacerlo sin tests. Verificado con `eslint` + `tsc` (0 err).

> **P2.2 — Estado: resuelto.** Se añadió `{ timeout: 30000, maxWait: 10000 }` a la transacción de
> onboarding. Se mantiene una sola transacción atómica (crear negocio + tiendas + usuario + roles +
> catálogo demo es todo-o-nada); no se chunkea. Verificado con `eslint` + `tsc` (0 err).
>
> **P2.3 — Estado: resuelto.** Se añadió `{ timeout: 60000, maxWait: 15000 }` a la transacción de
> borrado (timeout más alto porque los `deleteMany` sobre `venta`/`movimientoStock` de negocios con
> historial pueden ser lentos). Atómico por diseño; no se chunkea. Verificado con `eslint` + `tsc` (0 err).

**Propuesta de solución:**
- P2.1: extender el `{ timeout, maxWait }` a **todas** las ramas de `CreateMoviento`, no solo
  compra-efectivo-caja. Considerar batching del loop.
- P2.2 / P2.3: añadir `{ timeout, maxWait }` explícitos; batchear los loops de `create`/`delete`
  con `createMany`/`deleteMany` donde sea posible.

### 🟢 P3 — Bajo riesgo (2-8 queries sobre registros únicos)

Heredan el default de 5000ms pero es improbable que lo superen. Se listan para completitud;
se recomienda añadir `{ timeout, maxWait }` solo como higiene general, sin urgencia:

- `src/app/api/movimiento/rechazo/route.ts` (~29)
- `src/app/api/cierre/[tiendaId]/[cierreId]/close/route.ts` (~204) — reads pesados ya están fuera del tx (buen patrón)
- `src/app/api/gastos/cierre/[cierreId]/apply/route.ts` (~73)
- `src/app/api/cierre/[tiendaId]/open/route.ts` (~21) y `src/app/api/app/periodo/[tiendaId]/abrir/route.ts` (~36)
- `src/lib/referrals/firstPayment.ts` (~21), `liquidateReferral.ts` (~12), `cancelUnpaidReferral.ts` (~87)
- `src/app/api/promoters/activate/route.ts` (~38), `self-enroll/route.ts` (~51), `magic-link/consume/route.ts` (~54)
- `src/app/api/discounts/route.ts` (~192) y `src/app/api/usuarios/[id]/route.ts` (~89) — forma de array (batch), sin callback, **sin** BUG A posible
- `src/app/api/app/venta/[tiendaId]/[periodoId]/[ventaId]/route.ts` (~131) y `src/app/api/venta/[tiendaId]/[cierreId]/[ventaId]/route.ts` (~108) — cancelaciones, forma de array (`2M+3` sentencias)
- `src/app/api/venta/[tiendaId]/[cierreId]/[ventaId]/producto/[ventaProductoId]/route.ts` (~129)

### ⚪ P4 — Configuración y hallazgos colaterales

- **`connection_limit`:** con el transaction pooler se puede subir (p. ej. `connection_limit=3`)
  para tolerar mejor la concurrencia. En serverless muchas instancias multiplican conexiones,
  por eso a veces se deja en 1; una vez resuelto el BUG A (P0), dejarlo bajo es seguro. Evaluar
  según los límites del plan de Supabase.
- **`DIRECT_URL`:** verificar que siga apuntando a la conexión **directa** (puerto 5432, sin
  pgbouncer). El pooler en modo transaction rompe `prisma migrate`.
- **Hueco de atomicidad (no relacionado al pooler):** en
  `src/app/api/usuarios/[id]/route.ts` (~78-79), la rama `PENDIENTE_VERIFICACION` hace
  `deleteMany` + `delete` **sin** transacción. Envolver en `$transaction` (forma de array).

---

## 3. Notas de implementación (patrones reutilizables)

- **Firma de opciones de transacción:**
  ```ts
  await prisma.$transaction(async (tx) => { /* ... */ }, {
    maxWait: 10000,  // ms para adquirir conexión del pool
    timeout: 20000,  // ms máx que la transacción puede correr
  });
  ```
- **Regla de oro:** dentro de un `$transaction(async (tx) => ...)` **nunca** usar el `prisma`
  global ni un helper que lo use internamente. Los helpers que hagan queries deben aceptar y
  usar el cliente transaccional (el proyecto ya tiene ejemplos bien hechos:
  `calcularEfectivoDisponiblePorMoneda`, `getCategoryId`, `generateUniquePromoCode`,
  `seedDemoCatalogForTienda` — todos aceptan `tx`/`client`).
- **Preferir lecturas fuera del tx:** todo lo que solo lee y no necesita el snapshot
  transaccional debe ejecutarse antes de abrir la transacción (patrón ya usado correctamente en
  `cierre/.../close/route.ts`).

## 4. Orden sugerido de ejecución

1. **P0** (los 2 endpoints de venta) — resuelve el error que golpea a los usuarios ahora.
2. **P1** (import, precios, cambio de moneda) — evita timeouts en operaciones masivas.
3. **P2** (CreateMoviento, onboarding, delete negocio).
4. **P4** (config + hueco de atomicidad).
5. **P3** solo como higiene, cuando haya tiempo.
