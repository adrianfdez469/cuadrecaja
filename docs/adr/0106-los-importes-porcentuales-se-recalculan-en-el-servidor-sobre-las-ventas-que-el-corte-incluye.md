# ADR 0106: Los importes porcentuales se recalculan en el servidor, sobre las ventas que el corte incluye

**Estado:** aceptado
**Fecha:** 2026-09-08
**Feature:** F-029

## Contexto

Un gasto de tienda puede ser `MONTO_FIJO`, `PORCENTAJE_VENTAS` o `PORCENTAJE_GANANCIAS`. Los dos
últimos se calculan sobre los totales del período y se aplican al cerrar. El criterio 5 de F-029
exige que se calculen sobre las ventas que el corte incluye, no sobre todas las del período.

Al mirar el código aparece un reparto que no es el que se suponía:

- **`POST /api/gastos/cierre/[cierreId]/preview`** sí recorre `cierre.ventas`, sin filtro, y
  calcula ahí `totalVentas` y `totalGanancia` con aritmética **propia**, distinta de la de
  `computeCierreTotals`: su `totalGanancia` es **bruta** de descuentos, mientras que la del motor
  del cierre es **neta**.
- **`POST /api/gastos/cierre/[cierreId]/apply`** **no lee las ventas en absoluto.** Persiste el
  `montoCalculado` que llega **en el cuerpo de la petición**, calculado por el navegador a partir
  de lo que devolvió el preview. Ya lee de `GastoTienda` la **moneda** del gasto en vez de creerle
  al cuerpo, precisamente porque la moneda decide cuánto vale el importe una vez convertido.

Es decir: filtrar solo el preview dejaría el criterio 5 dependiendo de que el navegador mande la
cifra correcta, y bastaría una petición hecha a mano —o un preview pedido antes de fijar el
corte— para escribir en el cierre un gasto calculado sobre ventas que no entraron.

## Decisión

**Los importes de `PORCENTAJE_VENTAS` y `PORCENTAJE_GANANCIAS` los calcula el servidor, en las dos
rutas, sobre las ventas que el corte incluye.** Los de `MONTO_FIJO` siguen viniendo del cuerpo,
como hoy.

La aritmética de los dos totales base se **mueve tal como está escrita** desde el preview a una
función pura compartida, `computePercentageBaseTotals` en `src/lib/gastos.ts`. Se traslada, no se
rederiva: **no** se sustituye por `computeCierreTotals`, porque su `totalGanancia` es neta de
descuentos y la del preview es bruta, y cambiar cuál de las dos reglas rige un gasto porcentual
movería dinero real y no es lo que F-029 viene a hacer. Lo único que cambia es **sobre qué ventas
corre**.

Además, `apply` pasa a leer el **porcentaje** de la fila de `GastoTienda`, no del cuerpo, por la
misma razón por la que ya lee de ahí la moneda: los dos deciden cuánto dinero acaba escrito.

Y con una guarda previa **sin rama de escape**: todo ítem con `tipoCalculo` porcentual **tiene que**
resolver a una fila de `GastoTienda` de esa misma tienda, o la petición entera se rechaza con 400.
Sin ella el arreglo sería aparente: `gastoPreviewSchema` declara `gastoTiendaId` como opcional y
anulable, así que un cuerpo con `gastoTiendaId: null` y `porcentaje: 999` pasaría la validación, y
un id de otra tienda resuelve a `null` en silencio en el `Map` que la ruta ya construye. Una rama
que en ese caso leyera el porcentaje del cuerpo volvería a poner la cifra en manos del cliente.

Y el `movimientoStock.findMany` del preview acota su `fecha` con la misma cota superior que el
corte impone al cierre, para que la ganancia final que se enseña sea la que se va a guardar.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Filtrar solo el preview y seguir confiando en el `montoCalculado` del cuerpo | El criterio 5 quedaría satisfecho solo mientras el cliente se porte bien; una petición directa escribe el importe que quiera |
| Mandar el corte en el cuerpo de `apply` para que el servidor lo use | El corte ya está en la fila del período: pedirlo por la petición es una segunda fuente de verdad para el mismo dato, y una que el cliente controla |
| Recalcular con `computeCierreTotals` en vez de mover la aritmética del preview | Su `totalGanancia` es neta de descuentos y la del preview bruta: unificarlas cambia el importe de todos los gastos porcentuales del sistema, dentro de un feature que no trata de eso |
| Hacer que `apply` recalcule solo cuando hay corte | Deja viva la mitad del agujero y añade una rama que nadie prueba en el camino sin corte (E-032) |
| Aplicar los gastos recurrentes dentro de la transacción del cierre | Es lo correcto y es la deuda que el ADR 0105 deja anotada; es un cambio mayor de esa ruta, no de este feature |

## Consecuencias

**A favor:**

- El criterio 5 se cumple **por construcción**: el importe que se guarda sale de las mismas ventas
  que el cierre va a contar, las mande el cliente como las mande.
- El preview y el `apply` leen una sola definición de los totales base, en vez de que uno la
  calcule y el otro se fíe.
- Se cierra un agujero de integridad que ya existía antes de F-029: un importe de dinero que el
  cliente decidía.
- La ganancia final del preview deja de poder diferir de la que el cierre guarda por una `COMPRA`
  posterior al corte.

**En contra / coste asumido:**

- `apply` gana una lectura de las ventas del período, que antes no hacía.
- Sin absolutos: para **el mismo estado del período**, el importe recalculado coincide con el que
  devolvió el preview. Si el período cambió entre uno y otro, se guarda el recalculado —que es el
  correcto—, y ahí el usuario puede ver una cifra distinta de la que le enseñó el diálogo.
- La divergencia de fondo (ganancia bruta en los gastos porcentuales, neta en el cierre) **sigue
  en pie**. Queda documentada aquí para que se decida algún día a propósito, en vez de
  descubrirse otra vez.

**Impacto en seguridad y escalabilidad:**

- El cálculo de un gasto **porcentual recurrente** —los que aplican estas dos rutas— queda
  enteramente en el servidor: las ventas por el corte, la moneda y el porcentaje por la fila de
  `GastoTienda`, y el importe recalculado.
- **Sin absolutos, porque el `qa` los lee como especificación (E-017):** esto NO cierra la
  integridad del cálculo de gastos en general. Siguen confiando en el cuerpo el `montoCalculado` de
  un `MONTO_FIJO` en `apply`, y la ruta `POST /api/gastos/cierre/[cierreId]/adhoc`, que acepta un
  gasto ad-hoc `PORCENTAJE_*` con su `montoCalculado` y su `porcentaje` tal como llegan. Las dos son
  deuda preexistente y F-029 no las toca.
- El `findMany` de `GastoTienda` sigue acotado a `tiendaId` del cierre, así que un
  `gastoTiendaId` de otra tienda no aporta ni moneda ni porcentaje.
- Sin N+1: una lectura de ventas por petición, la misma que ya hacía el preview.
