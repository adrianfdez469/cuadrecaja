# ADR 0060: La conversión de moneda se recomputa con enteros escalados y redondeo half-up, y nunca reescribe `unitPrice`

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

El criterio 6 pide que un pedido con líneas priceadas en otra moneda muestre el importe original y
el convertido, y que **recomputar `unitPrice` con las tasas del `rateSnapshot` dé el mismo
céntimo**.

Lo que hay en la base:

- `PedidoEntranteLinea.unitPrice` — `Decimal(14,2)`, el precio ya convertido, el que el comprador
  aceptó.
- `originalUnitPrice`, `originalCurrencyCode`, `originalLineTotal` — el precio antes de convertir.
  Los tres son **nullable**: un pedido creado antes de que QAB tuviera la distinción no los guarda,
  y eso no es un error ni un dato faltante.
- `PedidoEntrante.rateSnapshot` — `Json?`, **nullable** y **opaco**. Se persiste verbatim y no se
  recalcula ni se reescribe nunca. Su forma, leída del contrato QAB v10.1 § ③④:

  ```jsonc
  { "base": "CUP", "capturedAt": "2026-08-26T02:00:00.000Z", "rates": { "USD": "440.000000" } }
  ```

`src/lib/currency.ts` **no sirve** aquí: sus `TasaCambio` son las de cuadrecaja y no tienen relación
con este JSON.

Dos cosas quedan indefinidas si no se cierran ahora, y las dos son E-030 esperando a pasar
—`implementer` y `dev-tester` escriben sin verse, y una de dos lecturas defendibles produce un rojo
que no es culpa de ninguno—:

1. **El redondeo.** «El mismo céntimo» exige decir *qué* céntimo. Un `440.005` a dos decimales es
   `440.01` con half-up y `440.00` con half-even, y `Number` con `toFixed` da todavía un tercer
   resultado en algunos valores por el binario de IEEE-754.
2. **Qué pasa cuando no coinciden.** Recomputar es una comprobación; el contrato tiene que decir si
   el resultado se muestra, se sustituye o se calla.

## Decisión

**Aritmética exacta con enteros escalados (`BigInt`), redondeo half-up alejándose del cero al
céntimo, y el valor recomputado se expone junto al almacenado sin reemplazarlo nunca.**

### Dónde vive

| Pieza | Archivo |
|---|---|
| Schema del `rateSnapshot` | `src/schemas/qabRateSnapshot.ts` (nuevo) |
| Lectura de una tasa y la conversión | `src/lib/qab/qabRateConversion.ts` (nuevo) |

Los dos son `.ts` planos, sin Prisma y sin React, así que la suite los cubre (E-015). El schema
importa solo de `zod` y de `@/constants/qab`, y nada de `@/schemas/**` importa de él: no hay arista
que pueda cerrar un ciclo de valor (E-028).

### La aritmética

Con `RATE_SCALE = 10 ** QAB_EXCHANGE_RATE_DECIMALS` (seis decimales, la escala `Decimal(18,6)` del
otro lado) y `AMOUNT_SCALE = 10 ** QAB_AMOUNT_DECIMALS` (dos):

- La tasa de la moneda **base** del snapshot es `RATE_SCALE` — uno exacto. No se busca en `rates`.
- La tasa de cualquier otra moneda es su entrada de `rates`, aceptada como cadena o como número
  finito, que cumpla `/^\d+(\.\d{1,6})?$/` tras recortar espacios y sea **estrictamente mayor que
  cero**. Cualquier otra cosa —más de seis decimales, negativa, cero, vacía, un objeto— es una tasa
  **ilegible**, y una tasa ilegible no invalida las demás.
- Los códigos de moneda se comparan recortados y en mayúsculas, en los dos lados.

La conversión, en enteros y sin ningún `Number` por medio:

```
cents  = amount as a scaled integer (AMOUNT_SCALE)
result = round( cents * rateFrom / rateTo )
```

`round` es **half-up alejándose del cero**: se trunca hacia cero y se ajusta una unidad cuando
`2 * |resto| >= |divisor|`. Ejemplos fijados, que valen como test:

```
convert("10.00", USD -> CUP, { base: "CUP", rates: { USD: "440.000000" } }) === "4400.00"
convert("0.005"-equivalent halfway cases round AWAY from zero: 0.005 -> "0.01"
convert("1.00", USD -> USD, …) === "1.00"     // same code on both sides, no rates lookup
```

### Qué se expone

Cada línea del detalle lleva tres bloques:

- `unitPrice` — **el valor almacenado**, tal cual. Es el precio que el comprador aceptó.
- `original` — `{ currencyCode, unitPrice, lineTotal }`, o `null`. Es no nulo **solo** cuando
  `originalCurrencyCode` y `originalUnitPrice` son los dos no nulos; `lineTotal` puede seguir siendo
  `null` dentro del bloque.
- `conversion` — `{ recomputedUnitPrice, matchesStored }`, o `null`.

`conversion` es `null` en cualquiera de estos casos, y en ningún otro: `original` es `null`; el
pedido no tiene `rateSnapshot` o el schema lo rechaza; la tasa de la moneda original es ilegible; la
tasa de la moneda de la línea es ilegible.

