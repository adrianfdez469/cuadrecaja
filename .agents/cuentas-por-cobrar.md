# Cuentas por Cobrar — dosier del epic (F-031 … F-039)

> **Léelo antes de tocar cualquiera de los nueve features.** Aquí está lo que los nueve
> comparten: la decisión central, los bugs que el epic destapa, la auditoría de los archivos
> afectados y el reparto de propiedad. Sin esto, cada `spec` vuelve a derivar lo mismo, distinto
> cada vez.
>
> Lo que **no** está aquí y hay que leer en su sitio: `AGENTS.md` (convenciones),
> `.agents/COMMON_ERRORS.md` (índice de errores) y los **ADR 0036, 0071, 0072 y 0073**. Este
> documento los cita por número y no los parafrasea: parafrasear una definición que ya existe es
> [E-039](errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md).

---

## 1. El problema

Hoy el sistema asume que toda venta se cobra en el acto: `Venta.totalcash + totaltransfer = total`,
y el dinero entra a la caja del mismo cierre. Eso deja fuera dos situaciones reales:

- **Mercancía que sale con un tercero de confianza.** Un negocio que vende equipos fotovoltaicos:
  un grupo de instaladores se lleva los equipos, los monta, cobra al cliente final y días después
  liquida a la tienda. Hoy eso descuadra la existencia real contra la contabilidad, y no hay
  registro de quién tiene qué, cuánto debe ni desde cuándo.
- **Pedido despachado con un mensajero.** El producto sale del inventario al entregárselo al
  repartidor y el dinero puede volver uno o dos días después, en otro cierre.

En los dos casos el negocio pierde el control de una parte de su capital.

### Decisiones de producto, cerradas por el humano

Ningún agente las reabre. Si una parece equivocada, se para y se pregunta.

1. **Modelo = venta a crédito.** Al entregar se crea la `Venta` normal: baja inventario, entra al
   cierre, reconoce venta y ganancia. El dinero no entra a caja. Los cobros posteriores son
   **abonos** que entran a la caja del cierre en que ocurren.
2. **Ganancia devengada** al entregar, no al cobrar. `totalVentas` y `totalGanancia` conservan
   exactamente su significado actual.
3. Entidad nueva **`Cliente`** (deudor) por negocio.
4. Alcance completo: crédito en el POS · reflejo en cierre y resumen · panel propio · pedidos
   online a crédito.
5. Soporta **crédito parcial** (parte cobrada al momento) y **abonos parciales**.
6. Se puede vender a crédito **sin conexión**, incluso nombrando un cliente que aún no existe.
7. Pedidos online: la `Venta` **sigue naciendo en `DELIVERED`**. El ADR 0071 no se toca.

### El precedente a espejar

El sistema ya tiene este problema **invertido**: mercancía recibida y aún no pagada *al* proveedor.
Vive en `ProductoProveedorLiquidacion` (`prisma/schema.prisma:848`), donde `liquidatedAt IS NULL`
significa exactamente lo que aquí significará `settledAt IS NULL`: **devengado y no liquidado**. Su
panel es `src/app/proveedores/`, con las columnas «Dinero Liquidado» y «Por Liquidar». Estúdialo
antes de diseñar nada: es el mismo problema al otro lado del libro.

---

## 2. La decisión central

> **El crédito NO es una línea de `pagosDetalle`.**
> `pagoLineaSchema.tipo` se queda en `z.enum(["cash","transfer"])`.
> El crédito viaja en una columna propia, `Venta.creditoBase`.

Invariante nueva, que **sustituye** a la que hoy documenta `CheckoutView.tsx:585`:

```
Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) + creditoBase = total + tipTotal
```

### Por qué no se amplía el enum

1. **`src/lib/movimiento/caja.ts:167`** y **`src/lib/tips.ts:152`** hacen ambos
   `if (tipo === "cash") … else …` **y suman `equivalenteBase` fuera del `if`**. Un tercer valor
   entraría como transferencia *y* como equivalente base: dos fallos silenciosos por función, y el
   cuadre de caja mentiría por el monto exacto del crédito. Arreglar solo el `else` no basta.
