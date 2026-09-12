# ADR 0125: La tasa del abono la pone el servidor, y la moneda base se acepta siempre

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros)

> Dos decisiones que van juntas porque fallan juntas: **de dónde sale la tasa con la que un abono en
> divisa baja una deuda en moneda base**, y **qué monedas acepta el backend**. La segunda es la
> cuarta aparición documentada de **E-059**.

## Contexto

La deuda se denomina **en moneda base**. Es la decisión central del epic (dosier § 2) y su
argumento no es negociable: si la deuda viviera en divisa, `totalPorCobrarAlCierre` de un cierre
viejo **cambiaría al mover la tasa**, y el recálculo de un cierre dejaría de ser idempotente.
`monedaDeudaCode` y `montoDeudaMonedaOriginal` existen en `CuentaPorCobrar` solo para poder decirle
al cliente «debes 20 USD»; ninguna aritmética los lee.

El criterio 5 de F-035 es exactamente ese cruce: una deuda de **12.000 CUP** que se salda con **100
USD a 120**. La conversión da `100 × 120 = 12000` y la cuenta queda en cero.

La conversión la puede hacer el cliente o el servidor. `MultiCurrencyPayment` ya la hace en el
navegador: cada `IPagoLinea` que produce lleva su `equivalenteBase` calculado con `convertToBase`
contra las tasas que la pantalla tenga cargadas. Y `MovimientoCuentaPorCobrar.pagosDetalle` guarda
esas líneas **verbatim**, con la misma forma que `Venta.pagosDetalle`, para que
`buildResumenMonedas` consuma ventas y abonos por la misma función (dosier § 5).

El problema es que `equivalenteBase` es, a la vez, **el dato que se persiste** y **la cifra que
decide cuánto baja la deuda**. Un cliente que envíe `{ moneda: "USD", monto: 1, equivalenteBase:
12000 }` saldaría una deuda de 12.000 con un dólar. `checkCreditInvariant` protege la venta porque
suma los `equivalenteBase` contra un total que el servidor recalcula; un abono no tiene ese ancla:
el saldo pendiente es lo único contra lo que comparar, y compararlo contra una cifra que el cliente
eligió no comprueba nada.

Y luego está la lista de monedas. `NegocioMoneda` **no contiene la moneda base**: vive en
`Negocio.monedaBase` y solo tiene fila propia si alguien la añadió a mano. El repositorio ya se
tropezó tres veces con esto (**E-059**), siempre igual: alguien construye la lista desde
`NegocioMoneda` y el control desaparece sin ningún mensaje. Por eso existen `buildMonedaOptions`
(`src/utils/monedas.ts`) y `useMonedaOptions`, y por eso `MultiCurrencyPayment` antepone la moneda
base en su `todasMonedas`. El criterio 6 lo verifica en la pantalla — y su protocolo avisa de que
**el mismo defecto puede reaparecer en el backend**, al validar qué monedas acepta.

## Decisión

**1. El servidor resuelve la tasa y recalcula `equivalenteBase`. El cliente no la aporta.**

El cuerpo del abono lleva líneas **sin** `equivalenteBase`: `{ tipo, moneda, monto,
transferDestinationId? }`. El schema se deriva de `pagoLineaSchema` con `.omit()`, no se reescribe.
La ruta:

- construye el snapshot con las tasas vigentes del negocio (`TasaCambio`, la más reciente por
  moneda, vía `buildTasaSnapshot`),
- rechaza con 400 si falta la tasa de alguna moneda de las líneas (`missingRateCodes`), porque
  `convertToBase` convierte a 1 en silencio cuando no encuentra la tasa,
- calcula `equivalenteBase` de cada línea con `convertToBase`, arma el `IPagoLinea[]` completo y
  **eso** es lo que persiste en `pagosDetalle`,
- toma como `monto` del movimiento la suma en base, redondeada a dos decimales.

El snapshot usado se guarda en `MovimientoCuentaPorCobrar.tasaSnapshot`, que es lo que la columna
promete: *«Rates in force when this movement was registered. Its own snapshot: an instalment happens
weeks after the sale, with different rates.»*

**2. Las monedas que el backend acepta salen de `buildMonedaOptions`, no de `NegocioMoneda`.**

La ruta valida cada `moneda` contra
`buildMonedaOptions(negocioMonedas, monedaBase).map((m) => m.monedaCode)` — la **misma** función que
alimenta el selector. La moneda base entra siempre, tenga o no fila en `NegocioMoneda`. Una moneda
fuera de esa lista es un 400.

