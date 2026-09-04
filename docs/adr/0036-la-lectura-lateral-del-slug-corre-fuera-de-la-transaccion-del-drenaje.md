# ADR 0036: La lectura lateral del slug corre fuera de la transacción del drenaje, y su elegibilidad se consulta, no se recuerda

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-020

## Contexto

`Tienda.slugQab` existe desde F-001 y **nada la escribe** ([E-013](../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md)).
El acuse del sync (§ ① «Respuesta» del contrato v10) devuelve `{ ok, failed, results }` y
**nunca** el slug, así que el valor no se puede aprender del acuse. La única vía es una lectura
lateral a `GET /api/internal/slug-availability` (§ ⑥) con el `storeId` ya conocido.

Restricciones que existían antes de decidir:

- El drenaje del outbox corre **en una sola transacción interactiva** (`drainQabOutbox`, ADR 0010)
  sobre un pool dedicado (`qabPrisma`, ADR 0015), con presupuesto `QAB_SYNC_RUN_DEADLINE_MS`
  (35 s) y `QAB_SYNC_TX_TIMEOUT_MS` (45 s) dentro de una ruta con `maxDuration = 60`.
- El criterio 5 del spec exige que un fallo de esa lectura **no** re-encole el evento `STORE`, no
  suba `intentos` y no tumbe la pasada.
- El criterio 4 exige que la lectura no mueva `Negocio.qabUltimoPedidoVisto` ni toque
  `PedidoEntrante`.
- La columna es `null` mientras no se aprenda, y **un tope de intentos mal elegido la deja en
  `null` para siempre**, que es exactamente el patrón de E-013.
- `security-guardian` (F-020) marcó como crítico que el emparejamiento
  `(negocioId, token, tiendaId)` no puede quedar librado al implementador: el cron recorre varios
  negocios en la misma pasada, y una lista plana con los tokens resueltos por otro lado escribe el
  `resolvedSlug` del negocio A en una `Tienda` del negocio B.

## Decisión

**El aprendizaje es una fase propia del cron, entre el drenaje y el pull, fuera de toda
transacción; su conjunto elegible se define con UNA consulta sobre estado persistido, y no se
guarda ningún estado de reintento.**

Cuatro piezas:

**(a) Fuera de la transacción, después del drenaje.** `learnQabAssignedSlugs` se llama en
`runQabSyncTiendaCron` cuando `drainQabOutbox` **ya devolvió** —es decir, cuando su transacción ya
hizo commit— y antes del bucle del pull. No recibe la transacción, no recibe las filas del outbox
y no puede escribir en `OutboxEvento`. El aislamiento del criterio 5 es **estructural**, no una
disciplina de `try/catch`: la fase no tiene acceso a lo que podría contaminar.

**(b) La elegibilidad se consulta, no se hereda del informe.** El conjunto es:

> las `Tienda` de los negocios indicados, con `slugQab IS NULL`, que tienen **al menos un
> `OutboxEvento` de tipo `STORE` de ese local, con `payload.publishToStore = true`, y
> `procesadoAt IS NOT NULL`**.

Se define **en un solo sitio** —`qabAppliedPublishWhere`, en `src/lib/qab/qabStoreOutboxFilters.ts`—
y nadie la parafrasea ([E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md)).
El informe del drenaje (`appliedStoreEvents`) **solo reordena** ese conjunto para que un publish
recién aplicado se intente primero; una entrada del informe que no esté en el conjunto se ignora.
Reordenar no amplía la elegibilidad.

**(c) Reintento indefinido mientras `slugQab` siga `null`, sin estado nuevo.** No hay contador de
intentos, no hay columna de último error, no hay tope. Cada pasada del cron vuelve a preguntar por
lo que sigue sin aprender, porque la pregunta se responde con una consulta y no con un recuerdo. Lo
único acotado es **cuánto se intenta por pasada**: `QAB_SLUG_LEARN_MAX_PER_RUN` objetivos y
`QAB_SLUG_LEARN_DEADLINE_MS` de presupuesto, recortado además por el presupuesto de la corrida
completa. Un objetivo que no entra en una pasada **no pierde nada**: vuelve a la cola de la
siguiente por la misma consulta.

