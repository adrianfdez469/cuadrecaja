# ADR 0135: El ajuste de un borrado descuenta del crédito primero, y los ratios se calculan sobre lo pagado

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-037

## Contexto

`api/venta/[tiendaId]/[cierreId]/[ventaId]/producto/[ventaProductoId]/route.ts` reparte hoy el
ajuste de un borrado de producto proporcionalmente entre efectivo y transferencia (líneas 230-234):

```ts
const totalAnterior = Number(v!.total);
const ratioCash = totalAnterior > 0 ? Number(v!.totalcash) / totalAnterior : 0;
const ratioTransfer = totalAnterior > 0 ? Number(v!.totaltransfer) / totalAnterior : 0;
```

Con crédito, `totalcash + totaltransfer` ya no es `totalAnterior` —falta `creditoBase`—, así que los
dos ratios no suman 1 y `totalcash` sale **inflado**. Con la venta del criterio 8 (total 1.000, 600
en efectivo, 400 a crédito, se borra un producto de 300) el código actual dejaría
`totalcash = 700 × 0,6 = 420`: 180 de efectivo aparecidos de la nada en una gaveta que nadie tocó.

El criterio 8 fija el resultado correcto con cifras exactas y vinculantes: **el crédito baja a 100 y
el efectivo no se mueve.**

## Decisión

**El ajuste se descuenta primero del crédito; solo el remanente llega a los pagos; y los ratios se
calculan sobre lo efectivamente pagado, `total − creditoBase`, nunca sobre el total.**

El reparto es una **función pura** —`splitAjustePorBorrado`, en
`src/lib/cuentasPorCobrar/ventaAjusteBorrado.ts`— y no aritmética suelta dentro de la ruta: es lo
que permite verificar las cifras del criterio 8 sin base de datos (E-015), y lo que impide que el
caso sin crédito derive del de hoy.

Con `neto = precio del producto borrado − lo que el descuento deja de cubrir`, todo en moneda base:

```
ajusteCredito     = neto > 0 ? min(neto, creditoAnterior, saldoPendiente) : 0
remanenteBase     = neto − ajusteCredito
nuevoCredito      = creditoAnterior − ajusteCredito
pagadoAnterior    = totalAnterior − creditoAnterior          <- EL DENOMINADOR
ratioCash         = pagadoAnterior > 0 ? totalcash / pagadoAnterior : 0
ratioTransfer     = pagadoAnterior > 0 ? totaltransfer / pagadoAnterior : 0
nuevoPagado       = max(0, pagadoAnterior − remanenteBase)
nuevoTotalcash    = max(0, nuevoPagado × ratioCash)
nuevoTotaltransfer= max(0, nuevoPagado × ratioTransfer)
nuevoTotal        = max(0, totalAnterior − neto)
```

Y el ajuste de `pagosDetalle` (paso 5 de la ruta) pasa a descontar **`remanenteBase`**, no `neto`:
si el crédito absorbió el ajuste entero, la única línea de pago no se toca.

Tres propiedades que hay que conservar y que son la razón de la forma:

1. **La venta sigue cuadrando:** `nuevoTotalcash + nuevoTotaltransfer + nuevoCredito = nuevoTotal`.
   Con el criterio 8: `600 + 0 + 100 = 700`.
2. **Sin crédito, el resultado es bit a bit el de hoy.** Con `creditoAnterior = 0`,
   `pagadoAnterior = totalAnterior`, los dos ratios son los actuales, `remanenteBase = neto` y
   `nuevoPagado = totalAnterior − neto = nuevoTotal`: la misma multiplicación que ya se hace. Se
   comprueba también con el `neto` negativo (un descuento que se encoge y sube el total), donde el
   `max(0, …)` no recorta nada en ninguna de las dos versiones.
3. **La deuda no se escribe a mano.** `nuevoCredito` se persiste en `Venta.creditoBase`, y la bajada
   del saldo se aplica insertando un `AJUSTE_DEVOLUCION` de `ajusteCredito` con
   `applyMovimientoCuentaPorCobrar` —la única puerta de escritura (F-031)— dentro de la **misma**
   transacción. El libro es append-only: nunca se hace un `UPDATE` de `saldoPendiente` ni de
   `montoOriginal`, y ese `montoOriginal` se queda en su valor original a propósito, porque es
   «`Venta.creditoBase` en el momento del alta» y eso ya ocurrió.

El tercer argumento del `min`, `saldoPendiente`, no es decorativo: la puerta rechaza con
`SALDO_INSUFICIENTE` un movimiento por encima del saldo, y con `MONTO_NO_POSITIVO` uno de cero. De
ahí la regla del contrato: **la puerta se llama solo si `ajusteCredito > 0`.**

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reparto proporcional entre efectivo, transferencia y crédito | Le saca dinero de la gaveta a una venta cuyo dinero no está en la gaveta. Con el criterio 8 dejaría el efectivo en 420 y el crédito en 280: el cajero cuadra a mano una caja que estaba cuadrada |
| Ratios sobre el total, corrigiendo `totalcash` después | Dos verdades sobre el mismo número en el mismo `update`; la segunda gana por accidente de orden |
| Mutar `CuentaPorCobrar.saldoPendiente` (y `montoOriginal`) directamente | Rompe la idempotencia del recálculo de los cierres cerrados, que recomputan el saldo como «movimientos con `fecha <= fechaFin`» (dosier § 5) |
| Reutilizar `splitRefundBetweenDebtAndCash` para este reparto | Contesta otra pregunta: reparte un **reembolso** entre deuda y gaveta. Aquí no se devuelve dinero, se corrige el importe de una venta, y el remanente no se entrega: se descuenta de una línea de pago ya cobrada |
| Bloquear el borrado de productos en toda venta a crédito y no repartir nada | Es lo que el ADR 0133 descarta: hace inalcanzable el criterio 8 |

## Consecuencias

**A favor:**
- Las cifras del criterio 8 salen exactas y son verificables sin base de datos.
- El camino sin crédito no cambia, y eso se puede demostrar con un test de la función pura, no solo
  con una devolución de punta a punta.
- El saldo del cliente y el importe de la venta dejan de poder desincronizarse por esta vía, que es
  el agujero que F-034 destapa.

**En contra / coste asumido:**
- Un borrado de producto sobre una venta a crédito deja una fila `AJUSTE_DEVOLUCION` cuyo `motivo`
  habla de un borrado, no de una devolución. El enum de la base tiene cuatro valores y no se amplía
  por esto: un quinto tipo obliga a decidir su signo, su tratamiento en caja y su fila en cuatro
  mapas paralelos, para distinguir dos hechos que mueven el saldo igual.
- `CuentaPorCobrar.montoOriginal` puede quedar por encima de `Venta.creditoBase` tras un borrado.
  Es correcto —uno es historia, el otro es el estado— pero es una diferencia que sorprende a quien
  compare las dos columnas.

**Impacto en seguridad y escalabilidad:**
- Todo ocurre dentro de la transacción que ya existía, con el `VentaProducto` bloqueado por
  `lockExistingRow` y la cuenta por el lock de fila de la propia puerta.
- Ninguna consulta nueva sale del tenant: la cuenta se alcanza por la `Venta` que la ruta ya validó
  contra `negocioId`.
- Coste constante: una fila leída y una insertada por borrado.
