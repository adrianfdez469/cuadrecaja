# ADR 0046: La señal «este negocio ya sincronizó esto» se deriva del outbox por `(negocioId, entidad, entidadId)`

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-006
**Se apoya en:** [ADR 0035](0035-la-senal-del-primer-publish-se-filtra-por-el-payload.md) ·
[ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md) ·
[E-013](../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md)

## Contexto

Dos mecanismos de F-006 necesitan la misma pregunta contestada, y hoy no existe:

**«¿Este negocio ya sincronizó esta categoría / esta moneda?»**

- El **arranque perezoso**: al publicar un producto hay que emitir su `CATEGORY` (y su `CURRENCY`,
  y su `EXCHANGE_RATE`) **solo si nunca se emitieron para este negocio**. Sin la pregunta, o se
  emiten siempre —ruido en cada publicación— o nunca, y el producto queda sin categoría para
  siempre (asimetría 5 del contrato, criterios 11 y 13).
- La **cascada de categorías globales** (criterio 17): al renombrar una `Categoria` con
  `esGlobal: true`, hay que reemitir en el outbox de **cada negocio que ya la tenga sincronizada**,
  y en **ninguno** más. El criterio lo verifica con un tercer negocio de control que tiene
  productos en esa categoría pero nunca la sincronizó: tiene que quedarse a cero.

El spec delega la decisión al arquitecto y pone dos avisos:

- **E-013**: no usar como señal de estado una columna que **nadie escribe**. Daría siempre el mismo
  valor y la rama nunca se tomaría. Es un fallo que no da error: da un resultado plausible y falso.
- **E-014**: el nombre de una señal derivada y su definición se revisan juntos, y la definición se
  escribe **una vez**. Parafrasearla en ocho sitios hace que una corrección deje alguna atrás.

Lo que ya existe y sirve de precedente: F-005 contestó una pregunta de la misma familia
—«¿este local se publicó alguna vez?»— **derivándola del outbox** con un filtro sobre el `Json`
del `payload`, sin columna nueva (ADR 0035). Y `OutboxEvento` ya tiene `@@index([entidad,
entidadId])`.

## Decisión

**La señal se deriva del outbox: existe al menos una fila de `OutboxEvento` con `negocioId`,
`entidad` y `entidadId` iguales a los de la pregunta.** Sin columna nueva y sin migración.

```
¿categoría sincronizada?  ->  (negocioId, entidad: "CATEGORY",      entidadId: Categoria.id)
¿moneda sincronizada?     ->  (negocioId, entidad: "CURRENCY",      entidadId: Moneda.code)
¿tasa sincronizada?       ->  (negocioId, entidad: "EXCHANGE_RATE", entidadId: TasaCambio.monedaCode)
```

Tres consecuencias, y la tercera es el motivo de que este ADR exista aparte del 0043:

### 1. `entidadId` de `CURRENCY` y `EXCHANGE_RATE` es el **código de la moneda**

No el `Moneda.code` por casualidad, y desde luego **no el `TasaCambio.id`**. Es una elección
deliberada: con el código en `entidadId`, la pregunta es una consulta indexada por
`@@index([entidad, entidadId])`. Con el `TasaCambio.id` habría que preguntar por el `payload` con
un filtro JSON no indexado, o añadir una columna. Nada de este feature necesita saber **qué fila
concreta** de `TasaCambio` originó un evento; todo lo que necesita saber es **si esa moneda ya
salió alguna vez**.

### 2. Esto **no** es el error E-013, y la diferencia hay que decirla

`OutboxEvento.entidadId` **la escribe este mismo feature**, en cada emisión, dentro de la misma
transacción que la mutación. No es una columna heredada que nadie rellena: es el registro de lo que
se emitió, y por eso puede responder por lo emitido. El E-013 avisa contra una columna **muda**;
esta habla.

### 3. Cada señal tiene **una** función con nombre propio, y su definición se escribe una vez

En `src/lib/qab/qabCatalogOutboxFilters.ts`, y en ningún otro sitio (E-014):

| Función | Pregunta exacta |
|---|---|
| `readSyncedCategoriaIds` | de estas categorías, ¿cuáles ya emitió **este negocio**? |
| `readSyncedCurrencyCodes` | de estos códigos, ¿cuáles ya emitió **este negocio** como `CURRENCY`? |
| `readSyncedExchangeRateCodes` | ídem como `EXCHANGE_RATE` |
| `readQabCategoryCarriers` | ¿qué negocios reciben la cascada de **esta categoría global**? |
| `readQabCurrencyCarriers` | ¿qué negocios pueden transportar **esta moneda**? (ver [ADR 0044](0044-currency-viaja-por-abanico-de-portadores.md)) |

Las tres primeras agregan en SQL con `groupBy(["entidadId"])`: devuelven como máximo una fila por
clave, por larga que sea la historia, así que no necesitan tope.

`readQabCategoryCarriers` añade la segunda condición: el negocio tiene que tener la tienda online
**habilitada**. No es un adorno — el drenaje filtra las filas de un negocio deshabilitado en el
propio `claim` (ADR 0021), así que un evento encolado para él **se quedaría pendiente para
siempre**, y la purga de F-019 tampoco recoge filas pendientes.

### La diferencia de tope entre las dos cascadas, que es lo contrario de simétrica