2. **`pagosDetalle` significa «dinero físicamente recibido»** y `buildResumenMonedas` solo lo
   recorre a él. Ver §3.
3. **El crédito no tiene moneda física.** Como línea contaminaría `map[pago.moneda]` en
   `buildResumenMonedas`, `buildResumenPropinas`, `payment-mix.ts` y `buildTicketPayload.ts:25`,
   que arma la lista de monedas del ticket recorriendo `pagosDetalle`: el ticket mostraría una
   columna de conversión para una moneda inexistente.
4. **El abono ocurre semanas después**, en otro cierre y con otro `tasaSnapshot`, así que no puede
   vivir en el `pagosDetalle` de la venta —inmutable y perteneciente al período de la entrega—. La
   tabla de abonos hace falta igualmente; una línea `credit` sería una segunda representación del
   mismo hecho, con dos sitios donde desincronizarse.

### Reglas duras

Validadas en servidor, en **las dos** rutas de venta (la web y su espejo `/api/app/venta`):

| Regla | Si no se cumple |
|---|---|
| `creditoBase > 0 ⟹ clienteId` presente y del negocio | **409**, no 500 — `isPermanentSyncError` lo aparca en vez de reintentar para siempre |
| `creditoBase > 0 ⟹ Σ vueltoDetalle === 0` | 400. Dar vuelto y deber dinero es contradictorio |
| `creditoBase > 0 ⟹ tipTotal === 0` | 400. `amountDue = finalTotal + tipTotal`, así que una propina a crédito es prestarle dinero al cliente para que propine |
| Invariante dentro de `SALE_TOTAL_TOLERANCE_BASE` | 400. Hoy **nadie la comprueba**, y con crédito es la única defensa contra una deuda inventada por el cliente |

**Gracias a la tercera regla, `validateTip` no se toca**: su primera línea es
`if (requested <= 0) return { ok: true, … }` (`src/lib/tips.ts:63`, comprobado).

### La deuda se denomina en moneda base

`monedaDeudaCode` y `montoDeudaMonedaOriginal` se guardan **solo como referencia informativa**,
para poder decirle al cliente «debes 20 USD». Toda la aritmética corre sobre la cifra en base.

Denominar la deuda en divisa haría que `totalPorCobrarAlCierre` de un cierre viejo **cambiara al
mover la tasa**, rompiendo la idempotencia del recálculo. Es el argumento decisivo y no es
negociable.

---

## 3. Por qué la caja sigue cuadrando sola

`buildResumenMonedas` (`src/lib/movimiento/caja.ts:144`) arma la caja iterando
`venta.pagosDetalle` y `venta.vueltoDetalle`. **No mira `Venta.totalcash` en ningún momento.**

Como el crédito no es una línea de `pagosDetalle`, **una venta a crédito no aporta nada a la gaveta
sin que nadie toque el motor de caja**, y el conteo físico sigue comparándose contra `totalEfectivo`
sin ningún ajuste.

Ese es el activo principal de todo el epic. Consecuencias que hay que respetar:

- El cálculo del descuadre (`MonedaBreakdownRow.tsx:155`, `breakdownTotal − totalEfectivo`)
  **no se modifica**. Lo que falta en la pantalla de cierre es **explicarlo, no corregirlo**.
- Quien «arregle» esto metiendo el crédito dentro de `pagosDetalle` rompe el cuadre de caja del
  producto entero.

---

## 4. Los tres bugs latentes que el epic destapa

Verificados leyendo el código. Los dos primeros harían que el crédito falle **en silencio**; el
tercero es un agujero de integridad que ya existe hoy.

