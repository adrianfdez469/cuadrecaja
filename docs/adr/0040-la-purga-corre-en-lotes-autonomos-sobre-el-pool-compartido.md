# ADR 0040: La purga corre en lotes autónomos sobre el pool compartido, sin transacción interactiva

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-019
**Relacionado:** [ADR 0015](0015-pool-de-conexiones-dedicado-para-el-drenaje.md) ·
[ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md)

## Contexto

El ADR 0015 resolvió, para el drenaje, la pregunta de disponibilidad que importa en este sistema:
*«¿qué le pasa a una venta del POS que necesita una conexión mientras el drenaje sostiene la suya?»*
La respuesta fue un `PrismaClient` propio, `qabPrisma`, con un pool pequeño y separado
(`QAB_SYNC_DB_CONNECTION_LIMIT_DEFAULT = 2`), para que una transacción de hasta 45 s cada 2 minutos
no pueda quitarle una conexión a una venta.

El criterio 6 de F-019 traslada esa misma pregunta a la purga, y la formula al revés: no *«¿la purga
molesta al POS?»* sino *«¿la purga molesta al drenaje?»* — con 5000 filas purgables, `drainQabOutbox`
lanzado en paralelo no debe quedarse esperando.

Hay dos decisiones acopladas que hay que tomar juntas, porque la respuesta a cada una cambia la otra:

1. **Sobre qué cliente corre la purga**: el `prisma` compartido de `src/lib/prisma.ts` o `qabPrisma`.
2. **Qué forma tiene la escritura**: un `DELETE` masivo, una transacción interactiva que envuelve un
   bucle de lotes, o lotes autónomos sin transacción propia.

Y un hecho de partida que hace la primera pregunta menos obvia de lo que parece: el pool de
`qabPrisma` tiene **dos** conexiones, y el drenaje necesita una durante hasta 45 s cada 2 minutos.
La intuición de «es código de QAB, va en el cliente de QAB» empeora exactamente el criterio que hay
que cumplir.

## Decisión

**La purga corre sobre el `prisma` compartido, sin abrir ninguna transacción interactiva: cada lote
es una sentencia autónoma con su propio límite de filas.**

```ts
// src/lib/qab/outboxPurge.ts — una llamada, un lote, una sentencia
DELETE FROM "OutboxEvento"
WHERE id IN (
  SELECT id FROM "OutboxEvento"
  WHERE <predicado de la fase>
  ORDER BY <columna de la fase>
  LIMIT ${QAB_OUTBOX_PURGE_BATCH_SIZE}
  FOR UPDATE SKIP LOCKED
)
```

Tres cotas, las tres constantes nombradas:

| Constante | Valor | Qué acota |
|---|---|---|
| `QAB_OUTBOX_PURGE_BATCH_SIZE` | `500` | Filas por sentencia — el mismo tamaño que el lote del drenaje |
| `QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN` | `40` | Sentencias por fase: tope de 20 000 filas por fase y corrida |
| `QAB_OUTBOX_PURGE_RUN_DEADLINE_MS` | `45_000` | Presupuesto de la corrida completa, con `maxDuration = 60` en la ruta |

### Por qué el pool compartido y no `qabPrisma`

Porque `qabPrisma` es el pool **del drenaje**, y el criterio 6 exige no estorbarlo. Con dos
conexiones, la purga sosteniendo una durante toda su corrida deja al drenaje con una sola; y el
escenario que el propio ADR 0015 describe —una corrida de drenaje que se acerca a sus 45 s y la
siguiente arrancando encima, dos conexiones largas solapadas— pasaría entonces a esperar en la cola
de Prisma hasta `pool_timeout` y podría fallar. Meter la purga en el pool del drenaje es la forma más
directa de incumplir el criterio que la motiva.

El precedente está escrito en el propio ADR 0015, que ya trazó esta frontera para el otro caso corto
de F-002:

> *«`syncTiendaCron.ts` **no** cambia de cliente para el `findMany` de negocios elegibles del pull:
> es una lectura corta e indexada, no una transacción larga, y no hay razón para aislarla del pool
> compartido.»*

La purga cae del mismo lado de esa frontera, y por la misma razón: **lo que el ADR 0015 aísla es una
transacción larga, no «el código de QAB»**. La purga no tiene ninguna. Sus sentencias no esperan E/S
de red por dentro (a diferencia del drenaje, que hace `POST` a un tercero dentro de su transacción),
no dependen de la respuesta de nadie y están acotadas a 500 filas.

Lo que sí cuesta esta decisión, dicho sin adornos: cada sentencia de la purga ocupa una conexión del
pool que sirve al POS durante lo que tarde en borrar 500 filas. No es cero. Lo que lo hace aceptable
son tres cosas medibles por separado: es una sentencia corta y no una transacción de 45 s, cubierta
por índice (ADR 0041) en las dos fases; hay una pausa natural entre lotes, porque cada uno es un
viaje de ida y vuelta; y corre **una vez al día** a las 03:17, no cada dos minutos.

