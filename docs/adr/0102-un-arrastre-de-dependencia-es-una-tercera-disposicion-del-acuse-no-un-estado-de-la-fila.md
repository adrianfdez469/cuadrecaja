# ADR 0102: Un arrastre de dependencia es una tercera disposición del acuse, no un estado nuevo de la fila

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-028 (parte B)
**Se apoya en:** [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md) ·
[ADR 0039](0039-destino-de-los-eventos-agotados-del-outbox.md) ·
[ADR 0092](0092-el-drenaje-retiene-business-en-la-reclamacion-y-la-lista-de-monedas-tiene-un-solo-simbolo.md) ·
[ADR 0100](0100-cancelar-un-exchange-rate-superado-borra-la-fila-y-no-anade-un-estado-al-outbox.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) ·
[E-035](../../.agents/errors/E-035-la-lista-de-testabilidad-cierra-antes-que-el-diseno.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md)
**Extiende:** la tabla de verdad vinculante de [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md)
con una séptima fila

## Contexto

La v11 del contrato de queandabuscando añadió un desenlace que no existía cuando se escribió el
ADR 0011: **un evento puede volver en `failed[]` sin que el evento esté mal**. La fila de la tabla
de errores de `sync-contract.md` (v12.1, § «Errores», la fila `207` de
`DEPENDENCY_FAILED_IN_BATCH`) lo dice con estas palabras, y es «el único de la tabla que **no** dice
que el evento estuviera mal»: el evento es correcto, falló otro anterior del mismo lote del que
depende, y hay que reintentarlo **tal cual**, con su `updatedAt` original. Las dependencias
reconocidas son dos y solo dos, y están definidas en `sync-contract.md` § «Cambios respecto a la
v10.1» ③ — no se reproducen aquí (E-039). El documento vive fuera de este repositorio, en la ruta
que declara la variable de entorno `QAB_DOCS_PATH`.

Ese desenlace **está vivo, no es una previsión**: verificado el 2026-09-07 en el código del lado
receptor, `DEPENDENCY_FAILED_IN_BATCH` es una constante suya que se lanza en su `processBatch`, con
tests contra Postgres.

Y hoy nuestro lado lo trata como un fallo propio. Los hechos, comprobados en el código:

- **`planOutboxAck`** (`src/lib/qab/outboxAck.ts`) mete **toda** entrada de `failed[]` en
  `failedAcks`, sin mirar el código de error.
- **`drainQabOutbox`** (`src/lib/qab/outboxDrain.ts`) escribe `failedAcks` con un `updateMany` que
  hace `intentos: { increment: 1 }` y pisa `ultimoError`.
- **`claimOutboxBatch`** exige `intentos < QAB_OUTBOX_MAX_ATTEMPTS` (6) en su `WHERE`.

Consecuencia: cada arrastre gasta uno de los seis intentos de un evento que **nunca llegó a
aplicarse**. Un `CATEGORY` que tarde seis corridas en resolverse se lleva por delante a todos sus
productos, que pasan de *existir mal* —publicados con `localCategoryId` nulo— a **no existir**.

### Lo que la forma del plan no puede expresar

`IQabOutboxAckPlan` (`src/schemas/qabSync.ts`) tiene hoy **dos** listas, `processedIds` y
`failedAcks`, y **las dos escriben**: la primera pone `procesadoAt` y limpia `ultimoError`; la
segunda incrementa `intentos` y escribe `ultimoError`. No hay forma de decir «esta fila se deja
tal cual» a través de ninguna de las dos.

Ese desenlace —no tocar la fila— **sí existe hoy en el drenaje**, dos veces: el grupo que se salta
por deadline (`outcome: "skipped_deadline"`, `outboxDrain.ts`) y las entidades retenidas de
[ADR 0092](0092-el-drenaje-retiene-business-en-la-reclamacion-y-la-lista-de-monedas-tiene-un-solo-simbolo.md).
Pero en los dos casos la fila **nunca se envió**, así que nunca llega a `planOutboxAck`. Este es el
primer caso de una fila que **se envió, obtuvo respuesta y no debe escribirse**.

### La tensión con el ADR 0100, que hay que resolver explícitamente

La parte A de este mismo feature decidió, en el
[ADR 0100](0100-cancelar-un-exchange-rate-superado-borra-la-fila-y-no-anade-un-estado-al-outbox.md),
**no añadir ningún estado nuevo al ciclo del outbox**, y lo argumentó con un censo de las consultas
de `OutboxEvento`. Si aquí se añade uno, los dos ADR se leerían como incoherentes. La diferencia
está en qué se proponía en cada caso, y es la que decide:

