# ADR 0100: Cancelar un `EXCHANGE_RATE` superado borra la fila, y no añade un estado nuevo al outbox

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-028 (parte A)
**Se apoya en:** [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md) ·
[ADR 0039](0039-destino-de-los-eventos-agotados-del-outbox.md) ·
[ADR 0046](0046-la-senal-de-ya-sincronizado-se-deriva-del-outbox.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) ·
[E-035](../../.agents/errors/E-035-la-lista-de-testabilidad-cierra-antes-que-el-diseno.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md)

## Contexto

El spec de F-028 parte A (`.agents/specs/F-028.md`) deja **dos preguntas abiertas** al arquitecto:

1. ¿Cómo se marca «superado» sin invadir el significado de `procesadoAt`?
2. ¿La cancelación borra la fila, o la deja con una marca?

Las restricciones que las dos tienen que respetar ya están escritas y son vinculantes:

- **`procesadoAt` tiene un solo significado.** La tabla de verdad de `planOutboxAck`
  ([ADR 0011](0011-reintentos-del-outbox-sin-backoff.md), sección «Decisión») es la definición: la
  única fila de esa tabla que escribe `procesadoAt = now()` es «El id viene en `response.ok`». No
  se parafrasea aquí — se cita y se remite a ella (E-039).
- **`intentos` tampoco está libre.** La misma tabla lo define como fallos, y el ADR 0011 lo dice
  con todas las letras: «un evento con `intentos` alto es, por definición, un evento problemático:
  la columna es directamente un indicador».
- **El índice parcial del drenaje** es
  `ON "OutboxEvento" (id) WHERE "procesadoAt" IS NULL`
  ([ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md)). Una fila que conserve
  `procesadoAt IS NULL` **sigue dentro de ese índice**.
- **Ese índice ya tiene un problema conocido de envenenamiento**, descrito en
  [ADR 0039](0039-destino-de-los-eventos-agotados-del-outbox.md): las filas agotadas viven ahí,
  tienen los `id` más bajos, y el drenaje las lee y descarta en cada corrida. Ese ADR también deja
  escrita la tabla de los **tres** estados observables de `OutboxEvento` hoy —pendiente, procesado,
  agotado— y quién mueve cada uno.

Y el dato que decide el reparto de coste: **hoy `OutboxEvento` no tiene ningún estado que signifique
«esta fila ya no hace falta pero no llegó a QAB»**. Si la cancelación lo introduce, es **vocabulario
nuevo** del ciclo del outbox, y todas las consultas que hoy dicen «pendiente» con
`procesadoAt IS NULL` pasan a decir algo que ya no es cierto.

### El censo, recorrido entero

Se recorrieron **todos** los sitios de `src/` que leen o escriben `OutboxEvento`, uno por uno, no de
memoria (E-035). Para cada uno: a qué entidad está acotado, y qué le pasaría si existiera una fila
`EXCHANGE_RATE` cancelada con `procesadoAt IS NULL`.

