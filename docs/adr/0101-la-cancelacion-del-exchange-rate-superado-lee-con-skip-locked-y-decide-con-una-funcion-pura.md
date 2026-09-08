# ADR 0101: La cancelación del `EXCHANGE_RATE` superado lee con `SKIP LOCKED`, decide con una función pura y borra por id

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-028 (parte A)
**Se apoya en:** [ADR 0100](0100-cancelar-un-exchange-rate-superado-borra-la-fila-y-no-anade-un-estado-al-outbox.md) ·
[ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md) ·
[ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md) ·
[ADR 0043](0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md) ·
[E-023](../../.agents/errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) ·
[E-042](../../.agents/errors/E-042-un-barrido-cuenta-una-mencion-como-si-fuera-un-filtro.md)

## Contexto

El [ADR 0100](0100-cancelar-un-exchange-rate-superado-borra-la-fila-y-no-anade-un-estado-al-outbox.md)
decide **qué** hace la cancelación: borrar las filas `EXCHANGE_RATE` de la clave
`(negocioId, moneda)` que tengan `procesadoAt IS NULL`. Queda **cómo** se ejecuta, y ahí hay tres
cosas que pueden salir mal y que no se ven leyendo el `WHERE`.

**1. Hay otra transacción tocando esas mismas filas cada dos minutos.** El drenaje
(`drainQabOutbox`, una transacción por corrida — [ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md))
reclama su lote con `FOR UPDATE OF o SKIP LOCKED` y **mantiene el bloqueo de fila hasta que su
transacción termina**, con un `timeout` de `QAB_SYNC_TX_TIMEOUT_MS` (45 000 ms). Si la cancelación
intentara borrar una fila que el drenaje tiene reclamada, esperaría ese bloqueo. Y el
`prisma.$transaction` de la ruta del comerciante
(`src/app/api/negocio/[id]/tasas-cambio/route.ts`) no declara `timeout`, así que corre con el de
Prisma por defecto (5 000 ms): **abortaría antes**, y el `POST` acabaría en el `catch` genérico de
la ruta con un 500 y **sin registrar la tasa**. Un feature de defensa en profundidad que hace
fallar el registro de una tasa cuando coincide con un cron no es una mejora.

**2. Es un `DELETE`, no un `UPDATE`.** Un `WHERE` de más en una marca expone datos; un `WHERE` de
más en un borrado los destruye. Y el criterio 3 de F-028 (dos negocios × dos monedas) es
precisamente el criterio de aislamiento de esta pieza, sobre una tabla cuyo
`@@index([entidad, entidadId])` **no lleva `negocioId`**.

**3. El criterio 11 prohíbe que el payload, el token del negocio o el cuerpo de un error de QAB
aparezcan en un log de este camino**, incluido el interior del mensaje de una excepción de runtime
que termine logueada. Y el camino tiene un logueador al final que ya existe y que no es de este
feature: el `catch` del `POST` de `tasas-cambio` hace `console.error(error)` con el error entero.
E-031 es el mecanismo exacto: `JSON.parse`, `BigInt`, `Number` y los drivers **citan el dato que
los rompió** dentro de su mensaje.

Además, el spec pide dos criterios que se verifican mucho mejor si «qué filas hay que cancelar» es
una decisión separada del borrado: el 3 (las cuatro combinaciones de dos negocios × dos monedas) y
el 4 (`procesadoAt` idéntico al milisegundo en una fila ya acusada).

## Decisión

**La cancelación son tres pasos dentro de la transacción de la mutación, en este orden: una lectura
acotada con `FOR UPDATE SKIP LOCKED`, una función pura que decide, y un borrado por id.
Y va ANTES del `enqueueOutboxEvents` de la tasa nueva.**

### 1. `FOR UPDATE SKIP LOCKED` en la lectura

La lectura nomina candidatos con `FOR UPDATE SKIP LOCKED`, así que una fila que el drenaje tiene
reclamada **no entra en la lista** y el borrado no tiene nada sobre lo que esperar. La consecuencia
es doble y las dos mitades interesan:

- La transacción del comerciante no se queda esperando el bloqueo del drenaje, así que el registro
  de la tasa no depende de que coincida o no con una corrida del cron.
- La fila que el drenaje ya reclamó **no se cancela**, que es exactamente el caso que el spec pone
  fuera de alcance: «ya está en vuelo… no es cancelable desde aquí porque ya salió». El límite del
  alcance deja de ser una nota en un documento y pasa a ser una propiedad de la sentencia.