| # | Dónde | Qué pasa | Lo arregla |
|---|---|---|---|
| 1 | `src/app/pos/page.tsx:927-929` | `if (Math.round(total*100) <= Math.round((totalCash+totalTransfer)*100))`. Con crédito la condición es **siempre falsa** y su `else` (~1203) muestra «El pago no cubre el total de la venta»: la venta se pierde culpando al cajero. → comparar contra `totalCash + totalTransfer + creditoBase` | **F-034** |
| 2 | `src/app/pos/page.tsx:961` | `const cash = total - totalTransfer;` — y es `cash`, no `totalCash`, lo que llega a `createSell`. Con crédito, **la deuda se contabilizaría como efectivo en gaveta** | **F-034** |
| 3 | `src/lib/currency.ts:329` | `pagadaConUnSoloPago` es `(pagosDetalle?.length ?? 0) <= 1`: con `[]` devuelve `true`. Una venta 100 % a crédito **permitiría borrar productos**, desincronizando el importe de la deuda del de la venta | **F-037** |

**El bug 3 es peor en el backend.** En
`src/app/api/venta/[tiendaId]/[cierreId]/[ventaId]/producto/[ventaProductoId]/route.ts:129` la
guarda es `if (!esUltimoProducto && pagos && !pagadaConUnSoloPago(pagos))`: un `pagosDetalle` nulo
no es que pase la guarda, es que la **salta entera** por el segundo operando. Por eso su criterio
exige comprobarlo llamando a la API directamente, no mirando la pantalla.

La solución **no** es cambiar `pagadaConUnSoloPago`: su semántica actual («cero o un pago») es
correcta para lo que fue escrita. Se añade una **tercera razón de bloqueo** con su propio motivo
visible, y el gate compuesto se arma en cada llamador — los cuatro:
`VentaDetailDialog.tsx:89`, `UserSalesDrawer.tsx:96`, `SaleProductsDetailDrawer.tsx:114` y la ruta
de la API.

### Corrección defensiva, independiente del epic

Endurecer el `else` de `buildResumenMonedas` (`caja.ts:167`) y `buildResumenPropinas`
(`tips.ts:152`) a `else if (pago.tipo === "transfer")`, con un aviso en el caso restante — y
**sacar también el `equivalenteBase` de la rama muerta**, que es la mitad que se olvida. Va en
**F-031**, se puede mergear sola, y es la parte de este trabajo que sobrevive al epic: cierra la
trampa para cualquier tipo de pago futuro (vales, puntos), no solo para el crédito.

---

## 5. Vocabulario

Nombres que los nueve features usan igual. **El contrato de interfaces de F-031 es quien los fija**;
esto es la forma propuesta, para que nadie invente un sinónimo mientras tanto.

Convención: modelos y columnas de Prisma **en español**, como el resto de `schema.prisma`
(`PedidoEntrante` y `OutboxEvento` son recientes y siguen ese patrón); comentarios `///` **en
inglés**; **todo símbolo TypeScript nuevo en inglés**, según `AGENTS.md`.

| Entidad | Qué es | Notas |
|---|---|---|
| `Cliente` | El deudor, por negocio | Molde exacto de `Proveedor` (`schema.prisma:802`), con `@@unique([nombre, negocioId])` y soft delete |
| `Venta.creditoBase` | Parte del total entregada a crédito, en moneda base | `@default(0)`; 0 es toda venta anterior a la migración |
| `Venta.clienteId` | El deudor | `NULL ⟺ creditoBase = 0` |
| `CuentaPorCobrar` | La deuda: una fila por venta a crédito | `ventaId @unique`; `settledAt IS NULL` = viva; `saldoPendiente` denormalizado |
| `MovimientoCuentaPorCobrar` | Log **append-only** de todo lo que mueve un saldo | `ABONO`, `AJUSTE_DEVOLUCION`, `CONDONACION`, `REVERSION_ABONO` |
| `CierrePeriodo.totalCreditoOtorgado` | Σ `creditoBase` del período | Dentro de `totalVentas`, **fuera** de la gaveta |
| `CierrePeriodo.totalCobrosCredito` | Deudas viejas cobradas en el período | Dentro de la gaveta, **fuera** de `totalVentas` |
| `CierrePeriodo.totalPorCobrarAlCierre` | Saldo de la tienda en `fechaFin`, de todos los períodos | Un **stock**, no un flujo: nunca se suma entre períodos |
| `MovimientoStock.montoAplicadoADeuda` | En una `DEVOLUCION_VENTA` a crédito, cuánto se descontó de la deuda | La caja baja por `montoReembolso − montoAplicadoADeuda` |

