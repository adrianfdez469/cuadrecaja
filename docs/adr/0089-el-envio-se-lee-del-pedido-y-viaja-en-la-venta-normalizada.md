# ADR 0089: El envío se lee de `PedidoEntrante.deliveryFee` y viaja en la venta normalizada, nunca se deduce del total

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-024
**Se apoya en:** [ADR 0075](0075-el-origen-tienda-online-se-hace-visible-en-el-resumen-del-reporte-de-ventas-y-no-solo-en-la-columna.md) (el origen ya viaja en `NormalizedSale`), [ADR 0072](0072-un-pedido-se-ata-a-su-venta-por-una-columna-unica-y-a-su-reserva-por-un-reclamo-en-el-propio-pedido.md) (el enlace `Venta.pedidoEntranteId`)

## Contexto

`createSummaryAggregator` suma `sale.netAmount` en la cifra de tienda online
(`src/lib/reports/aggregators/summary.ts:47`). `netAmount` se compone **solo** de las líneas de
producto de la venta (`src/lib/reports/sales-stream.ts:339` y `:366`, `grossAmount − discountTotal`
sobre `venta.productos`). El envío cobrado no tiene línea de producto detrás: lo escribe QAB como
una columna aparte del pedido y el aterrizaje lo mete dentro de `Venta.total` sin desglosarlo
(`buildOnlineSaleAmounts`, `src/lib/tiendaOnline/orderLandingPlan.ts:281`, que convierte
`pedido.total` entero).

Resultado: un pedido de subtotal 40 + envío 15 escribe una `Venta.total` de 55 correcta y aporta 40
al panel. El error se acumula con cada envío cobrado.

Las restricciones que acotan la solución son tres, y ninguna es negociable:

1. **`createSummaryAggregator` tiene que seguir siendo puro** sobre `NormalizedSale` (criterio 7 de
   F-024, y la razón por la que el criterio 6 de F-014 es comprobable sin base de datos). Así que el
   importe **tiene que llegarle en la fila**, no consultarse desde dentro.
2. **El dato ya está guardado y no se duplica.** `PedidoEntrante.deliveryFee` es `Decimal(14,2)`
   desde F-001 y `Venta.pedidoEntranteId` es `String? @unique` desde F-014. Copiarlo a una columna
   nueva de `Venta` crea dos copias que pueden separarse. No hay migración.
3. **El stream recorre ventas por lotes.** Una lectura de `PedidoEntrante` por venta sería un N+1
   sobre el camino más caliente de los reportes.

## Decisión

**`NormalizedSale` gana un campo `deliveryFeeBase: number`, que `normalizeSale` llena leyendo
`PedidoEntrante.deliveryFee` por la relación que ya cuelga de `Venta.pedidoEntranteId`, convertido a
moneda base con el mismo `convertToBase` y el mismo snapshot de tasas con los que ya se valoran las
líneas.**

### 1. El dato se lee, no se deduce — y esto es el discriminador del feature

La alternativa perezosa es obvia y **está prohibida**: «el envío es `Venta.total` menos la suma de
las líneas».

No es equivalente, y el motivo no es una sutileza:

- `Venta.tipTotal` es una columna **independiente** de cualquier `Venta`
  (`prisma/schema.prisma`, modelo `Venta`), y `src/lib/tips.ts` la modela como un **excedente sobre
  `total`**, no como una parte de él. Hoy `tiendaOnlineOrderLanding.ts` nunca asigna propina al crear
  la venta de un pedido, pero **nada en el schema ata la propina a que la venta no tenga
  `pedidoEntranteId`**: basta que alguien la capture al marcar `DELIVERED`, o que se edite después,
  para que cualquier resta que parta de un total contaminado deje de dar el envío.
- El mismo argumento vale para el descuento: `pedido.discountTotal` y `Venta.discountTotal` se
  escriben por caminos distintos, y una venta online sin líneas reservadas tiene `netAmount` 0 con un
  `total` que no lo es.

`PedidoEntrante.deliveryFee` es un hecho persistido de forma independiente que no varía con lo que le
pase después a la propina, al descuento o a las líneas. **Leerlo es la única forma que sigue siendo
correcta cuando alguna de esas cosas cambia**, y por eso el criterio 2 de F-024 exige la lectura
directa aunque hoy, sin propina, la resta diera el mismo número.