| | ADR 0100 (parte A) | Este ADR (parte B) |
|---|---|---|
| Qué era el estado candidato | Una **columna** (`canceladoAt`) | Una **tercera lista** en el objeto que devuelve una función pura |
| Dónde viviría | En la tabla, para siempre | En memoria, dentro de una corrida |
| Qué vería una consulta de `OutboxEvento` | Una fila con `procesadoAt IS NULL` que ya no significa «pendiente» | Nada: la fila **es** pendiente y no cambia ninguna columna |
| Qué escribe en la base | Una columna nueva | **Nada. Ni una columna** |
| Coste de vocabulario | Dieciséis consultas tendrían que distinguir «cancelado» de «pendiente» | Ninguna consulta cambia |

El ciclo de estados **de la fila** sigue teniendo exactamente los tres que el
[ADR 0039](0039-destino-de-los-eventos-agotados-del-outbox.md) tabula —pendiente, procesado,
agotado— y un arrastrado es **pendiente**, indistinguible de una fila que esta corrida no envió. El
vocabulario que crece es el **del acuse**, que es un objeto de una función pura, y esa es una
frontera distinta.

### El censo, recorrido entero

Se recorrieron uno por uno **todos** los sitios que participan del acuse y **todos** los que leen o
escriben `OutboxEvento` en `src/`, con el `grep` sobre `outboxEvento.` y `"OutboxEvento"`, no de
memoria (E-035).

**Grupo 1 — el acuse. Los que tienen que aprender la palabra nueva:**

| Sitio | Qué cambia |
|---|---|
| `planOutboxAck` (`outboxAck.ts`) | **Produce** la tercera lista. Su partición pasa de dos a tres, y sigue siendo total |
| `qabOutboxAckPlanSchema` (`schemas/qabSync.ts`) | Un campo nuevo, con su schema de entrada propio |
| `drainQabOutbox` (`outboxDrain.ts`) | **Único consumidor del plan.** No suma la tercera lista a ninguno de los dos `updateMany` |
| `emptyQabOutboxDrainReport` (`outboxAck.ts`) | Un campo más a cero, por el campo nuevo del informe |
| `qabOutboxDrainReportSchema` (`schemas/qabSync.ts`) | El campo nuevo del informe |
| `syncTiendaCron.ts` (línea 91) | **Nada**: usa la factoría, que ya trae el campo |

**Grupo 2 — los veintidós accesos a `OutboxEvento`, en diez módulos.** Ninguno cambia, y el motivo
es uno solo y comprobable: **una fila arrastrada no cambia ninguna columna**, así que no hay nada
que ninguna consulta pueda observar. Lo que sí merece mirarse uno por uno es qué **dice** cada
lector sobre una fila arrastrada, porque ahí sí hay diferencias con el comportamiento de hoy:

| Sitio | Acotado a | Qué dice de una fila arrastrada |
|---|---|---|
| `claimOutboxBatch` (`outboxDrain.ts`) | `procesadoAt IS NULL AND intentos < 6`, entidades drenables | **La vuelve a reclamar en la corrida siguiente**, que es justo lo que se quiere. Hoy también, hasta la sexta |
| `outboxDrain.ts` (los dos `updateMany`) | ids del plan | La fila **no aparece en ninguno de los dos**: cero escrituras |
| `readQabProductoTiendaSyncStates` (`qabProductSyncState.ts`) | `PRODUCT`, `procesadoAt: null` | **Aquí hay una mejora concreta.** `buildStoreSyncState` (`qabStoreSyncState.ts`) devuelve `PENDING` para una fila con `ultimoError` nulo, y `FAILED`/`BLOCKED` cuando no lo es. Con este cambio un producto arrastrado que nunca falló por su cuenta se ve **en cola**, que es la verdad; hoy se ve `FAILED` y a la sexta `BLOCKED`, culpando al producto de algo que no hizo |
| `readStoreSyncStates` (`qabStoreSyncState.ts`) | `STORE`, `procesadoAt: null` | Igual, si algún día se arrastrara un `STORE`. Hoy el contrato no reconoce ninguna dependencia que lo arrastre |
| `readProductoTiendaIdsWithPendingProductEvent` (`qabAvailabilityQuery.ts`) | `PRODUCT`, `intentos < 6` | Sigue contándola como «todavía reintentable», que es correcto |
| `deleteQabOutboxPurgeBatch`, fase `exhausted` (`outboxPurge.ts`) | `procesadoAt IS NULL AND intentos >= 6` | **No la recoge**, porque un arrastre no sube `intentos`. Es un coste, y está escrito abajo |
| `deleteQabOutboxPurgeBatch`, fase `processed` | `procesadoAt IS NOT NULL` | La recogerá cuando la fila acabe aplicándose, como cualquier otra |
| `readQabWithheldOutboxPending` (`qabCatalogOutboxFilters.ts`) | `entidad IN QAB_OUTBOX_WITHHELD_ENTITIES` | Sin efecto |
| `readSyncedCategoriaIds`, `readSyncedCurrencyCodes`, `readSyncedExchangeRateCodes`, `readQabCategoryCarriers`, `readQabCurrencyCarriers` (idem) | Existencia de fila por entidad | Sin efecto: la fila existe antes y después, igual |
| `collectQabAppliedStorePublishes` (`qabStoreOutboxFilters.ts`) | `STORE`, ids acusados | Sin efecto: un arrastrado no está en `processedIds` |
| `readQabSlugLearningTargets` (`slugLearn.ts`) | `STORE` | Sin efecto |
| `hasEverPublishedToStore`, `hasAnyStoreEvent`, `readPublishedTiendaIds` (`tiendaOnlineStore.ts`) | `STORE` | Sin efecto |
| `enqueueOutboxEvents` (`outboxEnqueue.ts`) | Escritura de filas nuevas | Sin efecto |
| `cancelSupersededExchangeRateEvents` (`outboxCancel.ts`, parte A) | `EXCHANGE_RATE` de una clave `(negocio, moneda)`, `procesadoAt IS NULL` | **Sin efecto, y conviene decirlo:** una `EXCHANGE_RATE` arrastrada sigue siendo pendiente, así que si el comerciante registra una tasa nueva de esa moneda, la parte A la borra. Es el comportamiento correcto y ya decidido — hay una más nueva detrás — y las dos partes de F-028 no se estorban |
| `collectQabPermanentFailures` (`outboxAck.ts`) | Puro, entradas de `failed[]` | Sin efecto: `QAB_OUTBOX_PERMANENT_ERROR_CODES` no contiene este código, correctamente. Su definición está en su docstring y no se reescribe aquí (E-039) |

## Decisión

**Un arrastre es una TERCERA DISPOSICIÓN del plan de acuse: la fila no se acusa de ninguna manera y
no se le escribe ninguna columna. No hay columna nueva, no hay migración y no hay ningún estado
nuevo observable en la tabla.**

`planOutboxAck` pasa de devolver dos listas a devolver tres, y sigue siendo **total**: cada fila
enviada aparece en exactamente una. La tercera, `deferrals`, es la lista de las que el drenaje
**no escribe**.

### La séptima fila de la tabla del ADR 0011

La tabla de verdad de `planOutboxAck` del
[ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) es vinculante y sigue siendo la definición de
sus seis filas, que no se tocan ni se parafrasean aquí (E-039). Este ADR le **añade una**:

| Caso | `procesadoAt` | `intentos` | `ultimoError` |
|---|---|---|---|
| El id viene en `response.failed` con `error` exactamente igual a un miembro de `QAB_OUTBOX_DEFERRED_ERROR_CODES` | sigue `null` | **sin tocar** | **sin tocar** |

Es la única fila de las siete en la que **las tres columnas quedan como estaban**. La fila del
ADR 0011 «El id viene en `response.failed` → `+1` / `EVENT:<error>`» sigue rigiendo **todos** los
demás códigos de error, sin excepción: el criterio 9 de F-028 es el que lo verifica ejecutando.

### `ultimoError` no se escribe, y el motivo no es la comodidad

Es la decisión menos evidente de este ADR, porque `ultimoError` es la señal que un humano lee para
saber por qué un evento no avanza. Tres razones, en orden de peso:

1. **La pantalla diría una mentira.** `buildStoreSyncState` clasifica por `ultimoError`: nulo →
   `PENDING`; no nulo → `FAILED`, o `BLOCKED` si `intentos >= QAB_OUTBOX_MAX_ATTEMPTS`. Escribir
   `EVENT:DEPENDENCY_FAILED_IN_BATCH` haría que la pantalla de estado de sincronización de un
   producto correcto dijera **fallido**. Un arrastrado no ha fallado: no se ha aplicado todavía.
2. **«No tocar la fila» es una propiedad de una sola pieza, y por eso es verificable.** El criterio
   5 pide leer la fila antes y después y encontrarla igual. Con `ultimoError` fuera, «igual» es la
   fila entera, no «igual menos una columna».