Esto obliga a SQL crudo: `findMany` de Prisma no expresa `FOR UPDATE SKIP LOCKED`. El precedente
literal es `claimOutboxBatch` (`src/lib/qab/outboxDrain.ts`), y el de la forma
`SELECT … FOR UPDATE SKIP LOCKED` + borrado por id es `deleteQabOutboxPurgeBatch`
(`src/lib/qab/outboxPurge.ts`).

`$queryRaw` **no se llama sobre `PrismaClientLike` en ningún sitio de este repositorio**:
comprobado recorriendo todas sus llamadas en `src/`, cada una recibe o el cliente concreto
(`prisma`, `qabPrisma`) o `Prisma.TransactionClient`, nunca la unión. La cancelación toma
`Prisma.TransactionClient`, y por eso
`emitQabExchangeRateEvent` **estrecha su primer parámetro** de `PrismaClientLike` a
`Prisma.TransactionClient`. No es un capricho de tipos: la cancelación tiene que ocurrir en la misma
transacción que el encolado, así que un cliente que no sea transaccional no puede satisfacer el
contrato. El tipo pasa a decir lo que el docstring de esa función ya decía. Los otros tres emisores
del archivo **conservan `PrismaClientLike`**: esto no es una refactorización del módulo.

### 2. La función pura decide, y el `DELETE` solo puede tocar lo que ella devolvió

`selectSupersededExchangeRateEventIds` recibe las filas leídas y devuelve la lista de ids a borrar.
El `DELETE` se construye **a partir de esa lista**, no del `WHERE` de la lectura.

La regla queda entonces expresada dos veces —en el `WHERE` de SQL y en el predicado de la función
pura— y eso es normalmente el defecto de E-014. Aquí es deliberado, y lo que lo hace defendible es
la **dirección** del fallo:

- El `WHERE` de SQL acota **lo que se lee**.
- La función pura decide **lo que se borra**.
- El `where` del `deleteMany` repite además la clave completa.

Una discrepancia entre esas tres expresiones solo puede resultar en que se cancele **menos** de lo
debido, nunca más. Cancelar menos deja la fila vieja pendiente, que es el comportamiento de hoy y se
corrige en el registro siguiente. Cancelar de más sería pérdida de datos o cruce de negocios. El
modo de fallo es unidireccional y por construcción.

Y el beneficio en verificación es concreto: los criterios 3 y 4 se pueden ejercitar sobre la función
pura, sin base de datos y sin red, además de ejecutándolos.

### 3. Cancelar ANTES de encolar

La cancelación va inmediatamente antes del `enqueueOutboxEvents` de `emitQabExchangeRateEvent`, y
después de sus dos guardas (`isQabAnchorCurrency` y `isNegocioTiendaOnlineEnabled`). Tres motivos:

- **La fila nueva todavía no existe**, así que no hay que excluirla. Encolar primero obligaría a
  excluirla por id, y olvidarlo cancelaría la fila recién escrita y dejaría el feature emitiendo
  nada — un fallo silencioso.
- **Después de la guarda del interruptor**: en un negocio con la tienda online apagada no se encola
  nada, y cancelar ahí borraría una fila pendiente sin reemplazo. La propiedad que sostiene el punto
  3 del ADR 0100 es esta: la cancelación no corre si no se va a encolar un reemplazo en la misma
  transacción.
- **Después de la guarda del ancla**: para `QAB_ANCHOR_CURRENCY_CODE` no hay nada que encolar ni
  que cancelar.

No se reemplaza el `payload` de la fila pendiente: eso rompería el orden por `id` en el que se
apoya el [ADR 0043](0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md).

### 4. Nada de este camino puede citar un payload, porque no lo lee

La respuesta al criterio 11 es **estructural**, en la línea de la solución de E-031, no una regla
de estilo que alguien tenga que recordar:

- La lectura **proyecta cinco columnas** —`id`, `negocioId`, `entidad`, `entidadId`,
  `procesadoAt`— y `payload` no está entre ellas. El módulo no tiene el dato, así que ninguna
  excepción suya puede citarlo.
