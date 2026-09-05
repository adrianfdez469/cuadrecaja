# ADR 0036: Las cifras guardadas de un cierre cerrado son la fuente de verdad

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** transversal (cierre de caja, resumen de cierres, reportes)

## Contexto

Un período cerrado tenía **tres** valoraciones distintas conviviendo, y la pantalla mezclaba
las tres en una misma fila:

| Origen | Quién lo calculaba | Tasa de cambio usada |
|--------|--------------------|----------------------|
| Columnas `CierrePeriodo.total*` y `ResumenMonedaCierre` | `close/route.ts`, una vez, al cerrar | Histórica |
| "Venta", "Bruto", "Descuentos" y las ganancias netas del listado | `summary/route.ts`, en cada carga, recorriendo todas las ventas del rango | Histórica |
| Todo el drawer de detalle | `[cierreId]/route.ts`, en cada carga | **La más reciente** |

Mientras nadie tocara las ventas de un período cerrado, las tres coincidían salvo centavos. En
cuanto una venta cambiaba de período a mano (caso real: cuatro ventas de la mañana siguiente
movidas al período correcto), la fila del historial mostraba "Venta 1368,35" recalculado junto
a "V. Propias 1488,23" guardado, y la ganancia guardada seguía siendo la de 62 ventas para un
período que ya tenía 58. Nada avisaba.

Agravantes que salieron en la misma investigación:

- `close/route.ts` escribía `ResumenMonedaCierre` con `createMany({ skipDuplicates: true })`.
  Un segundo cierre del mismo período (solo posible reabriéndolo a mano) sobreescribía los
  totales pero **conservaba el desglose por moneda del primero**. Ver E-017.
- El desglose por moneda del drawer histórico imprimía un único "≈ base" que incluía fondo
  inicial y propinas sin decirlo, y se leía como el total de ventas.
- `Venta.total` de 11 ventas de la app móvil guardaba la suma cruda de precios en CUP en un
  negocio con base USD. Ningún cierre lo usa, pero es otra copia derivada sin dueño.

## Decisión

**Un período cerrado tiene una única valoración: la guardada en `CierrePeriodo` y
`ResumenMonedaCierre`. Cambia solo mediante la acción explícita de recálculo.**

En concreto:

1. **Un motor.** `src/lib/cierre/computeCierreTotals.ts` es una función pura que recibe las
   filas de un período (`loadCierreComputationInput`) y devuelve todas sus cifras: totales,
   desglose por moneda, liquidaciones a proveedores y las ventas valoradas. Cerrar, recalcular,
   el detalle y el listado la ejecutan; nadie más deriva una cifra de cierre por su cuenta.
2. **Lo guardado manda.** Para un período cerrado, el listado y el detalle leen las columnas
   guardadas. El período abierto se valora en vivo con el mismo motor. `totalVentasBrutas` y
   `totalDescuentos` pasan a ser columnas para que el listado no recorra las ventas del rango.
3. **Recálculo explícito.** `POST /api/cierre/[tiendaId]/[cierreId]/recalculate` (solo
   `SUPER_ADMIN`, con `dryRun` de previsualización) rehace lo guardado desde las ventas
   actuales. Es el paso obligatorio después de cualquier corrección manual de ventas.
   `scripts/recalculate-cierres.ts` hace lo mismo en lote.
4. **Desfase visible.** El listado y el detalle valoran las ventas del período y comparan su
   total neto con el guardado; si difiere (o el período lo cerró el motor anterior, marcado por
   `totalsComputedAt = NULL`), devuelven `totalesDesactualizados` y la pantalla muestra el aviso
   con la acción de recalcular. Una edición manual deja de ser silenciosa.
5. **Escrituras idempotentes.** Persistir un cierre borra y vuelve a crear su desglose por
   moneda y sus liquidaciones no liquidadas. Una liquidación con `liquidatedAt` es dinero ya
   entregado a un proveedor: se conserva y su línea recalculada se descarta.
6. **Tasas deterministas.** Cada venta se valora con su propio snapshot completado con la tasa
   histórica de su fecha (`resolveSnapshotFromHistory`); gastos, compras y fondo con la tasa
   vigente en el instante del cierre. Nunca con "la más reciente", que cambia cada día.

