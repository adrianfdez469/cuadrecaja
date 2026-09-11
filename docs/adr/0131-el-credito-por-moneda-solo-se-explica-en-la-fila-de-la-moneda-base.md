# ADR 0131: El crédito por moneda solo se explica en la fila de la moneda base

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-036 (el crédito en el cierre y en el resumen de cierres)

## Contexto

El desglose por moneda de la pantalla de cierre (`MonedaBreakdownRow`, compartido con el drawer del
histórico) muestra una fila por moneda, y varias de sus cifras informativas **son por moneda de
verdad**: `initialFund` y `tipCash`/`tipTransfer` son columnas de `ResumenMonedaCierre`.

Las dos cifras de crédito no lo son. `CierrePeriodo.totalCreditoOtorgado` y `totalCobrosCredito`
son **agregados del período en moneda base**, y `ResumenMonedaCierre` no tiene ningún campo de
crédito. El campo por moneda que sí existe —`cobrosCreditoEfectivo`— vive en `ResumenCajaMoneda`
(`src/lib/movimiento/caja.ts`), que es el tipo del widget de caja **abierta** del POS, no el de un
período cerrado.

Además, la deuda **está denominada en moneda base por decisión de producto y no es negociable**
(dosier § 2): denominarla en divisa haría que `totalPorCobrarAlCierre` de un cierre viejo cambiara
al mover la tasa, rompiendo la idempotencia del recálculo.

Con eso, repetir el mismo total del período en cada fila de moneda sería incorrecto en un negocio
multimoneda: diría tres veces lo que pasó una. Y no mostrarlo en ninguna fila dejaría el criterio 4
—la línea que avisa de que el crédito no entró a la caja— sin sitio donde vivir.

Restricción de propiedad, del dosier § 9: `src/lib/cierre/**`, `src/lib/movimiento/caja.ts` y
`prisma/schema.prisma` **no son de F-036**, y `ResumenMonedaCierre` es una tabla, así que un
desglose por moneda persistido exigiría migración.

## Decisión

**Las dos líneas informativas se pintan solo en la fila de la moneda base del negocio, y el motor
de cierre no se toca.**

- La fila elegible es la que cumple `monedaCode === Negocio.monedaBase`, leída del `AppContext`
  (`monedaBase`) y **nunca** de `monedasNegocio`, que no contiene la moneda base (E-059, tres
  apariciones). La comparación se hace normalizada (`trim` + mayúsculas): un desajuste de caja
  entre los dos valores escondería las dos líneas **sin ningún error**, que es la peor forma de
  fallar.
- La decisión vive en una función pura, `resolveCurrencyCreditLines(monedaCode, monedaBase, flow)`,
  que devuelve las líneas a pintar o `null`. `MonedaBreakdownRow` no sabe qué es la moneda base:
  recibe ya resuelto qué líneas le tocan.
- **El copy de la línea de cobros habla del período, no de la fila.** No puede afirmar que el monto
  está dentro del efectivo *de esta moneda*: en un negocio multimoneda el cobro puede haber entrado
  a la gaveta de otra. Es una restricción dura sobre el copy que el `ui-designer` hereda.
- **La `CreditoCard` es el sitio autoritativo de las dos cifras** y se pinta con independencia de
  las monedas del período. Las dos líneas por moneda son un recordatorio local, en el lugar donde
  el cajero se hace la pregunta, no la fuente.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Añadir el desglose por moneda a `ResumenMonedaCierre` y al motor de cierre | Obliga a tocar `prisma/schema.prisma` (con migración), `src/lib/cierre/**` y `src/lib/movimiento/caja.ts`: tres archivos de otros dueños y de un feature ya cerrado. F-036 es un feature de explicación en pantalla, y esto lo convertiría en una segunda vuelta a F-032 |
| Repetir el total del período en cada fila de moneda | Dice tres veces lo que pasó una vez. En un negocio multimoneda es directamente falso |
| Prorratear el crédito entre monedas por el peso de cada una en la caja | Inventa un dato: el crédito no tiene moneda física, por eso no es una línea de `pagosDetalle` (ADR 0111). Un número plausible y falso es peor que ninguno |
| No pintar ninguna línea por moneda y dejarlo solo en la tarjeta | Deja el criterio 4 sin sitio. La frase de que el crédito no entró a la caja tiene que estar **donde el cajero cuenta el efectivo**, que es esa fila |
| Pintar las líneas solo cuando el período tiene una única moneda | El caso multimoneda es justo el que más necesita la explicación, y esconderla ahí sería una rama que ningún criterio recorre |

## Consecuencias

**A favor:**

- F-036 se queda entero dentro de su mapa de propiedad: ni migración, ni motor, ni una línea de
  `src/lib/**`. Nada que escalar a F-032.
- La regla es una función pura con una firma corta, así que se prueba sin base de datos y sin
  navegador, incluidos los casos que discriminan: moneda distinta de la base, y códigos con
  distinta caja.
- El escenario central de F-036 y la mayoría de los negocios reales tienen un solo eje monetario:
  ahí la cifra del período y la de la fila coinciden y la línea es exacta.

**En contra / coste asumido:**

- En un negocio multimoneda no hay desglose de crédito por moneda, y no lo va a haber en v1. Si
  alguna vez hace falta, es una vuelta al motor de cierre con su migración, no un ajuste de
  pantalla.
- Si un período **no tiene ninguna fila de la moneda base** en `resumenMonedas` —todo se cobró en
  divisa—, no hay fila donde pintar las líneas y no se pintan en ninguna. La `CreditoCard` sigue
  contando la historia completa, así que no se pierde información, pero la explicación no aparece
  junto al conteo de billetes.
- El escenario de verificación queda **acoplado a la moneda de siembra**: el criterio 4 solo es
  verificable si el escenario central se cobra en la moneda base. Está escrito en el contrato de
  interfaces para que el `qa` no lo descubra al montarlo.

**Impacto en seguridad y escalabilidad:**

- Ninguna consulta nueva y ningún dato nuevo: las dos cifras ya viajaban en el JSON del cierre.
- La resolución por fila es una comparación de cadenas por moneda del período, sin coste apreciable
  frente al render de la fila.
