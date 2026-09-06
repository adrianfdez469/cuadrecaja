# ADR 0071: El inventario baja al `CONFIRMED` con un movimiento propio, y la `Venta` del `DELIVERED` no vuelve a descontar

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-014

> Este es el ADR del **criterio de aceptación 1** de F-014: fija el momento del descuento de stock
> y el de la generación de la `Venta`, con las alternativas descartadas. Los ADR 0072 y 0073 lo
> acompañan: el 0072 modela **cómo se identifica** cada efecto, el 0073 la **forma de pago** y la
> guarda previa. Ninguno de los dos reabre lo que se decide aquí.

## Contexto

F-012 dejó al encargado cambiar el `status` de un `PedidoEntrante` y reportarlo a queandabuscando,
pero ese cambio no toca hoy ni `ProductoTienda.existencia` ni `Venta`. Un pedido online puede llegar
a `DELIVERED` sin dejar rastro en el inventario ni en el cierre de caja.

Dos puntos del ciclo de vida ya venían fijados por el backlog y por el spec, y **no se relitigan
aquí**: la baja de inventario ocurre al pasar a `CONFIRMED` (criterio 2) y la `Venta` se genera al
pasar a `DELIVERED` (criterio 4). Lo que quedaba abierto es **qué naturaleza tiene cada uno de esos
dos efectos** y **cómo conviven** sin descuadrar el inventario.

Las restricciones reales del código:

- `src/constants/movimientos.ts` declara doce tipos de movimiento. **Ninguno significa «esto va a
  venderse pero todavía no se vendió».**
- `AJUSTE_SALIDA` significa hoy, literalmente, «corrige excesos en el inventario por error de
  conteo» (`TIPO_MOVIMIENTO_DESCRIPTIONS`). Es el tipo que un encargado usa cuando el conteo físico
  no cuadra.
- `VENTA` lo escribe automáticamente el POS al cobrar, con `referenciaId` apuntando a la `Venta` que
  lo originó. `DELETE /api/venta/[tiendaId]/[cierreId]/[ventaId]` **depende de esa atadura**: busca
  `movimientoStock.findMany({ where: { referenciaId: ventaId } })` y convierte cada `VENTA` en un
  `AJUSTE_ENTRADA` para devolver la mercancía. Un movimiento `VENTA` sin `Venta` detrás es un
  movimiento que ese camino nunca encuentra.
- `CreateMoviento` (`src/lib/movimiento/index.ts`) ya acepta el enum completo de `ITipoMovimiento`
  desde el servidor, no solo los de `TIPOS_MOVIMIENTO_MANUAL`. `DEVOLUCION_VENTA` es el precedente:
  vive fuera de esa lista, con su propio flujo dedicado, porque no encaja en el formulario genérico.
- En el POS, cobrar una venta **ya descuenta el stock** por su propio camino (el `UPDATE` masivo de
  `ProductoTienda` más los `movimientosVenta` de `POST /api/venta/[tiendaId]/[cierreId]`). Reutilizar
  ese camino tal cual en `DELIVERED` descontaría el inventario **dos veces** por el mismo pedido.

## Decisión

**Dos tipos de movimiento nuevos y dedicados —`PEDIDO_ONLINE_RESERVA` y
`PEDIDO_ONLINE_LIBERACION`— y una `Venta` que registra el cobro sin volver a tocar la existencia.**

En concreto:

| Transición | Efecto sobre el stock | Efecto financiero |
|---|---|---|
| `→ CONFIRMED` | Un `PEDIDO_ONLINE_RESERVA` por línea reservable. La existencia baja. | Ninguno |
| `→ READY`, `→ IN_TRANSIT` | Ninguno | Ninguno |
| `→ DELIVERED` | **Ninguno.** La mercancía ya salió al confirmar. | `Venta` + `VentaProducto`, asociada al `CierrePeriodo` abierto de la tienda |
| `→ CANCELLED`, `→ REJECTED_BY_STORE` | Un `PEDIDO_ONLINE_LIBERACION` que espeja cada reserva viva. La existencia vuelve. | Ninguno |

### Por qué un tipo nuevo y no uno existente

Un tipo propio es lo único que deja los tres significados separados: una corrección de conteo, una
venta cobrada y una reserva pendiente de entrega son tres hechos distintos del negocio, y el informe
que lee cada uno lee el que le corresponde. `shrinkage.ts` filtra `["MERMA", "DEVOLUCION_VENTA"]`,
`cpp-report.ts` filtra `["COMPRA", "TRASPASO_ENTRADA", "CONSIGNACION_ENTRADA"]` y
`loadCierreInput.ts` filtra `["COMPRA", "MERMA", "DEVOLUCION_VENTA"]`: **ninguno de los tres cambia**,
porque los dos tipos nuevos no pertenecen a ninguna de esas listas. Esa es la prueba de que la
separación no es cosmética.

