# ADR 0131: El crédito es un campo **obligatorio** de la venta normalizada, y se comprueba **antes** de la rama legado

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-037 (el crédito en los reportes de operación y rentabilidad)
**Se apoya en:** [ADR 0104](0104-el-credito-es-una-columna-no-una-linea-de-pago.md) ·
[ADR 0089](0089-el-envio-se-lee-del-pedido-y-viaja-en-la-venta-normalizada.md) ·
[E-013](../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) ·
[E-047](../../.agents/errors/E-047-un-replace-sobre-la-linea-ancla-borra-el-import-vecino.md)

## Contexto

El ADR 0104 sacó el crédito de `pagosDetalle` y lo puso en su propia columna, `Venta.creditoBase`.
La consecuencia en los reportes no se había mirado hasta ahora, y es un fallo que no produce ningún
error.

`createPaymentMixAggregator` (`src/lib/reports/aggregators/payment-mix.ts`) construye el mix de
formas de pago recorriendo `sale.payments`, que `normalizeSale` arma desde `venta.pagosDetalle`
(`sales-stream.ts:408`). Una venta a crédito no tiene líneas de pago, así que **el mix suma menos
que las ventas netas del período** y los porcentajes de participación se calculan sobre una base
equivocada. No hay excepción, no hay aviso, y la cifra se queda más corta cuanto más fía el negocio.

Hay un segundo síntoma, menos visible y más engañoso. La primera comprobación del agregador es:

```ts
if (sale.payments && sale.payments.length > 0) { ... }
```

Una venta 100 % a crédito persiste `pagosDetalle: []` —**array vacío, no `null`**: el schema lo
permite solo cuando `creditoBase > 0`—, así que esa condición es falsa y la venta cae en la rama
«venta legado, reconstruir desde `totalcash`/`totaltransfer`». Como esos dos campos también valen 0,
`add()` sale en su primera línea (`if (montoOriginal <= 0) return`) y no suma nada. Pero
**`ventasEstimadas` sí se incrementa**, así que la pantalla avisa de «N venta(s) no tienen desglose
de pagos registrado» sobre una venta cuyo desglose está completo: entero en crédito.

Queda una tercera cuestión, la que el spec dejó explícitamente abierta: si el campo nuevo de
`NormalizedSale` debe ser obligatorio u opcional. Dos archivos de tests —
`src/__tests__/summaryEnvioTiendaOnline.test.ts` y `src/__tests__/salesSummaryTiendaOnline.test.ts`—
construyen `NormalizedSale` como literales completos, así que la respuesta decide si
`npx tsc --noEmit` sirve de red para el criterio de no-regresión del feature o no sirve de nada.

## Decisión

**`NormalizedSale.creditAmount: number`, obligatorio, leído de `Venta.creditoBase`; el mix gana una
fila sintética `credito` en moneda base; y la existencia de crédito se comprueba ANTES de decidir si
una venta es legado.**

### El campo

- Nombre `creditAmount`, que es el que el dosier del epic propuso y el que `src/app/pos/**` ya usa
  para el mismo concepto desde F-032. Un sinónimo nuevo sería una segunda palabra para un hecho que
  ya tiene la suya.
- **Obligatorio.** `Venta.creditoBase` es `Float @default(0)` y no es nullable: no existe el estado
  «ausente», y un campo opcional lo inventaría. Con `strict: false` (E-036) ese `undefined` no se
  estrecha de forma fiable y acabaría como un `?? 0` repetido en cada consumidor, que es justo el
  molde de E-013 —una señal que cada lector interpreta por su cuenta—. Y, decisivo: obligatorio
  **rompe la compilación** de los dos archivos de fixtures hasta que alguien les añada
  `creditAmount: 0`, convirtiendo `npx tsc --noEmit` en la confirmación gratuita de que se revisaron.
- **Leído, nunca derivado.** No se calcula como `netAmount − Σ pagos`. El caso que lo demuestra no
  es hipotético: un pedido de tienda online entregado a crédito (ADR 0130) tiene `creditoBase`
  = mercancía + envío, mientras que `netAmount` se arma solo de las líneas, que no llevan el envío
  (ADR 0089). Para una mercancía de 1.000 con 50 de envío, restar da 1.000 y leer da 1.050.
- **No hay que tocar la consulta.** `streamNormalizedSales` usa `include`, no `select`, y un
  `include` devuelve todos los escalares de `Venta`. La columna ya llega. Cero coste añadido.

### La fila del mix

- `tipo: PAYMENT_MIX_CREDIT_TYPE` (`"credito"`), constante en `src/constants/reportes.ts`. Es una
  **fila de reporte**, no un método de pago: `pagoLineaSchema` se queda con dos valores. No hace
  falta cambiar ningún tipo, porque `PaymentMixRow.tipo` ya es `string` y
  `paymentMixRowSchema.tipo` ya es `z.string()`; lo único que había de falso era el JSDoc
  `/** "cash" | "transfer" */`, que se corrige.