| Sitio | Acotado a | Con una fila cancelada que conserva `procesadoAt IS NULL` |
|---|---|---|
| `claimOutboxBatch` (`outboxDrain.ts`) | `entidad IN QAB_OUTBOX_DRAINABLE_ENTITIES`, que incluye `EXCHANGE_RATE` | **La sigue reclamando y la envía.** Necesita un filtro nuevo |
| `deleteQabOutboxPurgeBatch`, fase `exhausted` (`outboxPurge.ts`) | `procesadoAt IS NULL AND intentos >= QAB_OUTBOX_MAX_ATTEMPTS` | **No la recoge nunca**: una fila cancelada no vuelve a fallar, así que `intentos` se queda donde estaba. Necesita una fase nueva |
| `deleteQabOutboxPurgeBatch`, fase `processed` | `procesadoAt IS NOT NULL` | No la recoge tampoco |
| `readQabWithheldOutboxPending` (`qabCatalogOutboxFilters.ts`) | `entidad IN QAB_OUTBOX_WITHHELD_ENTITIES`, hoy `["BUSINESS"]` | Sin efecto |
| `readQabProductoTiendaSyncStates` (`qabProductSyncState.ts`) | `PRODUCT` | Sin efecto |
| `readStoreSyncStates` (`qabStoreSyncState.ts`) | `STORE` | Sin efecto |
| `readProductoTiendaIdsWithPendingProductEvent` (`qabAvailabilityQuery.ts`) | `PRODUCT` | Sin efecto |
| `collectQabAppliedStorePublishes` (`qabStoreOutboxFilters.ts`) | `STORE`, `procesadoAt: { not: null }` | Sin efecto |
| `readSyncedCategoriaIds` (`qabCatalogOutboxFilters.ts`) | `CATEGORY`, cualquier fila | Sin efecto |
| `readSyncedCurrencyCodes` (idem) | `CURRENCY`, cualquier fila | Sin efecto |
| **`readSyncedExchangeRateCodes`** (idem) | **`EXCHANGE_RATE`, cualquier fila** | **Este es el que hay que mirar**: es la señal de [ADR 0046](0046-la-senal-de-ya-sincronizado-se-deriva-del-outbox.md), y la consume el arranque perezoso de `enqueueProductPublishEvents` (`src/lib/tiendaOnline/tiendaOnlineProducts.ts`) |
| `readQabCategoryCarriers` (idem) | `CATEGORY` | Sin efecto |
| `readQabCurrencyCarriers` (idem) | `CURRENCY` | Sin efecto |
| `hasEverPublishedToStore`, `hasAnyStoreEvent`, `readPublishedTiendaIds` (`tiendaOnlineStore.ts`) | `STORE` | Sin efecto |
| `readQabSlugLearningTargets` (`slugLearn.ts`) | `STORE` vía `qabAppliedPublishWhere` | Sin efecto |
| `planOutboxAck` (`outboxAck.ts`) | Puro; opera sobre las filas que la corrida reclamó | Sin efecto: solo ve lo que `claimOutboxBatch` le pasó |

Dieciséis entradas (la de `tiendaOnlineStore.ts` agrupa tres funciones con el mismo acotamiento).
Un estado nuevo obliga a tocar **dos** de ellas (el drenaje y la purga) y a
enseñar a un tercero (`readSyncedExchangeRateCodes`) qué contar. Borrar la fila no obliga a tocar
ninguno.

## Decisión

**La cancelación BORRA la fila. No se toca `procesadoAt`, no se toca `intentos`, no se añade
ninguna columna y no se introduce ningún estado nuevo en el ciclo del outbox.**

Las dos preguntas abiertas del spec **se responden con una sola decisión**, y merece decirse por
qué colapsan: la pregunta 1 («cómo se marca») solo existe si la respuesta a la 2 es «marcar». Al
borrar, no hay nada que marcar, así que `procesadoAt` conserva la definición del ADR 0011 sin
enmienda y `intentos` la suya.

El criterio de selección de fila es, literal, el `WHERE` completo:

```sql
"negocioId" = $1
  AND entidad = 'EXCHANGE_RATE'
  AND "entidadId" = $2
  AND "procesadoAt" IS NULL
```

Cuatro cosas que este ADR fija, y que no son evidentes:

### 1. «Pendiente» es `procesadoAt IS NULL`, sin condición sobre `intentos`

Una fila agotada (`procesadoAt IS NULL` con `intentos >= QAB_OUTBOX_MAX_ATTEMPTS`) **también se
borra**. Tres razones:

- Es lo que el spec pide: «cualquier evento `EXCHANGE_RATE` de esa misma moneda y ese mismo negocio
  que siga sin procesar». «Sin procesar» es `procesadoAt IS NULL` según la tabla del ADR 0011.
  Añadir `intentos < QAB_OUTBOX_MAX_ATTEMPTS` sería estrechar el criterio desde arquitectura.
- Es el mismo argumento que el ADR 0012 usó para dejar `intentos` fuera del predicado del índice
  parcial: no acoplar la regla al valor de una constante de aplicación.
- Cuesta un diagnóstico y lo devuelve enseguida. Sí, borrar una fila agotada se lleva su
  `ultimoError`, que el ADR 0011 valora («un evento muerto conserva su causa clasificada»). Pero la
  causa que mató a esa fila es de configuración, no del evento —el caso que el ADR 0039 describe es
  un negocio con el interruptor puesto y sin `qabToken`, donde *todas* sus filas mueren igual— así
  que la fila de reemplazo que se encola en la misma transacción vuelve a morir por lo mismo y el
  `ultimoError` reaparece en la corrida siguiente.

### 2. El outbox no es un registro de auditoría, y eso ya estaba decidido

Es el coste real de borrar, y hay que decirlo sin adornos: **se pierde el rastro de que hubo una
tasa registrada que nunca salió.** Lo que hace ese coste asumible no es una opinión, son dos hechos
del repositorio:

- **El hecho de negocio no vive en el outbox, vive en `TasaCambio`.** Ese modelo guarda una fila por
  registro con su `tasa`, su `createdAt` y su `creadoPorId`, e indexa
  `@@index([negocioId, monedaCode, createdAt])`. La tasa registrada y quién la registró siguen
  ahí después de la cancelación. Lo que se borra es el **artefacto de transporte**, no el dato.
- **Que las filas del outbox son borrables ya lo decidió el ADR 0039**, que las purga bajo TTL: 30
  días desde `procesadoAt` para las procesadas, 90 desde `ocurridoAt` para las agotadas. Un
  subsistema que borra sus filas por edad no las estaba tratando como auditoría permanente. Esta
  decisión no abre esa puerta: la usa.

### 3. La señal del ADR 0046 se conserva, y por una razón concreta

`readSyncedExchangeRateCodes` contesta «¿este negocio ya emitió alguna vez un `EXCHANGE_RATE` de
este código?» por la existencia de **cualquier** fila con la clave
`(negocioId, "EXCHANGE_RATE", entidadId)` — la definición está en
[ADR 0046](0046-la-senal-de-ya-sincronizado-se-deriva-del-outbox.md) y no se reescribe aquí.
Borrar filas de esa clave podría, en principio, hacer que la señal cambie de valor y que el
arranque perezoso vuelva a emitir un `EXCHANGE_RATE` que ya había salido.

No cambia de valor, y la razón es que la cancelación y el encolado del reemplazo **son la misma
transacción** (ver [ADR 0101](0101-la-cancelacion-del-exchange-rate-superado-lee-con-skip-locked-y-decide-con-una-funcion-pura.md)).
Los casos son estos dos, enumerados en vez de resumidos en un absoluto:

- La clave tenía filas y **al menos una** con `procesadoAt IS NULL`: se borran esas y se inserta la
  nueva. Estado confirmado: al menos una fila.
- La clave tenía filas y **ninguna** con `procesadoAt IS NULL`: no se borra nada y se inserta la
  nueva. Estado confirmado: las que había, más una.

En los dos, el estado que cualquier lector posterior ve tiene al menos una fila de la clave. El
`DELETE` sin el `INSERT` no es un desenlace que este camino produzca, porque un `ROLLBACK` se lleva
los dos.

### 4. Lo que esta pieza NO hace

No cierra por sí sola ninguno de los agujeros de S-005 ni de S-006. Es una de las **dos capas** de
defensa en profundidad que las notas de F-028 describen, y la otra —la guarda anti-rancio por
`updatedAt`, del lado de QAB— no está construida. Concretamente, y en positivo:

- **Cubre** el evento `EXCHANGE_RATE` de la misma `(negocioId, moneda)` que todavía está en la tabla
  con `procesadoAt IS NULL` y que ninguna corrida de drenaje tiene reclamado en ese instante.
- **No cubre** el evento que ya salió en la petición HTTP hacia QAB, ni el que QAB ya aplicó y
  acusó. Sobre esos dos, esta decisión no cambia nada.

