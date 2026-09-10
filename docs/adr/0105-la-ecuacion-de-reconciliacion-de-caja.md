# ADR 0105: La ecuación de reconciliación de caja

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-030 (y gobierna la lectura del cierre para todo el epic de cuentas por cobrar)

> **Este es el documento que hay que abrir cuando alguien diga «la caja no cuadra».** Está escrito
> para quien no vivió el epic de cuentas por cobrar: no hace falta haber leído ningún otro ADR para
> usarlo. El único que conviene tener a mano es el [ADR 0104](0104-el-credito-es-una-columna-no-una-linea-de-pago.md),
> que explica **dónde vive el crédito**; este explica **por qué la gaveta sigue cuadrando aunque el
> total de ventas ya no diga cuánto dinero entró**.

## Contexto

Hasta que existió el crédito, el cuadre de caja se podía hacer de cabeza: todo lo que se vendía se
cobraba en el acto, así que el efectivo esperado en la gaveta era «lo que se vendió en efectivo,
más el fondo inicial, menos lo que salió». Un cajero que contaba los billetes y le daba un número
distinto al de la pantalla sabía que faltaba o sobraba dinero de verdad.

Las ventas a crédito rompen esa lectura **en las dos direcciones a la vez**, y ninguna de las dos
es un error:

- **Una venta a crédito sube el total de ventas sin subir el efectivo.** La mercancía salió y el
  negocio reconoce la venta y su ganancia el mismo día (es una decisión de producto, no un detalle
  técnico), pero el dinero no entró.
- **Un cobro de una deuda vieja sube el efectivo sin subir el total de ventas.** El billete está
  en la gaveta hoy, pero la venta que lo originó se contabilizó en otro período, quizá semanas
  antes.

Quien mire solamente «total de ventas» contra «efectivo contado» va a ver un descuadre las dos
veces, y las dos veces la caja está perfecta. El riesgo real no es que la pantalla mienta: es que
**alguien la corrija a mano**. Un cajero que resta el crédito de la gaveta para que le dé la cuenta
descuadra lo que estaba cuadrado, y a partir de ahí ya nadie sabe cuál de los dos números era el
bueno.

Hacía falta, entonces, una identidad escrita: **exactamente qué términos tienen que sumar el
efectivo esperado**, de dónde sale cada uno, y qué NO hay que restar.

Restricciones del código que la ecuación tiene que respetar, todas verificadas leyéndolo:

- `buildResumenMonedas` (`src/lib/movimiento/caja.ts`) arma la caja del período **iterando
  `pagosDetalle` y `vueltoDetalle`** de cada venta. No mira `Venta.total` ni `Venta.totalcash`.
- Como el crédito no es una línea de `pagosDetalle` (ADR 0104), **una venta a crédito no aporta
  nada a la gaveta sin que nadie toque el motor de caja**. Eso es un activo, no una casualidad.
- Los cobros posteriores (`MovimientoCuentaPorCobrar` de tipo `ABONO`) llevan un `pagosDetalle`
  **con la misma forma** que el de una venta, así que entran a la gaveta **por la misma función**:
  hay una sola definición de «qué es dinero en gaveta» para una venta y para un cobro.
- El motor de cierre (`src/lib/cierre/computeCierreTotals.ts`) es el único sitio donde un período
  se convierte en cifras, y lo usan por igual el cierre, el recálculo, la vista en vivo del período
  abierto y el chequeo de desactualización del histórico (ADR 0036).

## Decisión

**El efectivo esperado de un período, expresado en moneda base, es exactamente esta suma de siete
términos, y ninguna pantalla la corrige a mano:**

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

Leída al revés, que es como se usa en soporte: **un cobro de deuda vieja sube el efectivo sin subir
`totalVentas`, y una venta a crédito sube `totalVentas` sin subir el efectivo.** Las dos cifras
nuevas del cierre —`totalCreditoOtorgado` y `totalCobrosCredito`— existen exactamente para
explicar esas dos direcciones, y `totalPorCobrarAlCierre` es la tercera: **cuánto le deben a la
tienda en ese instante**.

### De dónde sale cada término

| Término | Dónde está | Cuidado |
|---|---|---|
| `Σ resumenMonedas.equivalenteBase` | `ResumenMonedaCierre`, una fila por moneda; el JSON del GET del cierre lo trae en `resumenMonedas` | Es el lado izquierdo: **es lo que hay que explicar**, no un término más |
| `fondoInicial` | `resumenMonedas[*].initialFund` | Es un punto de partida, no un ingreso |
| `totalVentas` | Columna de `CierrePeriodo` | Incluye la venta a crédito **entera** |
| `totalCreditoOtorgado` | Columna de `CierrePeriodo` (nueva) | Se **resta** de `totalVentas` porque ese dinero no entró |
| `totalCobrosCredito` | Columna de `CierrePeriodo` (nueva) | Es de **este** período, aunque la deuda naciera en otro |
| `totalTips` | Columna de `CierrePeriodo` | La propina está físicamente en la gaveta hasta que se reparte, así que **suma** |
| `totalGastos(caja)` | **No es la columna `totalGastos`.** Ver «Las tres precisiones» | |
| `totalComprasCaja` | Columna de `CierrePeriodo` | Solo la parte pagada con efectivo de la caja (una compra `MIXTO` aporta su porción, una `EXTERNO` nada) |
| `reembolsosEnEfectivo` | **No tiene columna.** Ver «Las tres precisiones» | |

