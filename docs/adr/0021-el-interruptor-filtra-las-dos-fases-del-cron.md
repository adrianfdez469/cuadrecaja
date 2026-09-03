# ADR 0021: El interruptor de tienda online filtra las **dos** fases del cron, y en el drenaje se filtra al reclamar

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md) ·
[ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md)

## Contexto

El criterio 3 de F-003 dice: *"Un negocio con el interruptor apagado no genera eventos en
OutboxEvento **ni se incluye en la corrida del cron**, aunque tenga token."*

La coletilla «aunque tenga token» es la que decide este ADR. Hoy el token es lo único que hace
elegible a un negocio, en los dos sitios donde el cron elige:

- **Fase de pull** (`syncTiendaCron.ts`): `where: { qabToken: { not: null } }`, con el comentario
  que F-002 dejó escrito esperando exactamente a este feature.
- **Fase de drenaje** (`outboxDrain.ts`): `claimOutboxBatch` reclama 500 filas ordenadas por `id`
  sin mirar el negocio, y quien decide es el `Map` de `loadQabTokens`: un negocio sin token cae en
  la rama `skipped_no_token`, que marca sus filas con `QAB_TOKEN_MISSING` y les incrementa
  `intentos`.

Filtrar solo la fase de pull dejaría medio criterio sin cumplir, y un negocio apagado seguiría
publicando catálogo y precios. Así que hay que filtrar también el drenaje, y ahí aparece la
pregunta con filo: **dónde**.

La opción evidente —reutilizar la rama `skipped_no_token`, o añadir una hermana— tiene dos
problemas, y ninguno se ve leyendo el código por encima:

1. **Quema los reintentos.** Esa rama hace `intentos++`. Con `QAB_OUTBOX_MAX_ATTEMPTS = 6`, seis
   corridas del cron —doce minutos— bastan para que todas las filas pendientes de un negocio
   apagado superen el umbral y queden fuera de la consulta de drenaje **para siempre**. Cuando
   alguien vuelva a encender el interruptor, esos eventos ya no se recuperan. Apagar un
   interruptor no debería destruir datos.
2. **Mata de hambre a los demás.** `claimOutboxBatch` reclama `ORDER BY id LIMIT 500`. Si un
   negocio apagado tiene 10.000 filas pendientes con ids bajos, ocupan el lote entero en cada
   corrida y **ningún otro negocio llega a sincronizar nunca**. Es exactamente el
   *head-of-line blocking* que el `intentos < 6` de la consulta del contrato existe para evitar —
   pero descartar después de reclamar lo reintroduce por la puerta de atrás.

El escenario no es hipotético: la guarda del criterio 3 impide encolar eventos **nuevos** para un
negocio apagado, pero no dice nada de los que ya estaban pendientes cuando se apagó el interruptor.

## Decisión

**El interruptor filtra las dos fases, y en el drenaje se filtra dentro de la consulta de reclamo,
no después de reclamar.**

1. `syncTiendaCron.ts`, fase de pull:

   ```ts
   where: { qabToken: { not: null }, tiendaOnlineHabilitada: true }
   ```

2. `outboxDrain.ts`, `claimOutboxBatch` — la firma no cambia, la consulta sí:

   ```sql
   SELECT o.* FROM "OutboxEvento" o
   WHERE o."procesadoAt" IS NULL
     AND o.intentos < $1
     AND EXISTS (SELECT 1 FROM "Negocio" n
                 WHERE n.id = o."negocioId" AND n."tiendaOnlineHabilitada" = true)
   ORDER BY o.id LIMIT $2
   FOR UPDATE OF o SKIP LOCKED
   ```

**El mecanismo que mantiene el bloqueo acotado es `EXISTS`, no `FOR UPDATE OF`.** En PostgreSQL
`FOR UPDATE` bloquea las filas que aporta el `FROM`/`JOIN` de nivel superior; una subconsulta
`EXISTS` no aporta ninguna al resultado, así que `Negocio` no se bloquea — con `OF` o sin él. Un
`JOIN` sí metería `Negocio` en la lista `FROM`, y entonces el drenaje mantendría bloqueadas filas de
negocio durante toda su transacción, que dura hasta 45 s (ADR 0010): eso bloquearía, por ejemplo, el
propio interruptor que se está consultando.

**`FOR UPDATE OF o` se escribe igualmente**, como cinturón y tirantes: es gratis, y deja el alcance
del bloqueo dicho de forma explícita en la propia consulta, de modo que si alguien la reescribe algún
día con un `JOIN` —el cambio natural de quien busque «simplificar»— la cláusula sigue impidiendo que
se bloqueen filas de `Negocio`. Es una salvaguarda contra una edición futura, no lo que resuelve el
problema hoy.

