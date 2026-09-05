# ADR 0047: Dos escalas decimales distintas, dos helpers distintos: `price` a 2 y `rate` a 6, y ninguno reutiliza `qabAmountSchema`

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-006
**Se apoya en:** [ADR 0003](0003-tipos-de-los-importes-de-la-integracion.md) ·
contrato QAB v10.1, § ① «`payload` de `PRODUCT`», «`payload` de `EXCHANGE_RATE`» y § ③④ «El formato de los importes»

## Contexto

F-006 mueve dos números decimales hacia queandabuscando, y **se parecen lo suficiente como para
confundirlos y lo bastante distinto como para romper si se confunden.**

**`PRODUCT.price`** — número JSON, como máximo **2** decimales. El contrato es inusualmente
explícito sobre por qué:

> Con más, los dos lados redondean distinto de forma permanente: `2.675` se serializa aquí `"2.67"`
> (`toFixed(2)` de JavaScript sobre el doble IEEE-754 más cercano, `2.67499…`) y `round(2.675, 2)`
> en Postgres da `2.68` — comprobado ejecutando. Es la precondición de § ⑤ Reconciliación.

Un decimal de más aquí no es un céntimo: es un hash de reconciliación que **no vuelve a converger
nunca**, y F-008 lo interpretaría como sincronización rota, disparando la recuperación una y otra
vez.

**`EXCHANGE_RATE.rate`** — número, `> 0` estricto, y se guarda como `Decimal(18,6)`: **6**
decimales, «y a partir del séptimo se redondea».

Y encima hay un tercer formato en el mismo repositorio, que es el que invita al error:
`src/schemas/qabAmount.ts` (`qabAmountSchema`, F-002/ADR 0003) es el borde por donde entran los
importes de **pedido** de § ③④, que viajan **entre comillas** (`"880.00"`). Ese schema:

- produce una **cadena** de escala fija, no un número;
- y **rechaza** un valor con más de 2 decimales reales en vez de redondearlo —`2.675` haría fallar
  `qabAmountSchema.safeParse`, por diseño: allí un redondeo silencioso sería una pérdida de dinero.

El spec avisa de las tres trampas por su nombre: «`QAB_AMOUNT_DECIMALS` no aplica aquí», «no
reutilizar `QAB_AMOUNT_DECIMALS`», «quien construya `buildQabProductPayload` no puede reutilizar
`qabAmountSchema` tal cual para `price` sin cambiar esa semántica».

Y las Prohibiciones de `AGENTS.md` cierran la otra salida fácil: nada de escribir un `2` o un `6`
sueltos en el código.

## Decisión

**Dos escalas, dos constantes, dos helpers, y ninguno de los dos reutiliza `qabAmountSchema`.**

En `src/constants/qab.ts`:

- `QAB_AMOUNT_DECIMALS = 2` — ya existía. Es la escala de `price` **y** la de los importes de
  pedido: la coincidencia es real, no un accidente que haya que separar.
- `QAB_EXCHANGE_RATE_DECIMALS = 6` — **nueva**, con el comentario diciendo que
  `QAB_AMOUNT_DECIMALS` no aplica aquí.

En `src/schemas/qabDecimals.ts` (nuevo), tres funciones puras:

```
hasQabScale(value, decimals)   // ¿ya tiene como mucho `decimals` decimales?
toQabPrice(value)              // Number(value.toFixed(QAB_AMOUNT_DECIMALS))
toQabExchangeRate(value)       // Number(value.toFixed(QAB_EXCHANGE_RATE_DECIMALS))
```

**Los dos `toQab*` son TOTALES: no lanzan.** Un valor no finito se devuelve tal cual; rechazarlo es
trabajo del schema, no del redondeo. Así hay un solo sitio que decide qué es válido.

**El comportamiento queda fijado con valores concretos**, verificados ejecutando en Node y
escritos en el contrato de interfaces para que el `dev-tester` los use como tabla de `it.each`:

| Entrada | `toQabPrice` | Por qué importa |
|---|---|---|
| `2.675` | `2.67` | El ejemplo literal del contrato. Postgres daría `2.68` |
| `2.005` | `2` | `toFixed` y el redondeo bancario divergen aquí; y JSON no escribe el `.00` |
| `450` | `450` | El caso normal no se toca |
| `0.125` | `0.13` | El doble más cercano cae por encima; el resultado NO es «siempre hacia abajo» |

| Entrada | `toQabExchangeRate` |
|---|---|
| `420.1234567` | `420.123457` |
| `420` | `420` |

El archivo vive en `src/schemas/` y no en `src/lib/` a propósito: es aritmética pura sin Prisma
—como su vecino `qabAmount.ts`— y **los schemas la importan**. Al revés se invertirían las capas.

`qabAmountSchema` se queda donde está y para lo que está: los importes de pedido de § ③④.

### El `> 0` estricto, y el único cambio de comportamiento que este feature introduce