### Por qué lotes autónomos y no una transacción interactiva

Un `$transaction` envolviendo el bucle daría atomicidad de la corrida completa, y no hace falta:
**la purga no tiene ninguna invariante que abarque más de un lote.** Borrar 500 filas purgables y
que la corrida se caiga después deja la tabla en un estado perfectamente consistente —simplemente
quedan filas purgables para mañana—. La atomicidad que el ADR 0010 sí necesitaba para el drenaje
venía de una invariante real (lotes disjuntos entre corridas concurrentes); aquí no hay equivalente.

Y el coste de envolverlo sería exactamente el que el ADR 0015 quiso evitar: una transacción abierta
durante toda la corrida, sosteniendo los locks de todas las filas borradas hasta el final. Sin
envolverla, cada lote confirma y libera sus locks antes de que empiece el siguiente.

### Por qué las filas de purga y de drenaje son conjuntos disjuntos

Es la parte del criterio 6 que hay que argumentar, no solo afirmar. `claimOutboxBatch` reclama
`procesadoAt IS NULL AND intentos < QAB_OUTBOX_MAX_ATTEMPTS`. Las dos fases de la purga son:

| Fase | Predicado | Por qué es disjunto del reclamo del drenaje |
|---|---|---|
| `exhausted` | `procesadoAt IS NULL AND intentos >= QAB_OUTBOX_MAX_ATTEMPTS AND ocurridoAt < cutoff` | Coincide en `procesadoAt IS NULL` y **se opone en `intentos`**: el drenaje exige `< 6`, la purga `>= 6` |
| `processed` | `procesadoAt IS NOT NULL AND procesadoAt < cutoff` | **Se opone en `procesadoAt`**: el drenaje exige `IS NULL` |

Los dos predicados niegan una condición que el reclamo del drenaje afirma, así que ninguna fila
pertenece a la vez a un lote de purga y a un lote de drenaje. Y eso también se sostiene **durante**
una transacción de drenaje en curso, bajo `READ COMMITTED` (el nivel por defecto), que es el caso
que de verdad hay que comprobar:

- Una fila que el drenaje va a marcar procesada: hasta que su transacción confirma, la purga sigue
  viendo `procesadoAt = NULL` e `intentos < 6` — ni una fase ni la otra. Cuando confirma, su
  `procesadoAt` es `now()`, más reciente que cualquier `cutoff`.
- Una fila que el drenaje va a agotar (`intentos` 5 → 6): hasta que confirma, la purga ve `5` y la
  descarta. Cuando confirma, entra en la fase `exhausted` solo si además su `ocurridoAt` supera los
  90 días.
- Una fila ya agotada: el drenaje nunca la reclama, así que **nunca la bloquea** — `FOR UPDATE OF o`
  solo bloquea las filas que el reclamo devuelve.

El `FOR UPDATE SKIP LOCKED` del subselect de la purga no es, entonces, lo que garantiza la
disjunción: eso lo garantizan los predicados. Está por otra razón, y conviene no confundirlas: es lo
que hace que la purga **no espere** por un lock de fila sostenido por cualquier otra cosa —una
consulta manual, un feature futuro— en vez de quedarse bloqueada dentro de su propia sentencia. El
precio es explícito y benigno: una fila que estuviera bloqueada se salta y se borra en la corrida de
mañana.

Lo que **no** desaparece con nada de lo anterior, y por eso está escrito arriba: la competencia por
una conexión del pool compartido, y el trabajo que el propio `DELETE` le da al motor (WAL, y las
entradas de índice de las filas borradas). Está acotado por lote y por corrida, no eliminado.

### El horario