`DEVOLUCION_VENTA` ya sentó el precedente exacto: un tipo que vive **fuera** de
`TIPOS_MOVIMIENTO_MANUAL`, escrito solo por una ruta de servidor de confianza. `PEDIDO_ONLINE_RESERVA`
y `PEDIDO_ONLINE_LIBERACION` entran igual —en `TIPOS_MOVIMIENTO` sí, en `TIPOS_MOVIMIENTO_MANUAL` no—
y por la misma razón: son escrituras de sistema, no un formulario que alguien rellena.

### Por qué la `Venta` del `DELIVERED` no descuenta

Porque la mercancía ya salió del almacén al confirmar. `DELIVERED` formaliza el **cobro**, no la
salida. La `Venta` se escribe por un camino de servidor propio que crea `Venta` y `VentaProducto`
—para que el margen, el descuento y el cierre del período la vean— y que **no** ejecuta el `UPDATE`
de existencia ni crea movimientos `VENTA`. Esto es lo que sostiene el criterio 8: recorrer
`PULLED → CONFIRMED → READY → IN_TRANSIT → DELIVERED` deja cada producto exactamente `cantidad`
unidades por debajo, ni el doble ni la mitad, porque hay **una sola** escritura de stock en todo el
recorrido.

### Los nombres, y por qué están en español

El resto del proyecto escribe identificadores nuevos en inglés (`AGENTS.md`). Estos dos son la
excepción deliberada: son **valores** del enum `MovimientoTipo`, que se persisten en una columna, se
muestran en la lista de movimientos junto a los otros doce y se leen en `TIPO_MOVIMIENTO_LABELS`. Un
enum mitad `COMPRA` mitad `ONLINE_ORDER_RESERVATION` es peor que uno consistente. **Solo los dos
valores del enum siguen la convención vieja**; todo identificador de código nuevo alrededor de ellos
—funciones, tipos, variables, comentarios— va en inglés como manda `AGENTS.md`.

### Qué línea se reserva y qué línea no

Una línea es reservable cuando su `storeProductExternalId` resuelve a un `ProductoTienda` vivo
(`deletedAt: null`) de la tienda dueña del pedido **y** hay existencia suficiente. Las demás se
**saltan**, se cuentan y no se reservan; el cambio de `status` se aplica igual. Las tres causas
—`NO_PRODUCT_REFERENCE` (el `storeProductExternalId` es `NULL`, criterio 12),
`PRODUCT_NOT_RESOLVED` (ya no resuelve, criterio 13) e `INSUFFICIENT_STOCK`— comparten **una sola
rama de código**: «esta línea no puede reservarse». No son tres guardas (E-032), son tres razones de
la misma.

`INSUFFICIENT_STOCK` no está en ningún criterio, y aun así tiene que estar decidido: `CreateMoviento`
lanza `InsufficientStockError` ante una baja mayor que la existencia, y sin esta decisión ese `throw`
abortaría la transacción entera después de que QAB ya aceptó el `CONFIRMED`, dejando al encargado con
un pedido que no puede mover nunca. La disponibilidad que ve el comprador en queandabuscando es un
enum de tres valores y eventualmente consistente (F-007): que un pedido llegue pidiendo más de lo que
hay **no es una anomalía, es el funcionamiento normal**.

Por eso la reservabilidad se decide **antes** de invocar a `CreateMoviento`, sobre filas ya
bloqueadas dentro de la misma transacción, y `CreateMoviento` recibe únicamente las líneas que sí
caben. Su propia guarda sigue ahí y sigue siendo correcta: simplemente no se dispara desde este
camino.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `AJUSTE_SALIDA` para la reserva, `AJUSTE_ENTRADA` para el reverso | Su significado publicado es «corrige excesos por error de conteo». Un negocio con pedidos online vería su lista de ajustes llena de correcciones que nadie hizo, y no podría distinguir un descuadre real de una reserva pendiente. El coste cae sobre la operación diaria, no sobre el código. |
| Reutilizar `VENTA` para la reserva | Rompe la atadura `movimiento VENTA → Venta` de la que depende el borrado de una venta (`referenciaId`), y adelanta al `CONFIRMED` unas unidades vendidas que todavía no tienen `Venta`. Además hace **invisible** el doble descuento que el criterio 8 existe para detectar: los dos movimientos serían del mismo tipo. |
| Reservar al `CONFIRMED` y, en `DELIVERED`, **revertir la reserva y volver a descontar** por el camino normal del POS | Dos escrituras de movimiento por unidad vendida en vez de una, y una ventana —entre la reversión y el nuevo descuento— en la que la existencia no refleja lo reservado. Toda esa complejidad para llegar exactamente al mismo saldo. |
| No reservar nada al `CONFIRMED` y descontar solo al `DELIVERED` | Contradice el criterio 2, que el backlog ya congeló. Y deja al negocio vendiendo en el POS mercancía ya comprometida con un pedido online aceptado. |
| No crear tipos nuevos y llevar la reserva en una tabla propia, fuera de `MovimientoStock` | La existencia dejaría de ser reconstruible desde sus movimientos: hoy toda variación de `ProductoTienda.existencia` tiene un `MovimientoStock` que la explica, y esa es la única auditoría de inventario que el sistema tiene. |
| Abortar la transacción cuando una línea no tiene stock | QAB ya aceptó el `CONFIRMED` cuando esto se descubre (ADR 0063). El pedido quedaría visible para el comprador como confirmado y bloqueado para siempre en cuadrecaja, sin salida por la UI. |