3. **Cuesta una escritura más en la transacción más caliente de la integración.** El `updateMany`
   de fallos agrupa por mensaje idéntico y va acoplado a `intentos: { increment: 1 }`; escribir solo
   `ultimoError` exigiría un tercer camino de escritura para no incrementar.

Lo que se conserva, y es honesto llamarlo por su nombre: si la fila **ya había fallado por su
cuenta** antes de ser arrastrada, conserva su `ultimoError` viejo y su `intentos` viejo. Eso no es
un error de contabilidad, es historia cierta —el último fallo atribuible a esa fila— pero **no
refleja lo que pasó en la última corrida**. La corrida se cuenta en otro sitio: ver abajo.

### Dónde se ve un arrastre

Como la fila no lo registra, la visibilidad no es opcional: es la única forma de que un arrastrado
no espere en silencio. Dos canales, los dos calcados de piezas que ya existen:

- **Una línea de log por arrastre**, con el helper `logQabOutboxDeferral` de
  `src/lib/qab/qabOutboxLog.ts`, con la forma de `logQabPermanentFailure`: solo ids y el código
  **cerrado y propio**, nunca la cadena recibida de QAB. Canal `warn`, el mismo que
  `logQabWithheldOutbox` usa para «un atasco esperando algo», que es exactamente lo que un arrastre
  es.
- **Un campo `deferrals` en el informe de la corrida** (`IQabOutboxDrainReport`), hermano de
  `permanentFailures`.

Y los contadores del informe: un arrastrado **no cuenta como `failed`**, ni en el contador global ni
en el de su negocio. Los dos se derivan de `failedAcks`, así que la exclusión es estructural.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Meter el código en `QAB_OUTBOX_PERMANENT_ERROR_CODES` | Es lo contrario de lo que se pide. Esa lista es de fallos que **fallarán igual las seis veces**, y su función lectora, `collectQabPermanentFailures`, dice en su docstring que **no cambia nada de la mecánica de reintento**: la fila igual toma su `intentos++`. Un arrastre es lo opuesto en las dos dimensiones — no es permanente y no debe contar. Reutilizar ese mecanismo daría visibilidad y **seguiría gastando los seis intentos** |
| Ampliar `QAB_OUTBOX_ERROR_CODES` con un prefijo nuevo | Esa lista es de valores que se escriben **en `ultimoError`**. Un arrastrado no escribe `ultimoError`, así que no hay dónde poner el prefijo. Y si se escribiera, se cae en el punto 1 de arriba |
| Que `drainQabOutbox` filtre `plan.failedAcks` después de recibirlo | Deja **dos** expresiones de la misma regla —el plan dice «falló», el drenaje lo desdice— y a partir de ahí la fuente de verdad es ambigua. Es el defecto que el [ADR 0101](0101-la-cancelacion-del-exchange-rate-superado-lee-con-skip-locked-y-decide-con-una-funcion-pura.md) evitó en la parte A haciendo de la función pura la **autoridad**. Aquí la autoridad es `planOutboxAck` |
| Una función colectora aparte, `collectQabDependencyDeferrals(rows, outcome)`, además del plan | Es el patrón de `collectQabPermanentFailures` y aquí sobra: esa función existe porque **solo reporta**, sin tocar la partición. Esta sí cambia la partición, así que tener las dos significaría clasificar dos veces lo mismo con dos funciones que pueden divergir. Una lista, un productor |
| Columna nueva (`arrastradoAt`, o un contador de arrastres) | Es exactamente lo que el ADR 0100 descartó, con el mismo coste: migración (E-052, E-004), un filtro nuevo en la consulta más caliente, la fila dentro de `idx_outbox_pendiente` sin que ninguna fase de la purga la alcance, y una palabra nueva para todas las consultas del censo. Y aquí, además, **para nada**: sin columna, la fila ya queda en el estado exacto que el criterio pide |
| `procesadoAt = now()` para el arrastrado, dándolo por bueno | E-014 en su forma más directa, y además falso: el contrato dice que el evento **no se aplicó** en absoluto. Marcarlo procesado publicaría un producto que del otro lado no existe |
| Reencolar una fila nueva con `updatedAt` posterior (lo que pedían los criterios 5-8 viejos) | Lo **prohíbe** el contrato v11: un arrastrado se reintenta tal cual, con su `updatedAt` original. Fabricar una marca nueva aplicaría el evento por encima de algo más reciente. Los criterios se reescribieron en sitio por decisión del humano del 2026-09-07 justo por esto; programar contra la redacción vieja sería E-018 |
| No hacer nada y esperar a que el residual se note | El fallo ya está vivo del otro lado y es **silencioso**: un producto que desaparece del escaparate no avisa |