El contrato exige `rate > 0` **estricto**. Una tasa positiva pero minúscula (por debajo de 5e-7 CUP
por unidad) redondea a `0` a seis decimales y dejaría de cumplirlo. `buildQabExchangeRatePayload`
lanza `QabCurrencyPayloadError("QAB_EXCHANGE_RATE_TOO_SMALL")`, y
`POST /api/negocio/[id]/tasas-cambio` **responde `400` sin escribir nada** en vez de dejar que
reviente como `500`.

Es una regresión potencial de una ruta que existía antes de F-006, así que se acota a conciencia:
**solo aplica cuando el negocio tiene la tienda online habilitada.** Con la tienda apagada la ruta
se comporta exactamente como hoy. Y la comprobación va **antes** de la transacción, así que no
puede dejar una `TasaCambio` escrita y un evento sin encolar.

No hay backfill: las tasas ya guardadas no se tocan.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `qabAmountSchema` para `price` | Produce una **cadena** (`"450.00"`) donde el contrato quiere un **número**, y **rechaza** `2.675` en vez de redondearlo — es decir, rompe los criterios 1 y 5 a la vez. Adaptarlo cambiaría la semántica del schema por el que entran los importes de pedido, que es lo último que conviene tocar |
| Un solo helper `toQabDecimal(value, decimals)` con el número de decimales como parámetro | Es exactamente donde se cuela el error que este ADR previene: en la llamada. `toQabPrice(x)` y `toQabExchangeRate(x)` no se pueden confundir; `toQabDecimal(x, 2)` en el sitio de la tasa compila sin protestar |
| Una sola constante de decimales para toda la integración | Son dos escalas distintas fijadas por dos tipos de columna distintos del otro lado (`price` numérico y `Decimal(18,6)`). Unificarlas es inventar un requisito |
| Redondear en Postgres (`ROUND(precio::numeric, 2)`) | El contrato dice explícitamente que Postgres redondea **distinto** que JavaScript en el caso de `2.675`, y es el redondeo de JavaScript el que el otro lado espera. Sería la divergencia permanente que el contrato avisa |
| Truncar en vez de redondear | `2.675 -> 2.67` sale igual por casualidad, pero `0.125 -> 0.12` en vez de `0.13`. El contrato dice `toFixed`, no truncado |
| Guardar el precio ya redondeado en `ProductoTienda.precio` | Cambia datos del comerciante para satisfacer un formato de cable. El criterio 5 pide la forma final del `payload`, no que la columna se trunque |
| Dejar que una tasa que redondea a cero emita `rate: 0` | Incumple el `> 0` del contrato: el evento entraría en `failed[]` y reintentaría seis veces antes de agotarse. Un `400` inmediato le dice al usuario lo que pasa |
| Crear la `TasaCambio` y no emitir el evento cuando redondea a cero | Divergencia silenciosa entre las dos bases, que es exactamente el fallo que este feature existe para evitar |
| Aplicar el `400` también con la tienda online apagada | Sería cambiar el comportamiento de una ruta para negocios que no usan la integración. Se acota al caso en que el dato tiene que viajar |

## Consecuencias

**A favor:**

- Los criterios 5 y 14 quedan cubiertos por lógica **pura** en un `.ts`, con casos verificados
  ejecutando y escritos en el contrato: el `dev-tester` no tiene que adivinar el resultado de
  `(2.005).toFixed(2)`.
- Es imposible usar la escala equivocada por descuido: no hay una llamada donde el número de
  decimales sea un argumento.
- `qabAmountSchema` y su semántica de rechazo se quedan intactos para lo que sí son.
- Ningún `2` ni ningún `6` suelto en el código (Prohibiciones → *Hardcoding*).

**En contra / coste asumido:**

- Tres formatos decimales conviviendo en el mismo repositorio (cadena a 2, número a 2, número a 6).
  Es lo que el contrato pide; lo que se puede hacer es que cada uno tenga un nombre que no se
  confunda con los otros dos, y eso es lo que hace esta decisión.
- **`POST /api/negocio/[id]/tasas-cambio` puede responder `400` donde antes respondía `201`**, para
  una tasa por debajo de 5e-7 y solo con la tienda online habilitada. Cambio de comportamiento de
  una ruta existente, deliberado y acotado.
- `price` viaja redondeado y `ProductoTienda.precio` conserva sus decimales: los dos valores pueden
  diferir en céntimas. Es lo que el contrato exige, y § ⑤ compara contra el redondeado.
- La suma de precios redondeados no es el redondeo de la suma. Ninguna cifra de este feature suma
  precios, pero conviene tenerlo escrito antes de que alguien lo haga.

**Impacto en seguridad y escalabilidad:**

- Los helpers son puros y sin estado: sin coste, sin E/S y sin superficie de ataque.
- El `price` que viaja es el **redondeado**, y la reconciliación de F-008 compara contra ese mismo
  valor: es la precondición para que el hash converja y para que la recuperación no se dispare
  sobre datos correctos.
- La comprobación del `> 0` corre **antes** de abrir la transacción, así que una entrada inválida
  no consume ni una conexión ni una fila.
