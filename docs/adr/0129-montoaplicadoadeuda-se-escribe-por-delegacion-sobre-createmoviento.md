# ADR 0129: `montoAplicadoADeuda` se escribe por delegación sobre `CreateMoviento`

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-035

## Contexto

`MovimientoStock.montoAplicadoADeuda` (`prisma/schema.prisma:719`) existe desde F-029/F-030, y el
motor de caja ya la **lee**: `refundCashRatio` (`src/lib/movimiento/caja.ts`) deriva de ella la
fracción del reembolso que salió de la gaveta, y `applyComprasYDevolucionesToResumenMap` la aplica
sobre `totalEfectivo` y `equivalenteBase`.

**Nadie la escribe.** Verificado:

- `movimientoCreateSchema` (`src/schemas/movimiento.ts:121`) declara `montoReembolso` y no declara
  este campo.
- `CreateMoviento` (`src/lib/movimiento/index.ts`) arma el `movimientoStock.create` con
  `...(tipo === "DEVOLUCION_VENTA" && montoReembolso !== undefined && { montoReembolso })` y nada
  más.
- La ruta de devolución (`api/venta/[tiendaId]/devolucion/[ventaId]/route.ts`) no llama a
  `splitRefundBetweenDebtAndCash` en ningún punto.

Es el caso de libro de E-013 al revés: **el consumidor está en producción y el productor no existe**.
Mientras siga así, los criterios 9 y 10 de F-035 son inalcanzables.

Y ninguna fila del mapa de propiedad del dosier (§ 9) asigna `src/schemas/movimiento.ts` ni
`src/lib/movimiento/index.ts` a ningún feature del epic.

## Decisión

**La ruta de devolución de F-035 es quien escribe la columna, y para llegar hasta ella se edita
`IMovimientoCreate`/`CreateMoviento` por delegación escrita a F-035.** Dos añadidos, los dos
aditivos y opcionales:

1. `movimientoCreateSchema` gana `montoAplicadoADeuda: z.number().nonnegative().finite().optional()`,
   junto a `montoReembolso` y con el mismo comentario de alcance («solo `DEVOLUCION_VENTA`»).
2. `CreateMoviento` lo propaga con la misma forma que su vecino:
   `...(tipo === "DEVOLUCION_VENTA" && montoAplicadoADeuda !== undefined && { montoAplicadoADeuda })`.

Es el criterio que el dosier ya sentó para un archivo sin dueño al que un feature está bloqueado
(ADR 0114), y el precedente concreto es F-032 editando dos archivos de F-029 por delegación escrita
(ADR 0111).

**Quién decide el reparto no cambia:** `splitRefundBetweenDebtAndCash`
(`src/lib/cuentasPorCobrar/refundSplit.ts`, F-029) es la única función que lo decide, y este ADR no
reenuncia su regla — está escrita en su docstring, con su ejemplo trabajado, y parafrasearla aquí
sería E-039. La ruta la llama con `(montoReembolso, saldoPendiente)` y usa las dos mitades del
resultado.

Reglas de escritura, que son donde está el detalle:

- **El campo se omite cuando la parte aplicada a deuda es 0.** Así la columna se queda `NULL`, que
  es lo que `refundCashRatio` interpreta como «bajó la gaveta entera» y lo que tiene toda fila
  anterior a la columna. Es lo que hace que el criterio 11 —la devolución al contado se comporta
  **exactamente** como hoy— sea cierto por construcción y no por coincidencia numérica.
- **La puerta del libro se llama solo si la parte aplicada es > 0.** `decideMovimientoCuentaPorCobrar`
  rechaza `MONTO_NO_POSITIVO`, así que llamarla con 0 convertiría toda devolución al contado en un
  400.
- **La bajada del saldo es un `AJUSTE_DEVOLUCION` nuevo**, insertado con
  `applyMovimientoCuentaPorCobrar` en la **misma** transacción que el `MovimientoStock`, nunca un
  `UPDATE` de `saldoPendiente`. Como la fila lleva `fecha`, `totalPorCobrarAlCierre` baja por la
  parte aplicada a deuda en el período en que la devolución ocurre.