Dos invariantes de forma que hay que respetar aunque parezcan detalles:

- **`MovimientoCuentaPorCobrar.pagosDetalle` reutiliza *verbatim* la forma `IPagoLinea[]` de
  `Venta`.** Así `buildResumenMonedas` consume ventas y abonos **por la misma función**: cero
  código de agregación nuevo y cero divergencia entre «qué es dinero en gaveta» para una venta y
  para un cobro.
- **El log es append-only y no es cosmético.** `totalPorCobrarAlCierre` de un período cerrado se
  recomputa como «movimientos con `fecha <= fechaFin`»; mutar filas rompería la idempotencia del
  recálculo. Por eso `REVERSION_ABONO` es una fila nueva y no un `DELETE`.

`saldoPendiente` es denormalizado y **puede derivar** si alguien escribe en la tabla por fuera. Un
único helper `applyMovimientoCuentaPorCobrar(tx, cuentaId, movimiento)` en
`src/lib/cuentasPorCobrar/` debe ser la **única** forma de insertar ahí, más un
`scripts/recalculate-cuentas-por-cobrar.ts --apply` con el molde de `scripts/recalculate-cierres.ts`
para reparar.

---

## 6. Auditoría de consumidores de `pagosDetalle`

Recorrida completa sobre `src/`. Con la decisión de §2, **ninguno rompe por el enum**, pero varios
sí por el crédito. Esta tabla existe para que nueve agentes no vuelvan a recorrer los mismos treinta
archivos.

### Caja — aquí es donde miente el cuadre

| Archivo | Qué hacer | Feature |
|---|---|---|
| `caja.ts:144` `buildResumenMonedas` | Endurecer el `else`. Su lógica no cambia, pero ahora recibe ventas **y** abonos: documentarlo | F-031 / F-032 |
| `caja.ts:273` `construirResumenCajaAbierta` | **Cargar los abonos del período abierto.** Sin esto el POS cree que hay menos efectivo del que hay: un vuelto legítimo se rechaza con `InsufficientCashForChangeError` y una `COMPRA` en efectivo se marca `MIXTO` sin motivo | F-032 |
| `caja.ts` `ResumenCajaMoneda` | Añadir `cobrosCreditoEfectivo`, **fuera** de `ventasEfectivo`: el widget debe distinguir venta de cobro | F-032 |
| `caja.ts` `applyComprasYDevolucionesToResumenMap` | Restar solo la parte en efectivo: `montoReembolso − (montoAplicadoADeuda ?? 0)` | F-032 |
| `caja.ts` `calcularTotalesMovimientosPeriodo` | **Sin cambios** — es la reversión de margen, correcta con o sin deuda | — |
| `caja.ts` `applyInitialFundToResumenMap` | **Sin cambios** | — |
| `tips.ts:152` `buildResumenPropinas` | Endurecer el `else`. **No** recibe abonos | F-031 |
| `tips.ts:63` `validateTip` | **Sin cambios**, gracias a la regla `creditoBase > 0 ⟹ tipTotal === 0` | — |

### Motor de cierre