`totalPorCobrarAlCierre` **no aparece en la ecuación**, y no es un olvido: es un **stock**, no un
flujo. Es el saldo vivo de la tienda en el instante del corte, de todos los períodos juntos; no
pertenece a la caja de ninguno y **nunca se suma entre períodos**.

### Las tres precisiones sin las que la ecuación no cuadra

Son la parte que se olvida, y las tres nacen de cómo está escrito el motor hoy. Quien haga la
cuenta a mano contra el JSON del cierre necesita las tres.

1. **`totalGastos(caja)` no es la columna `totalGastos`.** La columna suma solo los gastos de
   naturaleza `OPERATIVO`, porque es la que reduce la ganancia. De la **gaveta** salen **todos**
   los gastos del período, sea cual sea su naturaleza. El término de la ecuación es la suma de
   todos ellos convertida a base; en el JSON del cierre está desglosado en `cajaDeducciones`, con
   una entrada de tipo `GASTO` por gasto.

2. **`reembolsosEnEfectivo` no es `totalDevoluciones`.** `totalDevoluciones` es una cifra de
   **margen** (`montoReembolso − costoTotal`): sirve para la ganancia, no para la caja. Lo que sale
   de la gaveta por una devolución es `montoReembolso` **menos la parte que se aplicó a la deuda
   del cliente** (`MovimientoStock.montoAplicadoADeuda`). Si una devolución se aplicó entera contra
   la deuda, **la caja no baja nada** y la ganancia sí. En el JSON está desglosado en
   `cajaDeducciones`, con una entrada de tipo `DEVOLUCION` por devolución — y **esa entrada ya trae
   restada la parte que fue a la deuda**: es lo que salió de la gaveta, no el reembolso completo, así
   que se suma tal cual y no hay que descontarle nada más. La devolución aplicada entera contra la
   deuda aparece ahí en **0**. La entrada del mismo nombre en `gananciaDeducciones` es otra cosa —el
   margen— y esa sí lleva el reembolso completo menos el costo.

3. **La igualdad es exacta solo mientras cada venta tenga su desglose de pagos.** Una venta cuyo
   `pagosDetalle` sea nulo —las anteriores a que existiera el desglose multimoneda, y cualquiera
   que se haya escrito sin él— **suma a `totalVentas` y aporta cero a la gaveta**, así que abre un
   hueco del importe exacto de esa venta. Y `totalVentas` se recalcula desde las líneas de
   producto, no desde `Venta.total`: la ecuación es exacta en la medida en que esos dos números
   coincidan, que es lo que la ruta de venta impone al crearla y lo que vigila la señal de
   «totales desactualizados» del histórico.

Fuera de esas tres, la única diferencia que puede aparecer es de **céntimos**, por redondeo:
`totalTips` se redondea a dos decimales y el resto de los términos no.

### Las dos trampas que hay que dejar escritas en el código

Las dos están en el camino que calcula `totalPorCobrarAlCierre`, y las dos producen números
plausibles. Ninguna da error.

**Trampa 1 — el filtro de cuentas abiertas al corte.** Las cuentas que estaban vivas en el instante
del corte se cargan así:

```
where: {
  tiendaId,
  fechaVenta: { lte: corte },
  OR: [{ settledAt: null }, { settledAt: { gt: corte } }],
}
```

Ese `OR` **no es redundante**, aunque lo parezca. Una cuenta que se saldó **después** del corte
estaba abierta **en** el corte. Si alguien lo «simplifica» a `settledAt: null` a secas —que es más
corto, parece más limpio y pasa el caso obvio de un período recién cerrado—, entonces **toda deuda
ya cobrada desaparece del recálculo de los períodos anteriores**, y el saldo histórico de todos
ellos se derrumba a cero a medida que los clientes van pagando. El comentario va **junto al
`where`**, no solo aquí, y F-030 lleva su propio criterio de aceptación cuyo único propósito es
atrapar esto.