- **`Venta.creditoBase` no se toca en una devolución.** La devolución no modifica el total de la
  venta —hoy tampoco lo hace—, así que tampoco modifica su crédito: lo que cambia es el saldo del
  libro. Es la diferencia con el borrado de un producto (ADR 0128), donde el total sí baja.

### Por qué la columna y no reducir `montoReembolso`

Está decidido en el `notes` del backlog y aquí queda el porqué: reducir `montoReembolso` dejaría la
caja bien y la **ganancia mal**. `calcularTotalesMovimientosPeriodo` y la rama `DEVOLUCION` de
`gananciaDeducciones` derivan el margen revertido de `montoReembolso − costoTotal`, y revertir una
venta revierte su margen completo **sin importar cómo se saldó**. Con la columna aparte, esos dos
sitios no cambian una línea y solo los dos de caja restan el campo nuevo.

Las tres cifras del criterio 10 cuadran por eso, y cuadran así:

| Cifra | Qué le pasa | Por qué |
|---|---|---|
| `totalDevoluciones` (ganancia) | reembolso completo menos costo | el margen no depende de la forma de saldo |
| Caja del período | baja solo por la parte en efectivo | `refundCashRatio` la deriva de la columna |
| `totalPorCobrarAlCierre` | baja por la parte aplicada a deuda | el `AJUSTE_DEVOLUCION` está fechado en el log |

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reducir `montoReembolso` por la parte aplicada a deuda | Rompe la reversión del margen en dos sitios que hoy no se tocan, y hace que la ganancia dependa de cómo se cobró la venta |
| Escribir `0` en la columna cuando no hay deuda | Es indistinguible de `NULL` para `refundCashRatio`, pero convierte «esta venta no tenía crédito» en «esta venta tenía crédito y no se aplicó nada». El criterio 11 mide exactamente esa diferencia |
| Que la ruta escriba el `movimientoStock` a mano, sin pasar por `CreateMoviento` | Duplica el cálculo de existencias, del kardex y del CPP para ahorrarse dos líneas en un archivo ajeno |
| Un helper propio de F-035 que envuelva `CreateMoviento` y haga el `update` después | Dos escrituras donde cabe una, y una ventana en la que la fila existe sin su reparto |
| Esperar a que un feature futuro se declare dueño de `src/lib/movimiento/**` | Bloquea F-035 indefinidamente por una cuestión de reparto, y F-035 tiene que ir en el mismo tren de despliegue que F-032 |

## Consecuencias

**A favor:**
- El productor de la columna existe y está en el único sitio que sabe si hay deuda.
- Los dos motores que no debían cambiar (`calcularTotalesMovimientosPeriodo` y la rama
  `DEVOLUCION` de `gananciaDeducciones`) siguen intactos.
- El caso al contado no pasa por ninguna rama nueva: sin deuda no se llama a la puerta y no se
  escribe el campo.

**En contra / coste asumido:**
- Dos archivos sin dueño quedan editados por F-035. El contrato los nombra y dice exactamente qué
  se les añade; quien reclame su propiedad después hereda esas dos líneas.
- `movimientoCreateSchema` gana un campo que solo tiene sentido para un tipo de movimiento. Ya
  ocurre con `montoReembolso`, `formaPago` y `montoEfectivoCaja`: la forma se mantiene, no se
  arregla de paso.

**Impacto en seguridad y escalabilidad:**
- La cuenta se resuelve a través de la `Venta` que la ruta ya validó contra `negocioId`; ningún eje
  nuevo de tenant.
- El lock de fila de la cuenta ocurre dentro de la transacción que la clave de idempotencia ya
  reclamó, así que dos devoluciones concurrentes sobre la misma venta se serializan en la cuenta y
  no pueden repartir dos veces el mismo saldo.
- Una lectura y una inserción más por devolución, con la cuenta en relación `@unique` por venta.