- El módulo **no lee `Negocio`**, así que no toca `qabToken` ni por proyección explícita.
- El módulo **no llama a QAB**, así que no hay cuerpo de error de QAB en su alcance.
- **No hay `JSON.parse` y no hay `BigInt(string)`.** Los ids vuelven del `$queryRaw` como `bigint`
  y se conservan tal cual para el `deleteMany`; hacia fuera se exponen como cadena con
  `.toString()`. La conversión de vuelta —`BigInt(id)`, que lanza un `SyntaxError` **citando la
  cadena**— no existe en este camino.
- Las funciones puras **no validan y no lanzan**: filtran. No hay rama que construya un mensaje.
- El módulo **no tiene `catch`**. Un fallo de base de datos se propaga a la transacción de la ruta,
  que revierte. Lo que ese error puede nombrar son los valores que este módulo mandó a la base:
  `negocioId`, el literal `EXCHANGE_RATE`, el código de moneda, el tope de filas y los ids. El spec
  autoriza expresamente esos: «Como mucho aparecen ids internos (el `id` de la fila, el
  `negocioId`, el `entidadId`)».

El log propio es **una línea**, con el prefijo `qab.outbox.cancel`, y sigue la misma regla que
`logQabPermanentFailure` y `logQabWithheldOutbox` en `src/lib/qab/qabOutboxLog.ts`: ids y cifras.

### 5. Un tope de filas, y ningún índice nuevo

La lectura lleva `ORDER BY id LIMIT QAB_OUTBOX_CANCEL_MAX_ROWS` (100). En régimen, después de este
feature, el conjunto pendiente de una clave `(negocio, moneda)` es de una fila; el tope existe para
el arranque —una clave que ya acumuló pendientes antes de que este código existiera— y para el caso
del ADR 0039 (negocio con interruptor y sin `qabToken`, donde nada se procesa). Si el tope se
alcanza, lo que sobra sigue pendiente y lo cancela el registro siguiente, y el resultado lo dice en
`capReached` en vez de callárselo.

**No se crea ningún índice.** El `WHERE` puede entrar por `@@index([negocioId, procesadoAt, id])`
—que arranca por `negocioId` y tiene `procesadoAt` justo detrás— o por
`idx_outbox_pendiente`, cuyo predicado `WHERE "procesadoAt" IS NULL` este `WHERE` implica
sintácticamente. Lo que **no** se afirma aquí es cuál elige el planificador ni con qué coste: no se
ha medido sobre una tabla con las filas del caso, y un `EXPLAIN` sobre una tabla que no las tiene da
un plan válido y una conclusión falsa (E-023). Lo que sí se puede razonar sin medir es el reparto:
esta sentencia corre **una vez por registro de tasa**, una acción manual de un comerciante, no cada
dos minutos como el drenaje, así que un plan mediocre cuesta un guardado lento y no una degradación
sostenida. El disparador para revisarlo, escrito para que no haya que redescubrirlo: si el
planificador elige `@@index([entidad, entidadId])`, recorre el histórico completo de esa moneda
**en todos los negocios**, que es el único conjunto de los tres que crece sin límite; el arreglo
sería un índice parcial `(negocioId, entidad, entidadId) WHERE "procesadoAt" IS NULL`, en su propia
migración con `CREATE INDEX CONCURRENTLY` ([ADR 0002](0002-create-index-concurrently-en-migracion-aislada.md)).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un solo `deleteMany` de Prisma con el `WHERE` completo, sin lectura previa | Es la opción más corta y la que rompe el caso 1 del contexto: sin `SKIP LOCKED`, el borrado espera el bloqueo del drenaje, el `$transaction` del comerciante aborta a los 5 000 ms y **el registro de la tasa se pierde** con un 500. Además deja los criterios 3 y 4 sin ninguna forma de verificarse fuera de la base |
| Lectura sin bloqueo (`findMany`) y después `deleteMany` | Igual de expuesta al bloqueo, y encima con una ventana entre las dos sentencias |
| `NOWAIT` en vez de `SKIP LOCKED` | Convierte la coincidencia con el drenaje en un error de la mutación en vez de en «esa fila no se cancela». Peor desenlace para el comerciante y ningún beneficio: la fila en vuelo está fuera de alcance de todas formas |
| `SET LOCAL lock_timeout` en la transacción de la ruta | Cambia el comportamiento de bloqueo de **toda** la transacción de la mutación, incluida la escritura de `TasaCambio`, por un problema de una sentencia. Efecto lateral demasiado ancho |
| Que la cancelación viva en `outboxEnqueue.ts` | Ese módulo es genérico y no sabe nada de ninguna entidad en particular; el propio spec lo hace notar. Meterle una regla de `EXCHANGE_RATE` le quita lo que lo hace reutilizable |
| Que la cancelación viva en `qabCatalogOutboxFilters.ts` | Ese archivo declara en su cabecera que son **las lecturas** de la señal del ADR 0046. Un borrado no cabe ahí |
| Sin función pura: el `WHERE` de SQL como única expresión de la regla | Una sola expresión, sí, y los criterios 3 y 4 quedan verificables solo contra Postgres. Se descarta porque el modo de fallo del `DELETE` es destructivo y la segunda expresión, siendo la que decide, solo puede cancelar menos |
| Función pura que además valide y lance con detalle al encontrar una fila inesperada | Un mensaje construido a partir de una fila es exactamente la vía de E-031. Filtra y no lanza |
| Devolver el conteo de cancelaciones en `IQabFanoutResult` | Ese tipo lo comparten los cuatro emisores y su `truncated` ya significa «se alcanzó el tope de portadores». Añadirle un segundo sentido, o un campo que solo uno rellena, es sobrecargar un resultado compartido (E-014). La cancelación devuelve su propio tipo |
| Índice parcial nuevo por si acaso | El argumento del ADR 0012 («se paga ahora, cuando no duele») vale para la consulta que corre cada dos minutos, no para una que corre cuando un humano guarda una tasa. Y añadir el índice traería la migración que el ADR 0100 se ahorra. Queda escrito arriba el disparador y el arreglo exacto |