**(d) El emparejamiento va agrupado por negocio, como el drenaje.** Los objetivos se agrupan con
`groupQabSlugLearningTargetsByNegocio` (mismo patrón que `groupOutboxEventsByNegocio`), el token se
resuelve **por clave** con `loadQabTokens` —nunca por índice de array, nunca con un `select` nuevo
(ADR 0013)— y cada objetivo lleva su propio `negocioId` dentro del mismo registro que lleva su
`tiendaId`. Un objetivo cuyo `negocioId` difiera del de su grupo es `QabTenantMismatchError`
—invariante dentro de la función, igual que en `toQabCatalogBatch`—, se reporta como
`tenant_mismatch` y no escribe nada. La escritura es
`updateMany({ where: { id, negocioId, slugQab: null } })`: `count !== 1` es fallo silencioso de esa
pasada, nunca una excepción.

## Un supuesto del contrato v10 que este ADR deja anotado

El § ⑥ dice que `storeId` **«solo decide `own` frente a `taken`»**. Leído al pie de la letra,
`resolvedSlug` se calcula a partir del `candidate` con independencia de `storeId`, y entonces
`reason: "own"` implica `resolvedSlug === candidate`: la lectura lateral solo puede **confirmar**
que `Tienda.slug` es la dirección asignada, y **no puede enseñar un valor distinto**. Con esa
lectura, el caso divergente —pedí `la-rampa`, me asignaron `la-rampa-2`— responde `taken` y no se
aprende nunca.

La lectura contraria también cabe en el documento: como `slug` es semilla **solo al crear**,
publicar ahora una tienda que ya existe no cambia su slug, así que «el slug que quedaría si se
publicara AHORA» para un `storeKnown: true` **es** su slug actual, y eso da `own` con el valor real
cualquiera que sea el candidato.

**Qué se decidió al respecto:** nada que dependa de resolverlo, porque **el código de cuadrecaja es
idéntico bajo las dos lecturas** —solo escribe lo que venga en el `resolvedSlug` de una respuesta
`own`, sea igual o distinto del candidato (ADR 0037)— y el reintento indefinido de (c) hace que la
columna se pueble sola el día que la ambigüedad se cierre del lado de QAB, sin cambiar una línea
aquí. Lo que **no** se puede afirmar es que el caso divergente del criterio 1 funcione contra QAB
real: contra el doble HTTP funciona por construcción, y contra QAB depende de esta ambigüedad. Es
una pregunta para el equipo de queandabuscando, no un bloqueo de este feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dispararla **dentro** de `drainQabOutbox`, en el mismo `for` de los grupos | Una llamada HTTP de hasta 10 s por local dentro de una transacción interactiva que ya puede durar 45 s, sobre un pool de 2 conexiones. Y sobre todo: dentro de la transacción, un fallo de esa lectura **puede** contaminar el acuse (un `throw` aborta el commit de `processedIds`). El criterio 5 pasaría a depender de recordar un `try/catch` en el sitio correcto. |
| Que el conjunto elegible sea **solo** `appliedStoreEvents` del informe de esta pasada | Un local cuyo publish se aplicó en una pasada y cuya lectura falló no vuelve a tener un evento `STORE` aplicado hasta que el comerciante edite algo. La columna se queda en `null` para siempre: E-013 reproducido literalmente, y el criterio 5 («hasta la siguiente oportunidad de aprenderla») quedaría sin ninguna oportunidad siguiente. |
| Un tope de intentos por local, como los 6 del outbox | Es la forma más directa de reproducir E-013: agotados los intentos, la columna vuelve a ser `null` para siempre y la UI vuelve a decidir siempre por la misma rama. El outbox puede permitirse un tope porque un evento agotado **se ve** (`syncState: BLOCKED`); aquí no habría nada que mirar. |
| Persistir el intento (una `Tienda.slugQabIntentos`, una `slugQabUltimoError`) para hacer backoff | Migración y estado nuevo para una decisión que la consulta ya responde gratis. Además abre la puerta al riesgo que `security-guardian` señaló en su punto 5: un campo nuevo alimentado con texto derivado de la respuesta de un tercero. Sin estado nuevo, ese riesgo no existe. |
| Una fase separada con una lista plana de `(tiendaId, negocioId)` y un `Map` de tokens aparte | Es el patrón que `security-guardian` marcó como crítico. Agrupar por negocio cuesta diez líneas puras y convierte el desalineamiento en imposible por construcción. |
| Un `Tienda.findMany({ where: { slugQab: null } })` global, sin `negocioId` | Prohibido explícitamente: `Tienda` no tiene `@@unique([id, negocioId])`, así que leer sin negocio y comparar después es exactamente lo que el comentario de `saveTiendaOnlineLocal` prohíbe. El `negocioId` va en el `where` de la lectura **y** en el de la escritura. |
| Una sola consulta SQL cruda con el `EXISTS`, para que el `LIMIT` caiga sobre el conjunto ya filtrado | Obligaría a escribir el predicado de «publish aplicado» **una segunda vez** en SQL, junto a su versión Prisma. Es la parafraseada de E-014 con otra sintaxis. Se prefirió pagar la cota de (b) —documentada abajo— antes que duplicar la definición. |