**Trampa 2 — la antigüedad se mide contra el corte, nunca contra el reloj.** La función que arma el
panorama de antigüedad de las deudas recibe el instante contra el que medir (`fechaFin` del período,
o «ahora» mientras está abierto) y **no llama a `Date.now()`**. Con el reloj del sistema, recalcular
un cierre de hace tres meses daría antigüedades distintas cada vez que se ejecuta, y un recálculo
que no es reproducible no sirve para nada: es la misma razón por la que la deuda se denomina en
moneda base y no en divisa (ADR 0104).

### Corolario para la pantalla de cierre

**La línea «Ventas a crédito» del desglose por moneda tiene que llevar escrito que ese dinero no
entró a caja, en texto secundario, y no puede pintarse nunca con el rojo de una deducción.**

No es una preferencia estética. Una cifra pintada como deducción es una instrucción: le está
diciendo al cajero que la reste. Y si la resta, descuadra a mano lo que estaba cuadrado —el motor
de caja nunca la sumó— y después nadie sabe cuál de los dos totales era el correcto. La frase es lo
que convierte la línea de una resta en una explicación.

El cálculo del descuadre que ya existe en la pantalla (`desglose contado − totalEfectivo`)
**no se modifica**. Lo que faltaba ahí era explicarlo, no corregirlo.

### Corolario para el histórico

**Un abono registrado después de cerrar un período jamás modifica sus cifras.** Pertenece al
período que estaba abierto cuando ocurrió, y el motor lo asigna por su fecha. Además,
`totalPorCobrarAlCierre` de un período cerrado se recomputa como «los movimientos con fecha anterior
o igual al corte», así que un cobro posterior no entra en esa suma **sin importar cuándo se ejecute
el recálculo**. Cerrar, cobrar y recalcular tiene que devolver exactamente las mismas cifras que
había antes de cobrar, y el período no se marca como desactualizado.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Meter el crédito dentro de `pagosDetalle` para que la gaveta «cuadre sola» sin ecuación | Rompe el cuadre de caja del producto entero: `buildResumenMonedas` y `buildResumenPropinas` suman el equivalente en base **fuera** del `if` de tipo de pago, así que el crédito entraría a la vez como transferencia y como equivalente base, y la gaveta mentiría por el monto exacto del crédito. Es la decisión del [ADR 0104](0104-el-credito-es-una-columna-no-una-linea-de-pago.md) y no se reabre |
| Restar el crédito del efectivo esperado, para que el número de la pantalla vuelva a ser el ingenuo | El efectivo esperado ya es correcto: el crédito nunca se sumó. Restarlo lo dejaría en negativo por el monto del crédito, y el conteo físico dejaría de cuadrar de verdad |
| Guardar `totalPorCobrarAlCierre` como un flujo acumulable (el del período anterior, más lo otorgado, menos lo cobrado) | Un solo período mal cerrado desalinea toda la serie hacia adelante y nunca se autocorrige. Recalculado desde cero contra el corte, cada período se autocorrige en cada recálculo. Cuesta una consulta más por cierre y vale la pena |
| Persistir `totalGastos(caja)` y `reembolsosEnEfectivo` como columnas propias, para que los siete términos se lean enteros del JSON | Dos columnas denormalizadas más que mantener y que un recálculo puede desincronizar, a cambio de comodidad de lectura. Se descarta **por ahora**, con el coste asumido escrito abajo: dos de los siete términos hay que derivarlos de `cajaDeducciones` |
| Colgar cada abono de un `cierrePeriodoId` en vez de asignarlo por fecha | Sería una segunda representación del mismo hecho —la fecha ya lo dice— y podría desincronizarse de ella cuando un cierre se recalcula o se reabre |

## Consecuencias

**A favor:**

- Hay **una** identidad escrita contra la que verificar el cuadre, y un criterio de aceptación que
  la comprueba numéricamente en un período que tiene a la vez fondo inicial, ventas al contado, una
  venta a crédito, un abono, un gasto y una compra en efectivo.
- El motor de caja **no se tocó para que el crédito cuadrara**: la venta a crédito simplemente no
  aporta a la gaveta, y el cobro entra por la misma función que una venta. Cualquier corrección
  futura de esa función —una forma de pago nueva, otro redondeo— se aplica a ventas y a cobros sin
  que nadie tenga que acordarse de replicarla.
- El período abierto que ve el POS incluye los cobros, así que un vuelto legítimo deja de
  rechazarse por «no hay efectivo suficiente» y una compra en efectivo deja de marcarse como mixta
  sin motivo.
- Soporte tiene un documento que puede leer sin conocer el epic.

**En contra / coste asumido:**

- **Dos de los siete términos no son columnas** y hay que derivarlos del desglose
  (`cajaDeducciones`). Es el coste directo de no haber añadido dos columnas denormalizadas más.
- **La ecuación tiene tres precisiones**, y quien las ignore va a concluir que la caja no cuadra
  cuando cuadra. Están arriba porque son la parte que se olvida.