## Consecuencias

**A favor:**
- El registro de una tasa no puede fallar porque coincida con una corrida del drenaje: la fila
  reclamada se salta en vez de esperarse.
- El límite de alcance «lo que ya está en vuelo no se cancela» es una propiedad de la sentencia, no
  una advertencia en prosa.
- Los criterios 3 y 4 tienen dos verificaciones: una pura y rápida, y la ejecutada que los cierra.
- Cualquier discrepancia entre las tres expresiones de la regla cancela **menos**, y cancelar menos
  es el comportamiento de hoy.
- El criterio 11 se sostiene por lo que el módulo **no** proyecta y **no** llama, no por una
  disciplina que alguien tenga que recordar en cada `catch` futuro.

**En contra / coste asumido:**
- **Dos sentencias donde cabría una**, más una tercera expresión de la regla en el `where` del
  `deleteMany`. Es redundancia deliberada y hay que mantenerla coherente si la regla cambia; el
  contrato de interfaces dice en qué archivo vive cada una.
- **SQL crudo**, que no tiene tipado de columnas: la forma de la fila se afirma en una interfaz a
  mano, igual que en `claimOutboxBatch`, y el compilador no la comprueba.
- `emitQabExchangeRateEvent` **cambia de firma** (su `tx` se estrecha). Su único llamador ya pasa un
  cliente transaccional, así que no hay migración de llamadas, pero es un cambio de firma pública y
  el contrato lo declara como tal.
- El plan de la lectura **no está medido** sobre una tabla con las filas del caso. Queda escrito el
  disparador y el arreglo, no una promesa de rendimiento.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento multi-tenant en tres capas, todas con `negocioId` como valor de la consulta o
  argumento de la función** (E-042: una mención en una guarda de nulidad no es un filtro): el
  `WHERE` de la lectura, el predicado de la función pura y el `where` del `deleteMany`. El criterio
  3 lo verifica ejecutando, con las cuatro combinaciones de dos negocios × dos monedas.
- El único dato de otro tenant al que este camino podría llegar es una fila `EXCHANGE_RATE` de otro
  negocio con el mismo código de moneda, y las tres capas la excluyen por `negocioId`.
- **Autorización**: la ruta que dispara este camino es
  `POST /api/negocio/[id]/tasas-cambio`, que ya valida con `assertNegocioConfigAccess` antes de
  abrir la transacción. Este feature **no añade ni relaja ninguna guarda de esa ruta**.
- **Escalabilidad**: trabajo acotado por `QAB_OUTBOX_CANCEL_MAX_ROWS`, una vez por registro de tasa.
  Ni N+1 ni recorrido de rango histórico.
- **Reversión**: quitar la llamada dentro de `emitQabExchangeRateEvent` y, si se quiere, el módulo
  entero. No hay filas escritas que reinterpretar ni columnas que quitar.