Y la trampa gemela ya está escrita en el propio contrato de QAB, en
`references.external_docs.qab.contrato.trampa_central_vigente`: *«todo atajo —tratar el 0.00 como
gratis, mirar si hay `contact.address`, **comparar `total` con `subtotal`**— acierta hoy y falla con
el primer envío regalado»*. Deducir el envío del total es exactamente ese atajo, un nivel más abajo.

### 2. Cómo llega: un `include` en la consulta que ya existe

`streamNormalizedSales` (`sales-stream.ts:213`) pasa de

```ts
include: { productos: true, appliedDiscounts: true },
```

a

```ts
include: {
  productos: true,
  appliedDiscounts: true,
  pedidoEntrante: { select: { deliveryFee: true, currencyCode: true } },
},
```

Es una relación **to-one**, y se resuelve con el mismo mecanismo que Prisma ya aplica a `productos` y
a `appliedDiscounts` en esa misma llamada: una consulta adicional por **lote** con un `IN` sobre las
claves del lote, no una por venta. El coste añadido es del orden del número de lotes (uno por cada
`batchSize`, 500 por defecto), no del número de ventas.

Esto **no se declara como un absoluto verificado** — E-017 y el corolario de E-023 son explícitos al
respecto. Se declara el mecanismo y **cómo comprobarlo**: contando las consultas emitidas con el
log de Prisma (`$on("query")`) sobre un rango **sembrado con ventas online reales**, nunca leyendo
un `EXPLAIN` sobre una tabla que no tiene las filas del caso.

Dos columnas y solo dos: `deliveryFee` y `currencyCode`. `PedidoEntrante.code` es credencial pública
del comprador y no entra en ninguna proyección (ADR 0061); los datos de contacto tampoco.

### 3. Cómo se convierte: `Number` y `convertToBase`, no una aritmética nueva

`deliveryFee` es `Decimal(14,2)` y está **en la moneda del pedido** (`currencyCode`), igual que
`subtotal` y `total`. Los dos pasos son los que ya existen:

1. `Number(pedido.deliveryFee)` — exactamente el paso que `tiendaOnlineOrderLanding.ts:521` ya aplica
   a `Number(pedido.total)` antes de pasarlo por `buildOnlineSaleAmounts`.
2. `convertToBase(monto, pedido.currencyCode, rates, baseCurrency)` — `src/lib/currency.ts:170`, la
   misma función con la que `normalizeSale` valora cada línea, y **la misma con la que
   `buildOnlineSaleAmounts` produjo `Venta.total`**.

Que las dos mitades pasen por la misma función con el mismo snapshot es lo que hace que
`mercancía + envío` reconstruya `Venta.total` en vez de aproximarlo. El snapshot es el de la venta:
`resolveSnapshotFromHistory` (`currency.ts:130`) da precedencia al `tasaSnapshot` que el aterrizaje
escribió en la propia `Venta` (`tiendaOnlineOrderLanding.ts:576`), así que es literalmente el mismo
juego de tasas con el que se calculó el total. **No se convierte con la tasa de hoy.**

**No se introduce ningún redondeo nuevo.** `roundBaseToAnchorCents` (`currency.ts:204`) y
`anchorCents` (`currency.ts:218`) existen y **no se aplican aquí a propósito**: cuantizar cada
sumando por separado desplaza la suma respecto de `Venta.total`, que se calculó cuantizando —o no—
una sola vez sobre el total. El envío se suma con `+=` sobre números en base, exactamente igual que
`totalPeriodo` y `totalBruto`. Para comparar «mercancía + envío» con `Venta.total` sin ruido de coma
flotante lo que se usa es una tolerancia, y ya hay una escrita: `SALE_TOTAL_TOLERANCE_BASE`
(`src/constants/venta.ts:15`).

### 4. `hasRates` pasa a tener en cuenta la moneda del envío

`hasRates` (`sales-stream.ts:316`) se calcula con `missingRateCodes` sobre `currenciesUsed`, que hoy
se llena **solo desde las líneas**. Una venta online **sin ninguna línea reservada** —que existe: el
aterrizaje escribe la venta aunque no reserve nada— tendría `currenciesUsed` vacío, `hasRates: true`,
y un envío convertido con una tasa que no existe, cayendo a 1 en silencio.

