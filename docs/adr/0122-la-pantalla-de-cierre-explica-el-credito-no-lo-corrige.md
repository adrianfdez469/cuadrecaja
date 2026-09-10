# ADR 0122: La pantalla de cierre explica el crédito, no lo corrige

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-034 (el crédito en el cierre y en el resumen de cierres)

> Este ADR existe para que nadie lo «arregle» después. Todo lo que dice es en negativo: qué **no**
> se toca en la pantalla de cierre ahora que hay ventas a crédito, y por qué tocarlo rompería el
> cuadre de caja del producto entero.

## Contexto

Con crédito, la lectura ingenua de la gaveta deja de funcionar en las dos direcciones (dosier § 8):
un cobro de deuda vieja **sube el efectivo sin subir `totalVentas`**, y una venta a crédito **sube
`totalVentas` sin subir el efectivo**. Un cajero que cuenta billetes ve que su conteo no coincide
con el total de ventas y no tiene en pantalla nada que se lo explique.

La reacción intuitiva ante eso es corregir el cálculo: restar el crédito de la ganancia, restarlo
del descuadre, o meterlo como una deducción de caja. **Las tres son errores**, y el motivo es una
propiedad del motor que no es evidente leyendo la pantalla:

`buildResumenMonedas` (`src/lib/movimiento/caja.ts:144`) arma la caja recorriendo
`venta.pagosDetalle` y `venta.vueltoDetalle`, y **no mira `Venta.totalcash` en ningún momento**.
Como el crédito no es una línea de `pagosDetalle` (ADR 0104), una venta a crédito **no aporta nada
a la gaveta sin que nadie toque el motor de caja**: el conteo físico ya se compara contra el
`totalEfectivo` correcto (dosier § 3). Y la ganancia es **devengada** al entregar (decisión de
producto 2 del dosier), así que el margen de la venta a crédito ya está dentro de
`totalGanancia`/`totalGananciaFinal` y restarlo lo contaría en negativo.

Es decir: **lo que falta en la pantalla es la explicación, no la corrección.** Y como la corrección
parece la tarea obvia, hace falta escribirlo.

## Decisión

**La pantalla de cierre y el histórico añaden cifras informativas y no modifican ni un cálculo.**
En concreto:

1. **El descuadre no se toca.** `MonedaBreakdownRow.tsx:155`
   (`breakdownTotal !== null ? breakdownTotal - totalEfectivo : null`) se lee, no se edita, y
   tampoco se editan el bloque de «Cuadre perfecto / Excedente / Faltan» ni el
   `targetAmount={totalEfectivo}` que recibe `BillBreakdownDynamic`. Contar el efectivo correcto
   tiene que seguir dando «Cuadre perfecto» sin ajustar nada.
2. **`GananciaCard` queda intacta**, sin una sola línea de diferencia y sin ninguna prop nueva. No
   aparece ninguna entrada de tipo crédito en `gananciaDeducciones`.
3. **Ninguna de las dos cifras se pinta como deducción.** Ni signo `-`, ni `color="error.main"`, ni
   dentro de `DeduccionesList`. La línea de ventas a crédito va en texto secundario y **lleva
   escrito que ese monto no entró a la caja**: sin esa frase un cajero la resta a mano y descuadra
   lo que estaba cuadrado.
4. **`totalPorCobrarAlCierre` no se pinta en ninguna de las dos pantallas** en v1. Se tipa en
   `src/schemas/cierre.ts` porque es el espejo de `CierreStoredTotals`, y ahí acaba: es un **stock**
   —la posición de capital del negocio— y su pantalla es el panel de cuentas por cobrar de F-033.
   La tarjeta de crédito del cierre no la recibe como prop, así que no puede pintarla por descuido.
5. **El umbral del 5 % de `CerrarCajaConfirmDialog.tsx:44`
   (`UMBRAL_EFECTIVO_BAJO_PORCENTAJE`) no se ensancha.** Va a disparar más seguido en un período
   vendido mayormente a crédito: es una consecuencia conocida y declarada, y ensanchar la guarda
   sería añadir una rama que nadie ha probado (E-032).
6. **Los gates de visibilidad se escriben con valor absoluto y un epsilon de medio centavo, no con
   `> 0`.** `PropinasCard` usa `> 0` porque una propina no puede ser negativa; `totalCobrosCredito`
   **sí** puede serlo, porque la reversión de un cobro de un período anterior se construye como un
   espejo en negativo (ADR 0121). Un período cuya gaveta **bajó** por una reversión es exactamente
   un período que hay que explicar, así que el gate tiene que dejarlo pasar.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Restar el crédito otorgado del descuadre de efectivo | El crédito nunca entró a la gaveta, así que `totalEfectivo` ya lo excluye. Restarlo otra vez descuadraría por el monto exacto del crédito una caja que estaba cuadrada |
| Restar el crédito de la ganancia, o añadirlo a `gananciaDeducciones` | La ganancia es devengada al entregar (decisión de producto 2). El margen ya está dentro y restarlo lo contaría en negativo. Además convertiría un problema de cobro en un problema de rentabilidad |
| Pintar «Ventas a crédito» con el mismo tratamiento visual que una deducción de caja | Es lo que provoca el error que este ADR evita: un cajero lo lee como «resta esto» |
| Mostrar `totalPorCobrarAlCierre` en la tarjeta del cierre | Es un stock y no es término de la ecuación de reconciliación (ADR 0105). Mezclarlo con dos flujos en la misma tarjeta invita a sumarlo con ellos, y su lectura correcta —la cartera a lo largo del tiempo— es la del panel de F-033 |
| Ensanchar el umbral del efectivo remanente bajo | Una guarda más ancha que el caso probado (E-032). Se deja declarado como comportamiento conocido |
| Gatear la tarjeta con `> 0` para copiar a `PropinasCard` | Ocultaría los períodos con una reversión neta, que son los que más necesitan la explicación |

## Consecuencias

**A favor:**

- El activo principal del epic —que la caja física cuadra sola sin tocar el motor— queda protegido
  por un documento y por el criterio 3 de F-034, que verifica el diff de la línea 155.
- El par de criterios 1/2 (contar 1.300 y ver «Cuadre perfecto»; contar 1.000 y ver «Faltan: 300»)
  demuestra en caliente que la fórmula sigue intacta: si alguien la «corrigiera» restando el
  crédito, el criterio 1 fallaría.
- El feature no puede introducir una regresión de cálculo, porque no escribe ningún cálculo.

**En contra / coste asumido:**

- El aviso de «efectivo remanente muy bajo» seguirá siendo ruidoso en negocios que fían mucho.
  Queda anotado y sin resolver en v1.
- La explicación depende del **copy**: la frase de que el monto no entró a la caja es la que
  sostiene el criterio 4, y un cambio de copy posterior a la implementación es una enmienda del
  contrato (E-061), no un ajuste cosmético.

**Impacto en seguridad y escalabilidad:**

- Ninguno nuevo. F-034 no añade consultas, ni rutas, ni escritura: las tres cifras las produce y
  persiste el motor de F-030, y esta pantalla solo las lee.
- El aislamiento multi-tenant de lo que se lee no cambia: cada pantalla pide el cierre de la tienda
  actual del usuario, y la ruta valida esa tienda contra el `negocioId` de la sesión antes de
  cualquier otra consulta.