| Archivo | Qué hacer | Feature |
|---|---|---|
| `cierre/computeCierreTotals.ts` | Tres cifras nuevas; abonos a `buildResumenMonedas` en la misma llamada; `totalTransferenciasByDestination` acumula también desde abonos; `hasTotalsDrift` **no cambia** | F-032 |
| `cierre/loadCierreInput.ts` | Dos consultas más. **Ver el aviso del §7** | F-032 |
| `cierre/persistCierreTotals.ts` | Sin cambio estructural: `...computation.totals` ya escribe las columnas nuevas. Añadir el comentario de que las cuentas por cobrar **nunca** se reescriben desde el motor, a diferencia de `ProductoProveedorLiquidacion` | F-032 |
| `api/cierre/[tiendaId]/[cierreId]/close/route.ts` | **Ni una línea.** Es la evidencia de que el ADR 0036 valió la pena | — |
| `.../recalculate/route.ts` | Añadir los campos al `select` de `before`, o no tipa contra `CierreStoredTotals` | F-032 |
| `.../summary/route.ts` | `creditoBase: 0` en la venta sintética del drift check; dos sumas nuevas; **`totalPorCobrarAlCierre` no se suma** | F-036 |

### Rutas de venta

| Archivo | Qué hacer | Feature |
|---|---|---|
| `api/venta/[tiendaId]/[cierreId]/route.ts` | Campos nuevos, las cuatro reglas duras, y crear la `CuentaPorCobrar` **en la misma `$transaction`** que la venta. `reconcileSaleTotal` y el `movimientoStock.createMany` de la línea 857 **no cambian**: el inventario baja igual | F-034 |
| `api/app/venta/[tiendaId]/[periodoId]/route.ts` | Espejo completo. `pagosDetalleAppSchema` exige `.min(1)`: una venta 100 % a crédito necesita `superRefine` → `pagosDetalle.length >= 1 \|\| creditoBase > 0` | F-034 |
| `.../[ventaId]/route.ts` (DELETE) | **409** si hay abonos. Sin abonos, `onDelete: Cascade` limpia la deuda | F-037 |
| `.../producto/[ventaProductoId]/route.ts` | 409 si hay abonos; sin abonos el ajuste descuenta **primero** del crédito; `ratioCash`/`ratioTransfer` (~:230) sobre `total − creditoBase`; **y el bug 3** | F-037 |
| `.../devolucion/[ventaId]/route.ts` | Reparto **deuda primero** vía `splitRefundBetweenDebtAndCash` | F-037 |

### POS y cola offline

`paymentMath.ts` y `usePaymentLines.ts` **no cambian**: `PaymentLineKind` sigue con dos valores. La
resta la hace el llamador (`pendingInCurrency(finalTotal − creditoBase)`).

| Archivo | Qué hacer |
|---|---|
| `CheckoutView.tsx:585-592` | Añadir `creditoBase`/`clienteId` a `multimoneda`. **Reescribir el comentario del invariante**, que hoy afirma algo que dejará de ser cierto — un comentario que miente no lo ve ni `tsc`, ni `lint`, ni `build` |
| `pos/page.tsx` | Bugs 1 y 2, y persistir los campos en el `Sale` local |
| **`pos/page.tsx:641-666`** `syncPendingSales` | **Arma su payload campo a campo.** Si los campos nuevos no se añaden ahí explícitamente, una venta a crédito sincronizada tarde llega como venta al contado y la deuda no existe. Mismo molde de bug que ya evitaron con `multimonedaSync` |
| `salesStore.ts:37`, `sellService.ts:69` | Propagar |
| `SalesDrawer.tsx` líneas 201, 241, 404 | Los **tres** reintentos manuales |
| `UserSalesDrawer.tsx:96`, `SaleProductsDetailDrawer.tsx:114` | El gate compuesto del bug 3 |

### Reportes, ticket y detalle

| Archivo | Qué hacer | Feature |
|---|---|---|
| `reports/sales-stream.ts:408` | `creditAmount` en `NormalizedSale`. Hoy el mix de una venta a crédito suma menos que `netAmount` y nadie lo notaría | F-039 |
| `reports/aggregators/payment-mix.ts` | Fila sintética `credito`. Es una **fila de reporte**, no un método de pago | F-039 |
| `reports/income-statement.ts` | Aritmética **intacta**; dos líneas informativas fuera de todo subtotal | F-039 |
| `app/reportes/operacion/page.tsx:27-31` | Tercer bucket | F-039 |
| `features/printing/` (`ITicketData.ts`, `buildTicketLines.ts`, `buildTicketPayload.ts`, `ventaToSale.ts`) | Línea «Saldo a crédito» y nombre del cliente. **Sin flag de plantilla**: lo que un cliente debe es el comprobante mismo de la operación | F-034 |
| `lib/ventaMapper.ts`, `VentaDetailDialog.tsx`, `SaleExtrasSummary.tsx` | Propagar y mostrar | F-037 |