Por eso, cuando el envío es distinto de cero, `pedido.currencyCode` entra en `currenciesUsed` antes
de calcular `hasRates`. Con envío cero no entra: convertir cero no necesita tasa, y añadirlo marcaría
como «sin tasas» ventas que no necesitan ninguna. La decisión de qué monedas hacen falta la sigue
tomando `missingRateCodes`, que es **la** definición del proyecto de «las tasas que una venta
necesita» (E-014, E-039): aquí solo se le da la lista completa de monedas que participan.

### 5. `0` y no `null` para las ventas de mostrador

`deliveryFeeBase` es `number` y vale `0` en una venta de mostrador. No es `number | null`, y la razón
es de comprobabilidad: el agregador lo lee **únicamente dentro de la rama
`origen === TIENDA_ONLINE`**, así que un test puede fabricar una venta `POS` con
`deliveryFeeBase: 15` y comprobar que no aporta nada. Con `null` obligatorio en `POS` ese caso no se
puede construir, y el test pasaría igual con la guarda de origen borrada — que es exactamente el
fixture que no discrimina de E-008.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Deducir el envío como `Venta.total − Σ líneas` | Es lo que el criterio 2 prohíbe. Deja de dar el envío en cuanto la venta lleva propina, y la propina es una columna independiente que nada impide en una venta online. Además es el atajo que el propio contrato de QAB marca como trampa central |
| Copiar `deliveryFee` a una columna nueva de `Venta` en el aterrizaje | Migración + dos copias del mismo dato que pueden separarse, y no arregla las ventas ya aterrizadas. El backlog lo descarta explícitamente: «lo que falta no es guardar el dato, es usarlo» |
| Una segunda consulta agrupada de `PedidoEntrante`, indexada por `pedidoEntranteId`, al estilo de `loadProductDimensions` | `loadProductDimensions` carga un catálogo acotado por tienda; los pedidos de un rango histórico no tienen ese techo. Además obligaría a un `where` propio sobre `PedidoEntrante`, es decir un filtro de tenant nuevo que mantener, cuando la relación desde una `Venta` ya acotada por `tiendaId` no lo necesita |
| Consultar el pedido dentro del agregador | Rompe la pureza de `createSummaryAggregator`, que es el criterio 7. Y convierte cada venta en una consulta |
| Llevar el importe **sin convertir** más su moneda (`deliveryFee` + `deliveryFeeCurrency`) en `NormalizedSale` | Todos los demás importes de `NormalizedSale` ya viajan en base. Un campo en otra moneda obliga a cada agregador a acordarse de convertirlo, y el primero que se olvide suma manzanas con peras sin ningún error |
| Redondear el envío convertido con `roundBaseToAnchorCents` | Cuantizar un sumando desplaza la suma respecto de `Venta.total`, que se cuantizó una sola vez sobre el total. El criterio 1 exige que las dos cifras reconstruyan 55 |

## Consecuencias

**A favor:**

- La cifra de envío es fiel a lo que el negocio cobró, y lo sigue siendo si mañana una venta online
  lleva propina, se le edita un descuento o no reserva ninguna línea.
- Sin migración, sin columna nueva y sin dato duplicado: el enlace y las columnas ya existían.
- `createSummaryAggregator` sigue siendo puro, así que las dos cifras se verifican sin base de datos
  (criterio 7).
- `hasRates` deja de mentir sobre una venta online sin líneas.

**En contra / coste asumido:**

- `NormalizedSale` gana un campo, así que **todo test que construya ese objeto entero deja de
  compilar hasta completarlo**. Es la red, no el problema — y hay uno hoy,
  `src/__tests__/salesSummaryTiendaOnline.test.ts`.
- El `include` añade una consulta por lote a **todos** los reportes que pasan por
  `streamNormalizedSales`, incluidos los de negocios que no usan la tienda online. Es el precio de no
  tener una segunda consulta condicional que solo se ejercitaría en algunos negocios, es decir un
  camino que casi nunca se prueba.