Las filas de un negocio apagado quedan **pendientes e intactas**: sin `intentos++`, sin
`ultimoError`, sin `procesadoAt`. Vuelven a entrar solas, por su orden de `id`, el día que alguien
encienda el interruptor.

Esto se aparta de la nota de F-002 que llamaba a `claimOutboxBatch` *"la consulta del contrato,
verbatim"*. La desviación es deliberada y acotada: lo que el contrato de QAB fija son el **orden**,
el **límite** y la **semántica de bloqueo** (`FOR UPDATE SKIP LOCKED`), y las tres se conservan. El
opt-in por negocio es una decisión de cuadrecaja que el contrato no puede conocer.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Filtrar solo la fase de pull | Deja medio criterio 3 sin cumplir: el negocio apagado seguiría publicando catálogo, precios y disponibilidad. El criterio dice «la corrida», y la corrida son dos fases |
| Descartar tras reclamar, reutilizando `skipped_no_token` | Quema los 6 intentos en doce minutos y destruye eventos que el usuario esperaba recuperar al reencender. Además `QAB_TOKEN_MISSING` mentiría: el token está, lo que falta es el opt-in |
| Descartar tras reclamar, con una rama nueva sin `intentos++` | Arregla la quema de reintentos pero no la inanición: 500 filas de un negocio apagado siguen ocupando el lote entero en cada corrida |
| Al apagar el interruptor, marcar las filas pendientes como `procesadoAt` | Destructivo e irreversible: apagar un interruptor no puede borrar la cola. Y convierte una operación de un clic en una escritura masiva |
| Un índice parcial nuevo que incluya `tiendaOnlineHabilitada` | `tiendaOnlineHabilitada` está en `Negocio`, no en `OutboxEvento`: no cabe en el índice parcial del ADR 0012. Y a la escala de este sistema —decenas de negocios— el `EXISTS` se resuelve por la clave primaria |
| Denormalizar el interruptor a una columna de `OutboxEvento` | Un flag copiado es un flag que se queda viejo: apagar el interruptor no reescribiría las filas ya encoladas, que es precisamente el caso que hay que resolver |
| Un `JOIN` con `Negocio` en vez de `EXISTS` | Mete `Negocio` en la lista `FROM` y lo pone al alcance del `FOR UPDATE`: el drenaje bloquearía filas de negocio durante toda su transacción, hasta 45 s, incluida la del negocio cuyo interruptor alguien esté intentando cambiar |

## Consecuencias

**A favor:**
- El criterio 3 se verifica **ejecutando el cron** con negocios en los dos estados, que es lo que
  pide, y da el mismo resultado en las dos fases.
- Apagar el interruptor es reversible y no destruye nada: es una pausa, no un borrado.
- Un negocio apagado deja de consumir presupuesto de la corrida: ni ocupa lote, ni gasta
  reintentos, ni abre conexiones del pool dedicado (ADR 0015).

**En contra / coste asumido:**
- La consulta de reclamo deja de ser copiable literalmente del contrato de QAB. Queda escrito aquí
  qué se conservó (orden, límite, bloqueo) y qué se añadió (el opt-in), para que un salto de
  versión del contrato se pueda comparar sin confusión.
- Las filas pendientes de un negocio apagado **envejecen**. Al reencenderlo se drenarán eventos
  posiblemente obsoletos. No es un problema de corrección —el catálogo es un estado, no un diario,
  y `stale` es una respuesta prevista del `207`— pero sí una latencia que conviene tener presente
  cuando F-006 y F-011 diseñen la resincronización.
- Un negocio con el interruptor encendido y **sin** token sigue cayendo en `skipped_no_token`, con
  su `intentos++`. Ese comportamiento es de F-002 y no se toca aquí.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento:** el `EXISTS` es por `negocioId` y no cruza filas de negocios distintos. Un
  negocio apagado no puede colar eventos en el lote de otro.
- **Escalabilidad:** el `EXISTS` se resuelve por la clave primaria de `Negocio`, una fila por
  evento agrupada por el planificador; el coste dominante sigue siendo el escaneo ordenado del
  índice parcial del ADR 0012. Lo que este ADR **evita** es el coste real: una cola de un solo
  negocio bloqueando a todos los demás indefinidamente.
- **Reversión:** quitar el predicado devuelve el comportamiento de F-002 sin migración ni datos que
  deshacer.