- El total de transferencias por destino **pasa a incluir los cobros por transferencia**, mientras
  que la columna `totalTransferencia` sigue siendo una cifra de ventas. A partir de aquí **las dos
  dejan de sumar lo mismo en cuanto haya un cobro por transferencia**, y es correcto: la tabla por
  destino es el arqueo contra el banco, y un cobro por transferencia sí llegó a la cuenta. Quien
  las pinte juntas tiene que rotularlas para que no parezca un error.
- La ecuación es una identidad **en moneda base**. Por moneda, cada fila cuadra con sus propios
  términos, pero un negocio que cobre una deuda en una divisa distinta de la de la venta verá el
  desglose por moneda moverse de forma que el total en base no explica por sí solo.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant.** Las consultas de deuda que alimentan la ecuación se acotan a **una
  tienda ya autorizada**: el cierre se carga con `{ id, tienda: { negocioId } }` antes de que
  ninguna de ellas se ejecute, y las cuentas cuelgan de `Tienda` por una relación directa que
  existe justo para que la cláusula de tenant sea un salto. Un cierre de otro negocio no llega a
  las consultas. F-030 lleva un criterio propio que lo comprueba **ejecutándolo**: sembrar una
  deuda y un cobro en otro negocio, con la misma fecha y el mismo corte, y confirmar que el JSON
  del cierre de la primera tienda no cambia byte a byte.
- **Invariante que el schema no impone.** `CuentaPorCobrar.tiendaId` tiene que ser el de la venta
  que la originó; una FK simple no puede exigirlo. Si un escritor futuro los desalinea, esa deuda
  se contaría en el cierre de la tienda equivocada. Quien lo cierra es el feature que crea la
  cuenta junto con la venta, derivando el valor de la misma variable ya persistida, y está escrito
  en el comentario de la columna.
- **Escalabilidad.** La consulta de cuentas abiertas al corte **no está paginada y crece con el
  histórico de deuda de la tienda**: un negocio con muchas deudas antiguas sin saldar la paga en
  cada cierre y en cada recálculo. Está apoyada en el índice `[tiendaId, fechaVenta]`, pero
  **ningún plan se ha medido**, porque la tabla nace vacía y medir un plan sin las filas del caso
  no dice nada. Acotarla exigiría cambiar la definición de la cifra —el saldo es de *todas* las
  cuentas vivas, no de las últimas N—, así que el límite se deja anotado aquí y se revisa cuando
  haya volumen real. El resto de las consultas nuevas entran en el `Promise.all` que ya existía,
  así que no añaden un salto secuencial.
- **Quién puede ver las tres cifras: todo el que tenga acceso al cierre.** No llevan permiso
  propio. Para las dos de flujo —lo otorgado a crédito y lo cobrado en el período— no podía ser de
  otra manera: son términos de esta ecuación, y sin verlos nadie puede cuadrar la caja. Para el
  **saldo por cobrar** sí era una elección, porque no aparece en la fórmula, y se decidió el
  2026-09-09 que también es visible. Conviene saber cuál es cuál: si algún día alguien quiere
  reservar el saldo por cobrar a un rol concreto, **el argumento en contra no es técnico** —el
  cierre cuadraría igual sin mostrarlo—, es que la decisión de mostrarlo está tomada y hay que
  volver a plantearla.
- **Cómo se repara una cifra que ya quedó escrita mal.** Es la pregunta que hay que poder
  responder meses después, y la diferencia que importa: un error de **lectura** se corrige
  recargando la pantalla; uno **persistido** no se va solo. Si alguna vez se descubriera que
  `totalPorCobrarAlCierre` —o cualquiera de las otras dos cifras— quedó contaminada (por un
  filtro defectuoso, por una deuda atribuida a la tienda equivocada, por lo que sea): un período
  **abierto se autocorrige** en la siguiente consulta, porque sus cifras se calculan en vivo y no
  se guardan hasta el cierre; un período **ya cerrado se repara ejecutando el recálculo**
  (`POST .../recalculate`, de superadministrador, con `?dryRun=1` para ver antes lo que va a
  escribir). **No hay una segunda copia que resincronizar**: la única función que produce esas
  tres cifras es la del motor de cierre, y el motor **no escribe nunca** en las tablas de deuda
  —solo las lee—, así que no queda detrás ningún saldo denormalizado que hubiera que arreglar
  aparte. Para reparar muchos períodos de una vez, el molde es el script de recálculo de cierres
  que ya existe en el repositorio.
- **Reversibilidad.** La ecuación no obliga a ninguna migración: las tres columnas que la explican
  ya existían con valor por defecto 0, y el motor solo empieza a escribirlas. Revertir el feature
  deja esas columnas en su último valor calculado, que cualquier recálculo posterior sobrescribe.