`"schedule": "17 3 * * *"` en `vercel.json`. Las 03:00 y las 04:00 —los dos horarios diarios
ocupados— quedan libres, y el minuto 17 es impar a propósito: el cron de sync corre en
`*/2 * * * *`, es decir en los minutos pares, así que la purga arranca a mitad de camino entre dos
corridas de drenaje. Es una reducción de la probabilidad de solaparse, no una garantía: el disparo
de un cron de Vercel es aproximado y una corrida de drenaje puede durar hasta 45 s.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Un solo `DELETE` sin `LIMIT`** | Lo que el criterio 6 prohíbe. Una sentencia sobre 5000 filas —o sobre 500 000, el día que alguien despliegue esto tarde— es una transacción implícita larga, con todos los locks retenidos hasta el final y una conexión ocupada durante todo el rato. Y no hay forma de acotarla salvo esperar. |
| **`deleteMany` de Prisma con `where` y sin ids** | `deleteMany` no acepta `limit`, así que degenera en el caso anterior. La cota por lote obliga a `$executeRaw`, y por lo mismo el `SKIP LOCKED`, que Prisma no expresa en su API tipada. |
| **Leer los ids con `findMany` y borrarlos con `deleteMany({ where: { id: { in } } })`** | Dos viajes por lote en vez de uno, sin ganar nada, y trae 500 `BigInt` a la memoria del proceso por lote — el peligro de E-003, gratis. La forma elegida no materializa ningún `id` en JavaScript: solo devuelve un conteo. |
| **`qabPrisma` en vez del pool compartido** | Es el pool del drenaje, con dos conexiones. La purga ocupando una durante toda su corrida es precisamente lo que el criterio 6 quiere evitar; usar el cliente «del módulo» por simetría estética empeora la propiedad que se está protegiendo. |
| **Un tercer `PrismaClient` con su propio pool para la purga** | Aísla, sí, y a cambio de una conexión más reservada permanentemente en un entorno serverless, para un proceso que corre una vez al día durante segundos. El ADR 0015 pagó ese precio por una transacción de 45 s cada 2 minutos; aquí no hay nada que lo justifique. |
| **Una transacción interactiva envolviendo el bucle de lotes** | Sostiene una conexión y todos los locks durante la corrida completa, que es el patrón que el ADR 0015 aísla. Y compraría una atomicidad que la purga no necesita: no hay ninguna invariante que abarque más de un lote. |
| **`pg_cron` o un job de base de datos** | Saca la purga del runtime web por completo, que es atractivo, y es una dependencia de infraestructura nueva y un sitio más donde vive lógica —fuera del repositorio, sin tests, sin revisión—. Los tres crons existentes van por `vercel.json`; este es el cuarto. |
| **Borrar por rango de `id` (`id < X`) en vez de por fecha** | Más barato aún, y apoyado en una correlación (`id` creciente ≈ `ocurridoAt` creciente) que no es una garantía del modelo y que la fase `processed` rompe: el orden de `procesadoAt` no es el orden de `id` —un evento reintentado se procesa después que otros más nuevos—. Un TTL tiene que mirar la fecha que dice mirar. |

## Consecuencias

**A favor:**
- El drenaje no comparte pool con la purga: agotar el pool de la purga no puede impedirle arrancar.
- Ninguna transacción interactiva nueva en el sistema. Cada lote confirma y suelta sus locks antes
  del siguiente, así que la ventana de retención de locks está acotada por lote, no por corrida.
- Las tres cotas son constantes: un despliegue puede bajar el tamaño de lote o el tope de lotes sin
  tocar la lógica, y la corrida siguiente recoge lo que quedó.
- La corrida es idempotente en el sentido que importa: interrumpirla no deja nada a medias, solo
  filas purgables para mañana.

**En contra / coste asumido:**
- **La purga sí compite por el pool compartido**, el mismo que sirve al POS. Acotado por sentencia
  (500 filas, cubierta por índice) y por horario (una vez al día, 03:17), no eliminado. Si algún día
  la purga ocupa minutos, este ADR es el que hay que revisar.
- El tope de 20 000 filas por fase y corrida significa que un atraso mayor tarda varios días en
  drenarse. Es deliberado —una purga que se pasa media hora borrando es peor que una que tarda tres
  días— y visible: el informe devuelve `stopReason: "batch_cap"` cuando pasa.
- Dos sentencias en SQL crudo, fuera de la API tipada de Prisma, con sus nombres de columna en
  literales. Un renombrado de columna en `schema.prisma` no las rompería en `tsc`, solo en tiempo de
  ejecución. Es el mismo coste que ya paga `claimOutboxBatch`.
- El minuto 17 reduce el solape con el drenaje; no lo elimina.

**Impacto en seguridad y escalabilidad:**
- **La purga no filtra por `negocioId`, a propósito**, y eso está auditado, no supuesto: es
  mantenimiento de una cola técnica que borra filas ya resueltas de todos los negocios en la misma
  corrida. Para que la ausencia de filtro no se convierta en una superficie de datos entre tenants,
  el informe del endpoint devuelve **únicamente conteos agregados**: ni un `negocioId`, ni un `id` de
  evento, ni un `ultimoError`. Un desglose por negocio se descartó por eso mismo.
- **Disponibilidad, como el ADR 0015:** el fallo se contiene donde nace. Una purga lenta o caída deja
  filas purgables para mañana; no bloquea al drenaje ni cancela ninguna venta.
- **Escalabilidad:** el coste de una corrida está acotado por las tres constantes y no por el tamaño
  de la tabla. El caso que este ADR no cubre es el opuesto —que el atraso crezca más rápido que
  20 000 filas al día—, y su señal es `stopReason: "batch_cap"` repetido día tras día.
- **Reversión trivial:** un archivo de lib, una ruta y una entrada de `vercel.json`. No hay estado
  persistido nuevo que migrar. Lo irreversible son las filas borradas, que es asunto del ADR 0039.