### Verificados y **sin cambios** — no los vuelvas a buscar

`orderLandingPlan.ts` y `tiendaOnlineOrderLanding.ts` salvo la rama nueva de F-038 ·
`components/MultiCurrencyPayment/` (legacy sin consumidores: se **reutiliza** en F-035, ver §8) ·
`app/configuracion/ticket/page.tsx` (mock de preview) · `app/pos/utils/syncErrors.ts` ·
`app/pos/utils/tipMath.ts`, `changeMath.ts`, `useChangeDistribution.ts` ·
`lib/currency.ts` `pagadaConUnSoloPago` (el gate compuesto se arma en los llamadores) ·
y los siete agregadores que trabajan sobre líneas y márgenes: `summary`, `seller-performance`,
`time-series`, `category-margin`, `product-sales`, `discount-rules`, `hour-weekday`.

---

## 7. Las dos trampas que hay que dejar escritas en el código

### El filtro de cuentas abiertas

En `loadCierreInput.ts`, las cuentas abiertas al corte se cargan así:

```ts
where: {
  tiendaId,
  fechaVenta: { lte: corte },
  OR: [{ settledAt: null }, { settledAt: { gt: corte } }],
},
select: { …, movimientos: { where: { fecha: { lte: corte } } } }
```

Si alguien «simplifica» ese `OR` a `settledAt: null` a secas —que parece más limpio y pasa el caso
obvio— **toda cuenta ya cobrada desaparece del recálculo de los cierres anteriores y el saldo
histórico de todos ellos se derrumba a cero.** El criterio correspondiente de F-032 existe para
atraparlo, y el comentario va junto al `where`.

### La antigüedad se calcula contra el corte

`buildCuentasPorCobrarSnapshot` recibe un `at` y calcula contra él —`input.fechaFin ?? new Date()`—,
**nunca contra `Date.now()`**. Con `Date.now()`, recalcular un cierre viejo daría antigüedades
distintas cada vez que se ejecuta.

---

## 8. La ecuación de reconciliación de caja

La que va a usar soporte cuando alguien diga «la caja no cuadra». Merece su ADR.

```
Σ resumenMonedas.equivalenteBase
  = fondoInicial
  + (totalVentas − totalCreditoOtorgado)
  + totalCobrosCredito
  + totalTips
  − totalGastos(caja)
  − totalComprasCaja
  − reembolsosEnEfectivo
```

Leída al revés: un cobro de deuda vieja **sube el efectivo sin subir `totalVentas`**, y una venta a
crédito **sube `totalVentas` sin subir el efectivo**. Las dos direcciones rompen la lectura ingenua
de la gaveta, y las dos cifras nuevas del cierre son exactamente lo que las explica.

Corolario para la pantalla de cierre: la línea «Ventas a crédito» del desglose por moneda **tiene
que llevar escrito que no entró a caja**, en texto secundario y nunca en el rojo de una deducción.
Sin esa frase, un cajero la resta y descuadra a mano lo que estaba cuadrado.

Corolario para el histórico: **un abono registrado después de cerrar un período nunca modifica sus
cifras**; pertenece al período abierto cuando ocurrió.

---

## 9. Mapa de propiedad

Para que dos features en paralelo no colisionen. Cada archivo tiene **un** dueño.