`readQabCategoryCarriers` se acota con `QAB_CATEGORY_CASCADE_MAX_BUSINESSES` y **devuelve
`truncated: true`** cuando llega al tope, y la ruta lo expone en la respuesta. Aquí un tope
**pierde de verdad**: cada negocio tiene su propia fila `LocalCategory` del otro lado, así que un
portador que se quede fuera conserva el nombre viejo hasta que alguien vuelva a editar la
categoría. Un tope silencioso sería el peor de los mundos; un tope observable es una limitación
declarada.

En `CURRENCY` es al revés —la fila del otro lado es global y basta una entrega— y por eso su tope
es otra constante con otro valor y otro razonamiento (ADR 0044).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Columna `qabSincronizadaAt` en `Categoria` | La categoría global es **una fila compartida** por N negocios: una columna suya no puede responder «¿la sincronizó **este** negocio?». Responde a otra pregunta, y encima exigiría migración |
| Tabla nueva `CategoriaSincronizacion(negocioId, categoriaId)` | Migración, y una segunda fuente de verdad que puede desincronizarse del outbox — el defecto que el ADR 0035 ya descartó para F-005 |
| Derivarla de los productos publicados que cuelgan de esa categoría | Contesta a otra pregunta: un producto puede estar publicado y su categoría no haber viajado nunca (es exactamente el agujero que el arranque perezoso viene a tapar). Y el criterio 17 exige que el negocio de control **tenga productos** en la categoría y aun así reciba cero eventos: esta derivación le daría uno |
| Filtrar el `payload` con `path: ["categoryId"]`, como hizo el ADR 0035 con `publishToStore` | Innecesario: allí la pregunta era por el **contenido** del evento (`publishToStore: true`), aquí es por su **existencia**. `entidadId` ya la contesta, está indexado y no depende de que una clave del contrato no se renombre |
| `entidadId` de `EXCHANGE_RATE` = `TasaCambio.id` | Es la fila que originó el evento, pero deja la señal fuera del índice: preguntar «¿ya salió esta moneda?» pasaría a ser un filtro JSON. Nada necesita la fila concreta |
| Preguntar solo por eventos con `procesadoAt` no nulo («sincronizado de verdad») | Emitiría un `CATEGORY` duplicado en cada publicación mientras el primero está en vuelo o reintentando. La pregunta correcta es «¿ya se emitió?», y el propio outbox se encarga de que llegue |
| Cascada sin tope | Una edición de `SUPER_ADMIN` podría encolar miles de filas en la transacción de una petición HTTP |
| Cascada con tope silencioso | Deja negocios con el nombre viejo sin que nadie lo sepa: es el mismo tipo de fallo mudo que este feature existe para evitar |

## Consecuencias

**A favor:**

- Ninguna migración, ninguna columna nueva, ninguna segunda fuente de verdad.
- Las cinco preguntas entran por `@@index([entidad, entidadId])` y las tres del arranque perezoso
  agregan en SQL: como mucho una fila por clave, sea cual sea el histórico.
- Cada señal tiene una función con nombre propio y una sola definición escrita (E-014).
- El criterio 17 se cumple literalmente, negocio de control incluido, porque la condición «ya
  emitió un `CATEGORY` de esta categoría» es exactamente lo que el criterio describe.

**En contra / coste asumido:**

- **La señal sobrevive a la purga solo mientras la fila sobreviva.** F-019 borra las filas
  procesadas a los `QAB_OUTBOX_PROCESSED_TTL_DAYS` (30) días. Pasado ese plazo, una categoría
  sincronizada hace más de un mes **vuelve a parecer no sincronizada** y su siguiente publicación
  de producto emitirá un `CATEGORY` de arranque perezoso de más. **Es inofensivo** —el evento lleva
  el nombre y el color actuales, y del otro lado es un upsert— pero hay que saberlo antes de que
  pase: la segunda parte del criterio 11 («publicar un segundo producto de la misma categoría no
  genera un segundo `CATEGORY`») **se verifica dentro de la ventana de retención**, que es su
  recorrido normal.
- Un negocio con la tienda online apagada no recibe la cascada. Recupera el valor actual por
  arranque perezoso cuando la encienda y publique.
- Con más de `QAB_CATEGORY_CASCADE_MAX_BUSINESSES` portadores, la cascada se trunca y los negocios
  restantes conservan el nombre viejo. Se **expone** en la respuesta; la solución de verdad sería
  un trabajo en segundo plano, que no es de este feature.
- Tres consultas más al outbox en cada publicación de producto. Todas indexadas y agregadas.

**Impacto en seguridad y escalabilidad:**

- `negocioId` va **siempre** en el `where` de las tres consultas por negocio, junto a `entidad` y
  `entidadId`. La tenencia **no se deduce** de que `entidadId` sea un UUID — y en `CURRENCY` ni
  siquiera lo es, es un código de tres letras compartido entre negocios, lo que hace la regla más
  necesaria, no menos.
- Las consultas de portadores no aceptan ningún identificador del cliente: la categoría y la moneda
  llegan de la fila que la ruta ya resolvió y autorizó.
- Ninguna consulta recorre el histórico completo de `OutboxEvento`: todas entran por el índice y
  agregan o llevan `take`.