## Consecuencias

**A favor:**

- El criterio 5 se cumple por construcción: la fase no puede tocar `OutboxEvento`, ni
  `Negocio.qabUltimoPedidoVisto`, ni `PedidoEntrante`, porque no los recibe y no los nombra.
- Reintento indefinido sin estado nuevo, sin migración y sin tope: la columna no puede quedarse en
  `null` «para siempre» por decisión nuestra.
- El aislamiento multi-tenant es una invariante de función, no una convención: agrupación por
  negocio, token por clave, `where` compuesto en la escritura, y `QabTenantMismatchError` para lo
  que no encaje.
- **Ningún desenlace de la lectura lateral tumba la fase.** Transporte, un cuerpo que no parsea, un
  `reason` distinto de `own`, un `resolvedSlug` que no valida, una escritura que no aterrizó, un
  desalineamiento de tenant, un negocio sin token y un objetivo fuera del presupuesto vuelven todos
  como una entrada de `results[]` con su código cerrado (`upstream_error`, `not_own`,
  `invalid_slug`, `not_written`, `tenant_mismatch`, `skipped_no_token`, `skipped_deadline`). Eso es
  lo que pide el criterio 5, y por eso la ruta del cron no necesita un `try/catch` propio para esta
  fase: nada de eso re-encola el evento `STORE`, sube `intentos` ni bloquea la pantalla.
- **Un fallo de base de datos sí se propaga**, igual que en el drenaje: ninguna consulta de la fase
  va envuelta —las dos del conjunto elegible, la de los tokens (`loadQabTokens`) y el `updateMany`
  de la escritura—, así que un pool roto tumba
  la pasada y la ruta del cron responde 500. Es deliberado, y queda escrito aquí para que la promesa
  coincida con el código: tragarse un error de base de datos esconde un pool roto detrás de un
  informe lleno de ceros. Y no se pierde nada cuando ocurre — la fase no persiste estado de
  reintento, así que la pasada siguiente vuelve a preguntar lo mismo (pieza (c) de esta decisión).

**En contra / coste asumido:**

- Una pasada del cron puede terminar con objetivos sin intentar (tope o deadline). Es visible en el
  informe (`skipped_deadline`) y se recupera en la pasada siguiente, a dos minutos.
- La cota de (b): la consulta de respaldo del backlog lee como máximo
  `QAB_SLUG_LEARN_CANDIDATE_MAX_ROWS` filas de `Tienda` ordenadas por `id`. Un negocio integrado
  con más locales que esa cota **y** con `slugQab IS NULL` en todos ellos podría dejar un elegible
  fuera de la pasada. Mitigado: los locales cuyo evento `STORE` se aplicó **en esta misma pasada**
  entran por su propia consulta, sin pasar por esa cota, así que un publish nuevo nunca se queda
  fuera; lo que puede esperar es un elemento del backlog.
- El caso divergente puede no ser aprendible contra QAB real (ver la sección de arriba). Coste
  visible: la pantalla se queda en el estado «publicado sin dirección conocida», que este feature
  diseña a propósito (ADR 0038), en vez de mostrar una URL falsa.

**Impacto en seguridad y escalabilidad:**

- Tres consultas acotadas por pasada (negocios elegibles ya los tenía el cron; locales candidatos;
  el `groupBy` del predicado de publish aplicado sobre esos candidatos). Sin N+1: ninguna **lectura**
  se hace por local; la escritura sí, acotada por `QAB_SLUG_LEARN_MAX_PER_RUN`.
- El `groupBy` se apoya en el índice `@@index([entidad, entidadId])` de `OutboxEvento` y va acotado
  por la lista de candidatos. No hace falta índice nuevo ni migración.
- Como máximo `QAB_SLUG_LEARN_MAX_PER_RUN` peticiones HTTP por pasada, cada una con el
  `AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)` que ya trae `fetchQabSlugAvailability`, y con un
  deadline de fase que no puede comerse el presupuesto de la corrida.
- Ninguna conexión de la fase queda dentro de una transacción larga: corre sobre `qabPrisma` con
  consultas cortas.