- **En moneda base**, con `montoOriginal === montoBase === creditAmount`. El crédito no tiene moneda
  física, pero sí tiene unidad: la deuda se denomina en moneda base por decisión cerrada del epic, y
  eso es lo que `creditoBase` contiene. Es una afirmación verdadera, no un relleno.
- Una sola fila por reporte, clave `credito::<monedaBase>`, `estimado: false` siempre —la cifra se
  lee, no se reconstruye—, y `transacciones` contando las ventas con `creditAmount > 0`.
- `totalBase` la incluye, porque el criterio 2 exige que los porcentajes sumen 100 sobre una base que
  contenga el crédito. Lo que eso le hace a la tarjeta «Total cobrado» se resuelve en el
  [ADR 0132](0132-total-cobrado-deja-de-incluir-el-credito-y-la-base-del-porcentaje-no-se-parte.md).

### El orden

1. Si `creditAmount > 0`, añadir la fila de crédito.
2. Si `payments` no está vacío, recorrerlo y `return` (rama existente, intacta).
3. Si `creditAmount > 0`, `return` — **antes** de `ventasEstimadas += 1`.
4. Rama legado, intacta.

Las dos guardas son **literalmente `creditAmount > 0`**. No `!== 0`, no `Math.abs(...) > EPS`:
`creditoBase` es no negativo (`z.number().nonnegative()`, `src/schemas/venta.ts:66`), así que
cualquier formulación más ancha abre una rama que ningún criterio recorre y que nadie probará
(E-032). Los pasos 2 y 4 se conservan carácter a carácter; se insertan líneas alrededor y no se
sustituye ninguna (E-047).

El paso 3 es la corrección del segundo síntoma: **una venta sin líneas de pago pero con crédito no
es una venta legado**, su desglose está completo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Campo opcional con default 0 en cada consumidor | Los dos archivos de fixtures compilarían sin tocarse y se perdería la única señal barata de no-regresión que tiene el criterio 7. Además obliga a verificar aparte que la ausencia se trata como 0 en todos los consumidores, no solo en el mix |
| Deducir el crédito como `netAmount − Σ pagos` | E-013, y falso: un pedido online a crédito cobra envío que las líneas no llevan, así que la resta da otra cifra. Es exactamente lo que el criterio 3 discrimina |
| Un tercer valor en `pagoLineaSchema.tipo` | Lo prohíbe el ADR 0104 con cuatro razones, y rompería el cuadre de caja del producto entero |
| Mover la comprobación de crédito dentro de la rama legado | Funciona para el mix, pero deja `ventasEstimadas` contando la venta a crédito como venta sin desglose. Un arreglo a medias de dos síntomas que tienen la misma causa |
| `moneda: null` o un guion para la fila de crédito | `moneda` es `z.string()` no anulable y forma parte de la clave de fila y de la exportación a Excel. Cambiar su tipo afectaría a las dos tablas y a consumidores que no son de este feature, para expresar algo que la moneda base ya expresa correctamente |
| Una fila de crédito por moneda de cobro de la venta | El motor no guarda ningún desglose por moneda del crédito, y `creditoBase` está en base. Repartirlo por `monedaCobro` afirmaría una precisión que el dato no tiene — el mismo argumento del ADR 0124 |

## Consecuencias

**A favor:**

- El mix deja de sumar de menos, y los porcentajes se calculan sobre las ventas netas reales.
- El aviso de «ventas sin desglose» deja de señalar ventas cuyo desglose está completo.
- Un test unitario, sin base de datos, distingue leer el campo de deducirlo: el caso de 1.050 contra
  1.000 del pedido online entregado a crédito.
- `npx tsc --noEmit` queda como red permanente: cualquier `NormalizedSale` construido a mano en el
  futuro tiene que decir qué hace con el crédito.

**En contra / coste asumido:**

- Dos archivos de tests ya existentes dejan de compilar hasta que se les añada una línea. Es
  deliberado y es la mitad del valor de la decisión.
- `ventasEstimadas` cambia de valor para períodos con ventas a crédito. Es una corrección, pero un
  informe guardado de antes del feature puede mostrar otro número para el mismo período.
- La fila `credito` aparece bajo una cabecera de columna que hoy dice «Monto cobrado», y para esa
  fila no se cobró nada. Es el criterio 8 y lo resuelve el `ui-designer`; este ADR solo garantiza que
  el dato y el ancla existen.

**Impacto en seguridad y escalabilidad:**

- **Cero consultas nuevas.** El campo viaja dentro de filas que el `include` ya devolvía, bajo el
  mismo `where` filtrado por `tiendaId`. Ni una columna más, ni un `join` más, ni una pasada más
  sobre el stream.
- **Aislamiento intacto.** No hay ninguna ruta de acceso nueva: `scope.tiendaId` lo resuelve
  `resolveReportScope`, que para todo rol distinto de `SUPER_ADMIN` exige que la tienda pertenezca
  al usuario. El crédito no abre ningún filtro.
- No se expone ninguna identidad de deudor: la fila es un agregado de dinero del período.