- `mercancía + envío = Venta.total` se sostiene **cuando todas las líneas del pedido se reservaron**.
  Una venta cuyas líneas no pudieron reservarse aporta su envío y una mercancía menor que el
  subtotal: eso no es un defecto de esta decisión, es el hueco que el backlog ya nombra, y **no debe
  escribirse en ninguna parte como si la igualdad fuera incondicional** (E-017).

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** `PedidoEntrante` no gana ninguna cláusula `where` propia. Se alcanza
  por la relación desde filas de `Venta` **ya filtradas por `scope.tiendaId`**, y `scope` sale de
  `resolveReportScope`, que valida la tienda contra la sesión. No hay un filtro nuevo que se pueda
  quedar sin escribir, que es la forma en que estas fugas ocurren de verdad (E-042: una mención de
  `negocioId` no es un filtro). **Pero eso es un invariante de aplicación, no una garantía del
  schema** — ver el bloque siguiente, que es la precisión que pidió `security-guardian`.
- **Superficie de datos:** se proyectan dos columnas, ninguna de ellas sensible. `code`, contacto y
  notas del pedido no se leen.

### Precisión de `security-guardian`: por qué esto es seguro, y por qué no lo garantiza la base

La revisión de seguridad de F-024 no puso bloqueos, y dejó una precisión que conviene tener escrita
para que nadie la lea de más.

El `include` es seguro **por su forma**: es una relación to-one que Prisma resuelve desde la FK que
ya viene en cada fila de `Venta`, y esas filas salen de un `findMany` acotado por
`where: { tiendaId: scope.tiendaId, … }`. No es una consulta independiente con su propio `where` que
alguien pueda olvidarse de escribir. El conjunto de partida ya está cerrado.

Lo que **no** lo sostiene es el schema, y el propio repositorio tiene el contraste al lado:

| Enlace | Forma de la FK | Qué garantiza la base |
|---|---|---|
| `PedidoEntranteLinea → PedidoEntrante` (`prisma/schema.prisma:1291`) | **Compuesta**: `fields: [pedidoId, negocioId], references: [id, negocioId]` | Que una línea **no puede** apuntar a un pedido de otro negocio. Es la base quien lo impide (ADR 0007) |
| `Venta → PedidoEntrante` (`prisma/schema.prisma:490-491`) | **Simple**: `fields: [pedidoEntranteId], references: [id]`, con `pedidoEntranteId String? @unique` | Solo que haya una venta por pedido. `PedidoEntrante.id` es único **global**: nada en la base impide que una `Venta` de un negocio apunte a un pedido de otro |

La seguridad viene, entonces, de dos cosas juntas: el conjunto de filas ya filtrado **más** el
invariante del camino de escritura — `sellOrder`
(`src/lib/tiendaOnline/tiendaOnlineOrderLanding.ts:453`) escribe `pedidoEntranteId` dentro de una
transacción ya acotada por `tiendaId` y `negocioId`.

F-024 **no añade confianza nueva**: el ADR 0075 ya se apoyaba exactamente en esta misma relación para
derivar `origen` de `Venta.pedidoEntranteId`. Lo único que cambia es que ahora también se leen dos
columnas del otro lado.

**Dónde tendría forma de problema, para el que venga después.** El día que un feature haga

```ts
prisma.pedidoEntrante.findUnique({ where: { id } })
```

con un `id` que **no** salga de una `Venta` ya acotada —de un parámetro de ruta, de un cuerpo, de un
enlace— esa lectura ya no hereda ningún filtro, y `PedidoEntrante.id` es único global: devolvería el
pedido de cualquier negocio. Eso es E-043 exactamente —una columna `@unique` global es un eje de
tenant más— y necesita su propio filtro de negocio, que en este modelo ya está preparado:
`@@unique([id, negocioId])` y el par `{ id_negocioId: { id, negocioId } }` que
`findOrderLandingBlocker` ya usa (`tiendaOnlineOrderLanding.ts:94-96`). **La regla es: un pedido
alcanzado desde una venta acotada no necesita filtro; un pedido alcanzado por su id sí, siempre.**
- **Escalabilidad:** una consulta adicional por lote de 500 ventas, resuelta por clave primaria de
  `PedidoEntrante`. No hace falta índice nuevo. La forma de medirlo, cuando se mida, es contando
  consultas sobre datos sembrados — no un `EXPLAIN` sobre una tabla vacía (E-023).