## Consecuencias

**A favor:**
- Un arrastrado se reintenta con su `payload` intacto y **sin gastar intento**, que es lo que el
  contrato ordena y lo que los criterios 5, 7 y 8 verifican ejecutando.
- **Cero columnas, cero índices, cero migraciones de Prisma.** Como consecuencia y no como olvido,
  E-052 (`prisma format`), E-004 (`--create-only` no interactivo) y E-002 (cliente viejo tras una
  migración) no tienen dónde manifestarse. Igual que en el ADR 0100: **si al implementar aparece la
  necesidad de `npx prisma generate`, es la señal de que algo se desvió del contrato.**
- Los tres estados observables de la fila que el ADR 0039 tabula siguen siendo tres.
- La pantalla de estado de sincronización de un producto arrastrado pasa a decir `PENDING` en vez de
  `FAILED`, sin que nadie toque esa pantalla.
- `planOutboxAck` sigue siendo pura y total; la clasificación es comprobable en un test unitario sin
  base de datos (criterio 10).
- **Reversión local**: quitar la tercera lista es un cambio en una función pura y en su único
  consumidor. No hay datos que migrar, porque nunca se escribió ninguna marca.

**En contra / coste asumido:**
- **La columna no cuenta los arrastres.** Un evento arrastrado cincuenta veces sigue con
  `intentos = 0`, y su `ultimoError` es el de su último fallo propio o `null`. Quien mire solo la
  tabla no sabrá que ese evento lleva esperando: hay que mirar el log o el informe de la corrida.
  Es el precio de no escribir nada y no hay atenuante.
- **La fase `exhausted` de la purga no alcanza a un arrastrado**, porque `intentos` no crece. Si la
  fila acaba aplicándose, la fase `processed` la recoge con su TTL normal; si se quedara arrastrada
  para siempre —el residual del [ADR 0103](0103-el-arrastre-se-clasifica-por-igualdad-exacta-y-no-lleva-cota-propia.md)—
  no la recogería ninguna de las dos. Es una fila pendiente legítima, así que ese comportamiento es
  el correcto, pero conviene saberlo antes de buscar el motivo en la purga.
- `IQabOutboxAckPlan` gana un campo, y **tres aserciones de test preexistentes que fijan la forma
  exacta** dejan de cuadrar y hay que actualizarlas. Están nombradas una por una en el contrato de
  interfaces del spec, § 11.3. Hay precedente inmediato: F-027 hizo lo mismo al añadir `withheld`,
  y el propio test lo dejó comentado.
- Este feature **no** repara el producto que ya quedó huérfano porque su `CATEGORY` agotó los
  intentos. Queda fuera por decisión del humano del 2026-09-07 y **no se escribe en ningún sitio que
  lo cubra** (E-017).

**Impacto en seguridad y escalabilidad:**
- **Aislamiento multi-tenant.** La disposición se decide **solo sobre las filas que esta corrida
  envió**: `planOutboxAck` ignora cualquier id de `ok`/`failed` que no estuviera en el lote, y esa
  propiedad —que el ADR 0011 ya registra como comprobable sin base de datos— **no se relaja**. Los
  campos del arrastre (`negocioId`, `entidad`, `entidadId`) salen de la **fila local**, nunca de la
  respuesta. Un 207 hostil no puede hacer que se deje de escribir una fila de otro negocio, porque
  ni siquiera puede nombrarla.
- **Entrada externa.** `entry.error` es una cadena que QAB controla por completo. Llega validada
  como `z.string()` por `qabCatalogSyncResponseSchema` antes de esta clasificación, y lo único que
  se hace con ella es una **igualdad exacta** contra una lista cerrada propia
  ([ADR 0103](0103-el-arrastre-se-clasifica-por-igualdad-exacta-y-no-lleva-cota-propia.md)). No se
  trunca, no se interpola en ningún mensaje y no se guarda: la cadena recibida **muere en la
  comparación**. Es lo que cierra estructuralmente E-031 en este camino.
- **Escalabilidad.** El cambio **reduce** escrituras: las filas arrastradas salen de los
  `updateMany` del drenaje. El coste añadido es una línea de log por arrastre y una entrada en el
  informe, las dos acotadas por `QAB_OUTBOX_BATCH_SIZE` (500) por corrida.
- **Consultas.** Ninguna nueva, ninguna modificada, ningún `WHERE` tocado.