| Feature | Es dueño de |
|---|---|
| **F-031** | `prisma/schema.prisma` + su migración · `src/constants/tenantScope.ts` · `src/schemas/cliente.ts`, `cuentaPorCobrar.ts` y las extensiones de `venta.ts`/`pago.ts` · `src/lib/cuentasPorCobrar/{saldo,aging,refundSplit,creditInvariant}.ts` · el endurecimiento de `caja.ts:167` y `tips.ts:152` |
| **F-032** | `src/lib/cierre/**` · el resto de `src/lib/movimiento/caja.ts` · `api/cierre/**` salvo lo de F-036 |
| **F-033** | `api/clientes/**` · `src/hooks/useClienteSearch.ts` · `src/components/clientes/**` · `src/store/clientesStore.ts` · `permisos.json` y `permisos.templates.ts` · `Layout.tsx` y `home/page.tsx` |
| **F-034** | `src/app/pos/**` · `api/venta/[tiendaId]/[cierreId]/route.ts` y su espejo `api/app/venta/**` · `src/store/salesStore.ts` · `src/services/sellService.ts` · `src/features/printing/**` |
| **F-035** | `src/app/cuentas-por-cobrar/**` · `api/cuentas-por-cobrar/**` · `src/components/MultiCurrencyPayment/**` · `src/constants/cuentasPorCobrar.ts` |
| **F-036** | `src/app/cierre/**` · `src/app/resumen_cierre/**` · `src/schemas/cierre.ts` · `api/cierre/[tiendaId]/summary/route.ts` |
| **F-037** | `src/app/ventas/**` · `api/venta/**/[ventaId]/**` (los dos DELETE y la devolución) · `src/lib/ventaMapper.ts` |
| **F-038** | `src/lib/tiendaOnline/**` · `src/components/tiendaOnline/**` · `src/schemas/tiendaOnline.ts` · `src/constants/tiendaOnline.ts` |
| **F-039** | `src/lib/reports/**` · `src/app/reportes/**` |

`src/constants/routeGuards/routeGuards.json` lo tocan varios: cada uno **solo añade sus propias
filas**. El censo de `src/__tests__/routeGuardInventory.test.ts` compara los pares (ruta, verbo)
contra el árbol en disco **exactamente**: sobra o falta uno y la suite cae.

---

## 10. Los ADR que hay que emitir

Los escribe el `arch-guardian` durante el pipeline; aquí solo quedan declarados para que ninguno se
olvide.

| Feature | ADR | Debe contener |
|---|---|---|
| F-031 | El crédito es una columna, no una línea de pago | La invariante, las cuatro razones del §2, las reglas duras, y **por qué la caja sigue cuadrando sola** (§3) — para que nadie lo «arregle» |
| F-032 | La ecuación de reconciliación de caja | La fórmula del §8 y las dos trampas del §7 |
| F-038 | `CREDITO` como tercer método del `DELIVERED` | **Enmienda** el 0073 (su frase «un solo método para el importe completo» sobrevive: `CREDITO` sigue siendo un método para el importe entero) y **reafirma** 0071 y 0072. Incluye la alternativa descartada —crear la venta en `IN_TRANSIT`— con sus dos razones, y la salida real si el `DELIVERED` prematuro molestara: pedirle a QAB un `HANDED_TO_COURIER` por la vía de `.agents/solicitudes-qab.md`, no mover la venta |

---

## 11. Errores conocidos que aplican

Abre la ficha antes de tropezar con ella, no después.

