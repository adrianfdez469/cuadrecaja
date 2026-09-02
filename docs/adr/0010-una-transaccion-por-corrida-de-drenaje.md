# ADR 0010: Una transacción por corrida de drenaje — los bloqueos de fila se sostienen durante el `POST`

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002

## Contexto

El contrato de queandabuscando publica el SQL de drenaje del outbox en `§①`:

```sql
SELECT * FROM "OutboxEvento"
WHERE "procesadoAt" IS NULL AND intentos < 6
ORDER BY id LIMIT 500
FOR UPDATE SKIP LOCKED;
```

`FOR UPDATE SKIP LOCKED` solo significa algo **mientras la transacción que tomó las filas sigue
abierta**: en cuanto commitea, los bloqueos caen y otra corrida vuelve a ver esas filas. Y entre
tomar el lote y poder marcar el resultado hay una o varias llamadas HTTP a QAB.

De ahí la pregunta que el spec no cierra: ¿se sostiene la transacción durante las llamadas, o se
commitea el reclamo primero y se procesa después?

El criterio 4 la fuerza: *"Dos corridas lanzadas a la vez toman lotes disjuntos: ningún `eventId`
aparece en las dos."* Es un criterio que QA verifica **ejecutando**, y tiene que salir siempre, no
casi siempre.

La alternativa habitual —reclamar y commitear rápido, procesar después— necesita una marca de
reclamo en la fila (un `claimedAt`, un `leaseUntil`) para que la segunda corrida sepa saltárselas.
**F-002 no puede crear columnas**, y sin una marca así el reclamo commiteado es invisible: la fila
sigue con `procesadoAt IS NULL` e `intentos < 6`, o sea, sigue siendo elegible. Dos corridas
separadas por unos milisegundos se llevarían el mismo lote, y el criterio 4 dependería de ganar una
carrera.

## Decisión

**Una corrida de drenaje es una sola transacción interactiva**: reclama el lote, hace los `POST` de
todos los negocios y escribe los acuses, todo dentro de ella. Los bloqueos de fila se sueltan en el
commit final, no antes.

Para que una transacción abierta sobre entrada de red no se vuelva un problema, la decisión incluye
su presupuesto de tiempo, con los números encajados a propósito:

| Constante | Valor | Papel |
|---|---|---|
| `QAB_HTTP_TIMEOUT_MS` | 10 s | `AbortSignal.timeout` de cada `POST` |
| `QAB_SYNC_RUN_DEADLINE_MS` | 35 s | Comprobado **antes** de cada `POST`; lo que no cabe queda pendiente |
| `QAB_SYNC_TX_TIMEOUT_MS` | 45 s | 35 + 10: la transacción no puede durar más que el peor caso |
| `maxDuration` del route | 60 s | Deja ~15 s para la fase de pull posterior |

Y dos reglas de forma que salen de la misma decisión:

- **Los negocios se recorren en serie**, ordenados por el id de evento más antiguo de cada uno. Es
  determinista (los tests no dependen de un orden de `Promise.all`) y justo con los eventos más
  viejos. El orden entre negocios no importa para la corrección: la guarda anti-rancio del contrato
  (`§ Idempotencia`) hace que el orden de entrega sea irrelevante del lado de QAB.
- **Un negocio al que no se llega antes del deadline no se penaliza**: sus filas quedan intactas,
  con `intentos` sin tocar, y las reclama la corrida siguiente dos minutos después.

`postQabCatalogBatch` **nunca lanza**: convierte cualquier fallo en `{ kind: "error" }`. Una
excepción escapando abortaría la transacción y perdería los acuses de los negocios ya procesados.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reclamar, commitear, procesar fuera de la transacción | Sin columna de reclamo, la fila commiteada sigue siendo elegible: dos corridas se llevan el mismo lote y el criterio 4 pasa a depender de una carrera de milisegundos. Un test que pasa por suerte es peor que uno que falla. |
| Añadir `OutboxEvento.reclamadoAt` y hacer un lease con TTL | Es el diseño de libro y probablemente sea el destino a largo plazo, pero es una columna, y F-002 tiene por alcance no tocar el schema. Además, un lease con TTL trae su propio problema —elegir el TTL, y qué pasa con el que expira mientras el `POST` sigue en vuelo— que no hay razón para pagar mientras la tabla está vacía. |
| Una transacción **por negocio** en vez de una por corrida | Más corta cada una, pero el reclamo global del lote de 500 dejaría de ser atómico: entre transacción y transacción otra corrida se cuela y el criterio 4 vuelve a caerse. |
| Cola externa (SQS, QStash, pg-boss) | Resuelve todo esto de verdad, y es una dependencia de infraestructura nueva para un feature cuya tabla nace vacía. Reconsiderable si el volumen lo pide. |
| `POST` de todos los negocios en paralelo con `Promise.all` | Acorta la transacción, pero hace el orden no determinista, complica los tests y le manda a QAB una ráfaga sin control. Con el deadline en serie el peor caso ya está acotado. |

## Consecuencias

**A favor:**
- El criterio 4 se cumple **por construcción**, no por suerte. Comprobado ejecutando sobre 594
  filas pendientes: la transacción A se lleva los ids 200007–200506 (500) y la B, concurrente, los
  200507–200600 (94). Disjuntos, sin solapamiento, sin que B espere a A.
- Los criterios 3 y 4 componen: la segunda corrida drena el resto en vez de quedarse parada.
- El acuse es atómico con el reclamo: no existe el estado «QAB lo procesó y nosotros no lo
  anotamos» por un commit intermedio fallido.
- Una corrida que muere a mitad hace rollback entero: las filas vuelven a estar pendientes tal cual,
  sin `intentos` gastados y sin `procesadoAt` a medias.

**En contra / coste asumido:**
- **Una transacción abierta durante E/S de red.** Es una mala práctica reconocida y aquí se asume a
  propósito, acotada por el deadline. Lo que mitiga el riesgo es quién compite por esas filas:
  `OutboxEvento` solo la escriben las inserciones (filas nuevas, que no chocan con las bloqueadas) y
  las otras corridas del drenaje (que las saltan con `SKIP LOCKED`). **Nada del camino de venta
  espera por este lock.**
- Consume una conexión del pool durante toda la corrida.
- El rollback tras un fallo tardío tira también los acuses de los negocios ya respondidos. QAB los
  volverá a recibir, y su idempotencia por clave natural (`§ Idempotencia`) los reporta `duplicate`,
  que cuenta como `ok`. Reintentar es inofensivo por diseño del contrato.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento:** el lote es global, pero la partición por `negocioId` y el `QabTenantMismatchError`
  de `toQabCatalogBatch` garantizan que cada `POST` lleva filas de un solo negocio, con su token.
  Sostener la transacción no mezcla nada: solo alarga la ventana en la que las filas están
  reservadas.
- El coste crece con el **número de negocios** del lote, no con el de eventos: 500 eventos de un
  negocio son un `POST`; repartidos entre 40 negocios son 40. El deadline es lo que impide que ese
  reparto convierta una corrida en una función colgada.
- **Reversión barata:** pasar a un lease con columna es aditivo y no invalida nada de lo escrito
  aquí. Cuando el volumen real lo justifique, el cambio es local a `outboxDrain.ts`.