**3. La aritmética corre entera sobre la cifra en base.** El saldo, la comparación con el saldo
pendiente y el umbral de saldado se evalúan en moneda base. Ninguna cifra de la deuda se convierte
a divisa para decidir nada; la divisa solo aparece en las líneas de pago y en el rótulo informativo
de la cuenta.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Confiar en el `equivalenteBase` del cliente, como hace la venta** | En la venta esa cifra está anclada: `checkCreditInvariant` la suma contra un total que el servidor recalcula desde las líneas y los descuentos. En un abono no hay ancla — la única referencia es el saldo, y compararlo contra una cifra elegida por el cliente no comprueba nada. Un `equivalenteBase` inflado saldaría una deuda de 12.000 con un dólar |
| **Reutilizar `resolveSaleTasaSnapshot`** | Su contrato dice, con razón para una venta, que *«the client's rates are never overridden — they are what the customer was actually charged with»*. Un abono no tiene esa historia: no hay venta offline que valorar a la tasa de su momento, el cobro ocurre **ahora** y con conexión, porque necesita un período abierto y una cabecera de idempotencia. Darle precedencia al cliente aquí sería importar una excepción sin su motivo |
| **Denominar la deuda en la moneda en que se pactó** | Rompe la idempotencia del recálculo de los cierres: `totalPorCobrarAlCierre` de un período cerrado cambiaría al mover la tasa. Es el argumento decisivo del dosier § 2 y no se reabre |
| **Que el diálogo mande `equivalenteBase` y el servidor lo verifique con una tolerancia** | Dos fuentes para la misma cifra, y una tolerancia que hay que elegir sin ninguna razón física detrás. Recalcular cuesta lo mismo y no deja hueco |
| **Construir la lista de monedas del backend leyendo `NegocioMoneda`** | **E-059**, cuarta aparición. El negocio normal tiene `monedaBase = "CUP"` y una fila para USD: el backend rechazaría cobrar en CUP, que es la moneda en la que está denominada la deuda. Y sin síntoma legible — un 400 que dice «moneda no admitida» sobre la moneda propia del negocio |

## Consecuencias

**A favor:**

- El valor de un abono lo decide el servidor con las tasas del negocio. No hay cuerpo de petición
  que salde una deuda por menos de lo que vale.
- `pagosDetalle` se guarda con la forma `IPagoLinea[]` completa, así que `buildResumenMonedas` sigue
  consumiendo ventas y abonos con **una** función, que es lo que el dosier § 5 pide.
- La moneda base entra por la **misma** función en la pantalla y en la ruta: el defecto de E-059 no
  tiene dos sitios donde reaparecer, tiene cero.

**En contra / coste asumido:**

- **La cifra que el cajero vio en pantalla y la que el servidor aplica pueden diferir** si alguien
  cambia la tasa del negocio entre que el diálogo se abrió y se confirmó. Es una ventana de
  segundos, la diferencia sería de céntimos, y el saldo resultante que devuelve la respuesta es el
  que la pantalla pinta después. Se asume: la alternativa es confiar en el cliente.
- **Un cobro en una moneda sin tasa registrada se rechaza en vez de convertirse a 1.** Es
  deliberado y es un cambio de comportamiento respecto a lo que `convertToBase` hace sola, que es
  convertir en silencio. Un rechazo con motivo es preferible a una deuda que baja por la cifra
  equivocada.
- **El diálogo produce `equivalenteBase` que el servidor descarta.** `MultiCurrencyPayment` lo
  calcula igualmente para pintar el total; el schema de la petición lo omite y Zod lo descarta al
  parsear. Es redundancia visible, no un riesgo.

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** cierra la vía más directa de fraude del feature —saldar una deuda con una tasa
  inventada—. Las líneas de transferencia validan además su `transferDestinationId` con
  `withTenantScope("transferDestinations", …)`, así que un destino de otro negocio es un 400 y no
  un cobro que aterriza en la cuenta de un tercero.
- **Escalabilidad:** una consulta más por cobro (`TasaCambio` del negocio, `distinct` por moneda,
  sobre el índice `[negocioId, monedaCode, createdAt]`). Es la misma que ya hacen la ruta de venta
  y el resumen de caja.
- **Reversión:** aceptar el `equivalenteBase` del cliente sería un cambio de una línea y volvería a
  abrir el agujero entero. Por eso el schema **omite** el campo en vez de marcarlo opcional: quitar
  la protección exige tocar el schema, no relajar una condición.