`matchesStored` es la igualdad exacta de las dos cadenas de escala fija —`recomputedUnitPrice` y
`unitPrice` normalizados a dos decimales—, sin tolerancia. Es la lectura ejecutable del criterio 6:
«el mismo céntimo» es literalmente el mismo céntimo.

**El valor recomputado no sustituye a `unitPrice` en ninguna circunstancia**, y `false` en
`matchesStored` no es un error de la petición: la respuesta sigue siendo `200`, la línea se muestra
con sus dos importes y la pantalla no afirma que coincidan.

`recomputedLineTotal` **no se expone**. El criterio 6 nombra `unitPrice`; añadir un segundo campo
derivado sería una segunda cosa que verificar sin ningún criterio que la pida.

**No se expone ninguna «tasa efectiva».** Sería `rateFrom / rateTo` redondeada, y una tasa
redondeada no reproduce la conversión: invitaría a afirmar `unitPrice = original × tasa`, que es una
igualdad que no se cumple en general. Lo que sí viaja, al nivel del pedido, es
`rateSnapshot: { base, capturedAt } | null` — de dónde salió la conversión, no con qué número se
hizo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Aritmética con `Number` y `toFixed(2)` | Es lo que hace `toQabPrice` (ADR 0047), y ahí es correcto porque el contrato de QAB publica ese comportamiento para los precios que **salen**. Aquí se compara contra un valor calculado por otro sistema, y `2.675.toFixed(2) === "2.67"` es la clase de sorpresa que convierte un criterio de igualdad en una lotería |
| Redondeo half-even (bancario) | Es el redondeo estadísticamente neutro, pero half-up es el que la gente espera al mirar un precio, y es el que hay que fijar si el criterio exige una única respuesta. Si un día se comprueba que QAB usa half-even, se cambia aquí, en un sitio |
| Truncar en vez de redondear | Sesga siempre a la baja y haría fallar el criterio 6 en cuanto una línea caiga en medio céntimo |
| Reemplazar `unitPrice` por el valor recomputado | Reescribiría el precio que el comprador aceptó con uno derivado de un JSON de terceros. Si divergen, el que manda es el pactado |
| Rechazar el pedido (o la línea) cuando no coinciden | Un pedido real dejaría de poder verse por una discrepancia de un céntimo. La bandeja existe para atender pedidos, no para auditarlos |
| Devolver el `rateSnapshot` entero en la respuesta | Es un blob de terceros dentro de un schema `.strict()`, con un `rates` cuya forma no controlamos, y ningún consumidor lo necesita: el servidor ya hizo la cuenta |
| Rechazar el snapshot completo si una tasa es ilegible | Una moneda mal escrita en `rates` dejaría sin conversión a todas las líneas del pedido, incluidas las que no la usan |
| Tratar una tasa con más de seis decimales redondeándola | Sería introducir un redondeo intermedio no publicado por el contrato, y el resultado dejaría de ser reproducible desde el dato original |

## Consecuencias

**A favor:**

- El criterio 6 es verificable desde la propia respuesta: `matchesStored: true` es la afirmación
  «recomputar da el mismo céntimo», hecha por el servidor sobre datos reales, y un `qa` la contrasta
  con la cuenta a mano.
- Un `rateSnapshot` ausente, corrupto o incompleto degrada a `conversion: null` y la línea se sigue
  mostrando con su `unitPrice`. Es la misma disciplina que F-010 aplicó a `status` (ADR 0004): un
  dato del cable que no se puede leer no rompe el render.
- La aritmética es exacta en todo el rango de `Decimal(14,2)`: no hay ningún punto donde un `double`
  pierda un céntimo.

**En contra / coste asumido:**

- Dos archivos nuevos y un puñado de helpers de `BigInt` que ya existen en espíritu en
  `qabOrderPull.ts` (`toScaledAmount`). Los de allí son privados del módulo y no se exportan; se
  vuelven a escribir aquí en vez de abrir `qabOrderPull.ts`, que es código cerrado de F-010 y cuya
  suite depende de su forma actual.
- El redondeo half-up es **nuestra** elección, no un dato verificado del comportamiento de QAB. Si
  aparece una discrepancia sistemática en los medios céntimos, la respuesta ya la señala
  (`matchesStored: false`) en vez de esconderla, y el arreglo es una línea de este módulo.
- `conversion: null` tiene cuatro causas y la respuesta no dice cuál. Distinguirlas obligaría a
  meter un código de diagnóstico en una respuesta que se muestra a un comerciante.

**Impacto en seguridad y escalabilidad:**

- La conversión es pura y en memoria, sobre las líneas de **un** pedido, acotadas por
  `QAB_ORDER_MAX_LINES` (100). No añade ninguna consulta.
- `parseQabRateSnapshot` usa `safeParse` y devuelve `null` para cualquier entrada que el schema
  rechace: sus `issues` no se devuelven ni se registran, así que ningún fragmento del contenido de
  la fila puede salir por ahí (ver ADR 0061 y E-031).