Lo que la cancelación acota es la ventana entre el registro de la tasa nueva y el próximo drenaje.
No es «una tasa vieja nunca llega»: eso no lo sostiene este código.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `procesadoAt = now()` en la fila superada | Es exactamente E-014: la columna pasaría a significar dos cosas y la tabla de verdad del ADR 0011 dejaría de ser la definición de nada. Y la mentira sería consultable: la purga la recogería a los 30 días como si hubiera llegado a QAB, y `readQabProductoTiendaSyncStates` mostraría «sincronizado» donde no lo está para cualquier entidad a la que se extendiera el patrón |
| `intentos = QAB_OUTBOX_MAX_ATTEMPTS` para que el drenaje deje de tomarla | Mismo defecto sobre la otra columna. El ADR 0011 dice que `intentos` alto **es** el indicador de evento problemático; una fila cancelada no es problemática. Además la haría indistinguible de una envenenada de verdad, y `readProductoTiendaIdsWithPendingProductEvent` usa `intentos < QAB_OUTBOX_MAX_ATTEMPTS` como «todavía reintentable» |
| Columna nueva `canceladoAt DateTime?`, dejando `procesadoAt IS NULL` | Es la opción honesta con el significado de las señales, y aun así se descarta por lo que arrastra: (a) migración de schema, con E-052 y E-004 a cuestas; (b) un filtro nuevo en `claimOutboxBatch`, que es la consulta más caliente de la integración; (c) las filas canceladas se quedan **dentro** de `idx_outbox_pendiente`, que es justo el envenenamiento que el ADR 0039 existe para evitar, y ninguna de las dos fases de la purga las alcanza, así que hace falta una **tercera fase** con su índice parcial; (d) una palabra nueva —«cancelado»— que las dieciséis consultas del censo tendrían que aprender a distinguir de «pendiente». Todo eso para conservar una fila que ningún código lee |
| Columna nueva, poniendo además `procesadoAt` a algo no nulo | Junta lo peor de las dos: la sobrecarga de la señal y la columna extra |
| No cancelar y arreglarlo solo con la guarda anti-rancio de QAB | No está construida (es la excepción marcada de la v11 del contrato) y, según el propio contrato citado en las notas de F-028, no sustituye a la cancelación local: son dos capas, no dos candidatas |
| Reemplazar el `payload` de la fila pendiente en vez de borrarla e insertar otra | Tentador —una fila menos— y peor: rompe el orden por `id` en el que se apoya el ADR 0043 (el evento se quedaría con un `id` viejo y viajaría antes de eventos que ya no le corresponden), y convertiría `ocurridoAt` en una fecha que no es la del cambio que transporta |

## Consecuencias

**A favor:**
- `procesadoAt` e `intentos` conservan exactamente la definición del ADR 0011. Cero señales
  sobrecargadas, cero paráfrasis nuevas de una definición existente.
- Cero columnas, cero índices, **cero migraciones de Prisma**. Como consecuencia, E-052
  (`prisma format`), E-004 (`--create-only` no interactivo) y E-002 (cliente de Prisma viejo tras
  una migración) no tienen dónde manifestarse en este feature.
- Ninguna de las dieciséis consultas del censo cambia. El drenaje deja de ver la fila porque **no
  existe**, no porque haya aprendido a filtrarla.
- `idx_outbox_pendiente` se hace más pequeño, no más grande: la cancelación es lo contrario del
  envenenamiento que describe el ADR 0039.
- La purga no necesita una tercera fase.
- **Reversión trivial**: quitar la llamada. No hay estado que migrar ni filas que reinterpretar,
  porque nunca se escribió ninguna marca.

**En contra / coste asumido:**
- **Se pierde el rastro de la tasa que se registró y nunca salió.** El valor y su autor quedan en
  `TasaCambio`; lo que no queda es el intento de transporte ni su `ultimoError` si la fila estaba
  agotada. Es el precio de esta decisión y no hay atenuante que lo anule.
- Un `DELETE` dentro de la transacción de una mutación del comerciante es trabajo que antes no
  estaba en ese camino. Su coste y su acotación son de la
  [ADR 0101](0101-la-cancelacion-del-exchange-rate-superado-lee-con-skip-locked-y-decide-con-una-funcion-pura.md).
- Si algún día hace falta contar cuántas tasas se cancelaron, no habrá filas que contar: solo la
  línea de log de cada cancelación. Se puede añadir un contador entonces; no se anticipa ahora.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento multi-tenant.** El `@@index([entidad, entidadId])` de `OutboxEvento` **no incluye
  `negocioId`**, así que una consulta por `(entidad, entidadId)` que se apoye en él y no ponga
  `negocioId` en el `WHERE` cruza negocios. El `WHERE` de la cancelación lleva
  `"negocioId" = $1` **como valor de la consulta**, no como guarda de nulidad en otra parte del
  archivo (E-042). El criterio 3 de F-028 es el que lo verifica ejecutando, con dos negocios y dos
  monedas.
- Es un `DELETE` de filas, así que un `WHERE` demasiado ancho **destruye datos**, no solo los
  expone. Por eso el ADR 0101 exige que el `DELETE` solo pueda tocar ids que una función pura
  devolvió, y que cualquier discrepancia entre las dos expresiones de la regla solo pueda cancelar
  **menos**.
- **Escalabilidad.** El conjunto que la cancelación recorre son las filas pendientes de una clave
  `(negocio, moneda)`, no el histórico. En régimen, después de este feature, ese conjunto es de una
  fila. Sin índice nuevo: ver el ADR 0101, que explica de qué depende el plan y cuál sería el
  arreglo si algún día hace falta —sin afirmar un plan que no se ha medido sobre las filas del caso
  (E-023).