| Ficha | Por qué aplica aquí |
|---|---|
| [E-008](errors/E-008-datos-de-prueba-que-no-discriminan.md) | Un dato de prueba que pasa igual con el código roto no prueba nada. Es el criterio de contar 1.000 en vez de 1.300, y el de los cuatro tipos de movimiento de saldo |
| [E-011](errors/E-011-medir-el-contenedor-equivocado-de-mui.md) | **Tres apariciones.** Medir el contenedor equivocado de MUI. Aplica al botón del checkout y a las celdas del cierre: mide el elemento que *es* el botón |
| [E-013](errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) | Una columna que nadie escribe usada como señal de estado. El chip de «venta a crédito» debe leer un campo explícito, nunca deducirse de una resta |
| [E-014](errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) | Una señal derivada cuya definición se parafrasea. Los tramos de antigüedad se definen **una vez** |
| [E-015](errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) | Un símbolo en un `.tsx` no es importable desde un test. Toda la lógica pura va en `.ts` |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Un criterio que exige una subcadena que el copy no tiene. Aplica al copy de `PedidoPagoFields` y a las notas del desglose de caja |
| [E-018](errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md) | La redacción congelada de un criterio ya cerrado. F-038 cambia el copy de `PedidoPagoFields`, pero **no puede reescribir** los `acceptance_criteria` de F-014 que se verificaron contra él: la regla del backlog lo prohíbe |
| [E-019](errors/E-019-it-each-con-un-simbolo-que-aun-no-existe.md) | Un `it.each` con un símbolo inexistente tumba el archivo entero en silencio |
| [E-023](errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md) | Medir un plan sobre una tabla sin filas. Aplica a los índices de `CuentaPorCobrar` |
| [E-024](errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md) | `createMany({skipDuplicates:true})` conserva en silencio la fila vieja, y el desglose acaba describiendo otro período. Aplica al recrear `ResumenMonedaCierre` ahora que también lo alimentan los abonos |
| [E-026](errors/E-026-la-suite-en-verde-no-implica-tsc-limpio.md) | Suite en verde no implica `tsc` limpio |
| [E-027](errors/E-027-medir-un-componente-de-mui-a-media-transicion.md) | Medir MUI a media transición. El bottom sheet del selector de cliente |
| [E-032](errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) | Una guarda más ancha que el caso es una rama que nadie prueba. Por eso no hay «crédito con vuelto» y no se toca el umbral del efectivo remanente |
| [E-033](errors/E-033-es-es-no-agrupa-los-millares-de-cuatro-digitos.md) | `es-ES` no agrupa millares de 4 dígitos |
| [E-034](errors/E-034-el-cache-de-turbopack-sobrevive-al-reinicio.md) | El caché de Turbopack sobrevive al reinicio: `rm -rf .next` |
| [E-036](errors/E-036-strict-false-rompe-el-estrechamiento-por-booleano.md) | `strict:false` rompe el estrechamiento por booleano |
| [E-038](errors/E-038-el-p2002-no-se-recupera-dentro-de-la-transaccion.md) | Un `P2002` no se recupera dentro de la misma transacción. Aplica al claim de idempotencia del abono |
| [E-043](errors/E-043-una-columna-unique-global-usada-para-idempotencia-es-un-eje-de-tenant.md) | Una columna `@unique` global usada para idempotencia es un eje de tenant. **Por eso el alta de cliente offline reutiliza `@@unique([nombre, negocioId])` en vez de abrir un segundo eje** |
| [E-045](errors/E-045-el-exit-code-de-un-pipe-no-es-el-del-comando.md) | El exit code de un pipe no es el del comando: `npm run lint` se corre **solo** |
| [E-047](errors/E-047-un-replace-sobre-la-linea-ancla-borra-el-import-vecino.md) | Un `replace` sobre la línea-ancla borra el import vecino. Aplica a toda edición con script sobre muchos archivos: los cuatro mapas paralelos de `movimientos.ts`, los cuatro llamadores del gate de borrado, el cableado de los cinco permisos. **Insertar antes de la línea, no sustituirla** |
| [E-059](errors/E-059-la-tabla-de-monedas-no-contiene-la-moneda-base.md) | **Tres apariciones.** `NegocioMoneda` no contiene la moneda base: la lista de monedas se construye con `useMonedaOptions`/`buildMonedaOptions` |

Y el que gobierna este archivo: [E-001](errors/E-001-rutas-de-maquina-en-archivos-compartidos.md) — **ningún archivo de `.agents/` puede contener
una ruta del sistema de archivos de una máquina concreta.** Todo lo de aquí es relativo a la raíz
del repositorio.