### Inventario de datos derivados y su dueño

Esta tabla es la respuesta a "qué información redundante hay y quién la refresca". Todo lo que
no aparece aquí como derivado es dato primario.

| Dato | Derivado de | Quién lo escribe | Cuándo se refresca |
|------|-------------|------------------|--------------------|
| `CierrePeriodo.total*` (16 columnas) | Ventas, gastos, movimientos y fondo del período | `persistCierreComputation` | Al cerrar y al recalcular |
| `ResumenMonedaCierre` | Pagos, vueltos, propinas, fondo y deducciones | Ídem | Ídem (borrar y crear) |
| `ProductoProveedorLiquidacion` (no liquidadas) | Líneas de consignación | Ídem | Ídem; las liquidadas nunca |
| `Venta.total` | Líneas × tasa − descuento | El servidor al crear la venta (`reconcileSaleTotal`) | Nunca; `--fix-venta-total` corrige el histórico |
| `Venta.discountTotal` | Reglas de descuento | El servidor al crear la venta | Nunca |
| `Venta.totalcash` / `totaltransfer` | Pagos menos propina | El cliente; el servidor no lo verifica | Nunca (deuda: derivar en servidor) |
| `Venta.tasaSnapshot` | Tasas vigentes en el cliente | El servidor lo completa (`resolveSaleTasaSnapshot`) | Nunca |
| `pagosDetalle[].equivalenteBase` | `monto` × snapshot | El cliente | Nunca; informativo, el motor lo recalcula |
| `VentaProducto.precio` / `costo` | Precio del producto en ese momento | El servidor al crear la venta | Nunca: es un snapshot legítimo |
| `InitialCashFund` | — | Append-only; la última fila es la vigente | — |
| `CashBreakdown*` | Conteo físico | El cajero | Se borra al cerrar |

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Recalcular siempre todo desde las ventas y tratar las columnas como caché | Es lo que ya hacía a medias el listado y la causa de la fila incoherente. Además obliga a recorrer todas las ventas del rango en cada carga del historial y en cada reporte. |
| Bloquear toda edición de un período cerrado y no ofrecer recálculo | Las correcciones manuales existen y van a seguir existiendo (una venta en el período equivocado). Sin recálculo, la única salida vuelve a ser el `UPDATE` a mano que causó esto. |
| Endpoints de "reabrir período" y "mover venta entre períodos" | Cubren un caso raro con mucha superficie nueva. "Editar y recalcular" resuelve lo mismo con una sola acción auditada; se reevalúa si el caso se repite. |
| Mantener `createMany({ skipDuplicates })` y solo añadir el recálculo | El recálculo no podría reescribir el desglose. Borrar y crear dentro de la transacción es más simple y es idempotente. |

## Consecuencias

**A favor:**
- Una cifra de un cierre cerrado significa lo mismo en el listado, el detalle, el widget de caja
  y los reportes.
- Editar ventas a mano tiene un paso oficial y visible después: recalcular.
- El listado deja de recorrer todas las ventas del rango; solo valora las del página para
  detectar desfase.

**En contra / coste asumido:**
- Migración: dos columnas en `CierrePeriodo`, tres en `ResumenMonedaCierre`.
- Los períodos cerrados por el motor anterior (`totalsComputedAt = NULL`) se siguen valorando en
  vivo hasta que se ejecute `scripts/recalculate-cierres.ts --apply`. Hay que correrlo justo
  después de desplegar.
- La ganancia guardada pasa a ser **neta de descuentos** (antes era bruta y cada lector la
  neteaba a su manera). Cualquier consumidor que restara descuentos por su cuenta los restaría
  dos veces; el listado ya no lo hace.
- `Venta.totalcash` / `totaltransfer` siguen viniendo del cliente. Queda anotado como deuda; no
  entra en ningún total de cierre.

**Impacto en seguridad y escalabilidad:**
- El recálculo reescribe datos contables: solo `SUPER_ADMIN`, siempre filtrado por el
  `negocioId` de la sesión, y con previsualización obligatoria en la UI.
- El listado hace una consulta de ventas acotada a los cierres de la página (≤ 50) en vez de a
  todo el rango.