## Consecuencias

**A favor:**

- El criterio 8 se sostiene por construcción, no por cuidado: hay una única escritura de stock en
  todo el recorrido de un pedido.
- Ningún reporte existente cambia de resultado para un negocio que no usa la tienda online: los tres
  filtros por `tipo` que existen hoy no incluyen los dos valores nuevos.
- La reserva es visible en la lista de movimientos de la tienda con su propia etiqueta, así que un
  encargado puede ver qué parte de su inventario está comprometida y no vendida.
- El reverso del criterio 3 espeja **los movimientos de reserva realmente escritos**, no las líneas
  del pedido. Una línea que se saltó al confirmar no se devuelve al cancelar, porque nunca se tomó.

**En contra / coste asumido:**

- Los dos valores nuevos del enum `MovimientoTipo` obligan a una migración de Prisma y a completar
  los cuatro `Record<ITipoMovimiento, …>` de `src/constants/movimientos.ts`. Eso es un coste, pero
  también la red: `tsc` no compila hasta que los cuatro estén completos.
- **Las unidades de un pedido online no aparecen bajo `tipo = "VENTA"`.** Los dos
  `GET /api/(app/)resumen-dia/[tiendaId]` cuentan `mov.tipo === "VENTA"` como «ventas del día» y
  reconstruyen la cantidad inicial con `final − entradas + ventas + salidas`. Los tipos nuevos tienen
  que entrar en las listas `TIPOS_SALIDAS` / `TIPOS_ENTRADAS` **locales de esas dos rutas** para que
  esa aritmética siga cerrando; el pedido online se contará ahí como salida, no como venta. Los
  reportes que derivan las ventas de `Venta`/`VentaProducto` —`sales-stream.ts`,
  `income-statement.ts`, `closing-totals.ts`, `computeCierreTotals`— sí lo cuentan como venta, que es
  lo que pide el criterio 6.
- **Borrar una `Venta` de pedido online no devuelve el stock.**
  `DELETE /api/venta/[tiendaId]/[cierreId]/[ventaId]` revierte a partir de
  `movimientoStock.findMany({ where: { referenciaId: ventaId } })`, y los movimientos de un pedido
  online llevan `referenciaId = pedidoId`, no `ventaId`. Ese borrado dejaría la existencia baja y el
  pedido marcado como reservado. **Queda fuera del alcance de F-014 y sin guarda añadida**, por dos
  razones: el spec excluye tocar rutas que no son la del `PATCH`, y una guarda que ningún criterio
  ejercita es una rama que nadie prueba (E-032). Quien lo aborde tiene el dato consultable que
  necesita: `Venta.pedidoEntranteId IS NOT NULL` (ADR 0072).
- El costo con el que se valora la línea vendida se toma en `DELIVERED`, de
  `ProductoTienda.costo`/`monedaCostoCode` vigentes en ese instante. Si una `COMPRA` movió el CPP
  entre el `CONFIRMED` y el `DELIVERED`, el margen del pedido usa el costo nuevo aunque la mercancía
  que salió fuese la vieja. Es la misma imprecisión que ya carga cualquier venta del POS, y se asume
  antes que montar un segundo mecanismo de snapshot de costo.
- Un pedido que se queda parado en `READY`/`IN_TRANSIT` mantiene su reserva viva indefinidamente: el
  contrato de QAB no le pone plazo a esos dos estados. Sigue siendo la pregunta abierta 2 del spec.

**Impacto en seguridad y escalabilidad:**

- El aislamiento multi-tenant no depende de los tipos nuevos: la puerta sigue siendo la de F-011/F-012
  —`negocioId` desde la sesión, `tiendaId` de la tienda **dueña del pedido**— y las líneas se
  resuelven contra `ProductoTienda` de esa misma `tiendaId`. Un `storeProductExternalId` que apunte a
  un `ProductoTienda` de otro negocio no resuelve y se salta como `PRODUCT_NOT_RESOLVED`, que es
  exactamente el criterio 13.
- El `motivo` de los movimientos lleva el `pedidoId`, **nunca `PedidoEntrante.code`**: ese código es
  la credencial pública de la página del comprador (F-011, ADR 0061) y el `motivo` se muestra en la
  lista de movimientos. `formatMovimientoMotivo` ya abrevia el UUID a `#xxxxxxxx` al mostrarlo.
- El coste por transición es proporcional al número de líneas del pedido, no al histórico: una
  lectura de `ProductoTienda` por lote (un `findMany` con `id IN (…)`, nunca uno por línea) y las
  escrituras de `CreateMoviento`. Las filas se bloquean en orden ascendente de `productoTiendaId`
  para que dos aterrizajes concurrentes sobre productos compartidos no se abracen.
