# ADR 0041: `idx_outbox_purgable` — un índice para la fase procesada, y este sí crece con el histórico

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-019
**Relacionado:** [ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md) ·
[ADR 0002](0002-create-index-concurrently-en-migracion-aislada.md) ·
[ADR 0039](0039-destino-de-los-eventos-agotados-del-outbox.md)

## Contexto

La purga (ADR 0039) tiene dos fases con dos predicados distintos, y hay que decidir qué índice sirve
a cada uno. `OutboxEvento` tiene hoy tres:

| Índice | Definición | ¿Sirve a la purga? |
|---|---|---|
| `OutboxEvento_negocioId_procesadoAt_id_idx` (F-001) | `(negocioId, procesadoAt, id)` | **No.** Su columna guía es `negocioId`, y ninguna de las dos fases filtra por negocio (ADR 0040). |
| `OutboxEvento_entidad_entidadId_idx` (F-001) | `(entidad, entidadId)` | **No.** Ninguna fase menciona esas columnas. |
| `idx_outbox_pendiente` (ADR 0012) | `(id) WHERE "procesadoAt" IS NULL` | **A la fase `exhausted`, sí.** A la fase `processed`, no. |

El segundo punto de esa tabla merece precisión, porque la nota de partida de este feature lo dejó
en «`idx_outbox_pendiente` no ayuda a la purga»:

- **Fase `exhausted`** (`procesadoAt IS NULL AND intentos >= 6 AND ocurridoAt < cutoff`,
  `ORDER BY id`): el predicado del índice, `procesadoAt IS NULL`, **está implicado** por el `WHERE`
  de la consulta, y el orden por `id` es el del índice. Este índice le sirve tal cual. No hace falta
  nada nuevo para esta fase, y el conjunto que recorre es pequeño por construcción: es el mismo que
  el drenaje mantiene corto.
- **Fase `processed`** (`procesadoAt IS NOT NULL AND procesadoAt < cutoff`): aquí el predicado del
  índice es exactamente el contrario. No hay nada que cubra esta consulta, y es la que recorre el
  conjunto grande — el histórico completo de eventos que sí llegaron a QAB.

Sin índice, la fase `processed` es un `Seq Scan` sobre la tabla entera más un `Sort`, y eso está
medido: el ADR 0012 lo midió sobre 200 000 filas procesadas y dio **18,081 ms**. Por lote. Con
`QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN = 40` lotes, la corrida no cabría en el `maxDuration = 60` de
la ruta ni de lejos, y cada lote estaría además pagando esa exploración sobre el pool compartido
(ADR 0040), que es justo lo que ese ADR acota.

## Decisión

**Se crea un índice parcial nuevo, en su propia migración de una sola sentencia, con la forma que
fijó el ADR 0002:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outbox_purgable"
  ON "OutboxEvento" ("procesadoAt") WHERE "procesadoAt" IS NOT NULL;
```

Nombre en la constante `QAB_OUTBOX_PURGABLE_INDEX_NAME`, junto a `QAB_OUTBOX_PENDING_INDEX_NAME`. No
se declara en `schema.prisma`: Prisma no sabe expresar índices parciales, y el ADR 0002 ya verificó
ejecutando que su diff no borra lo que no sabe representar.

Y dos detalles de la consulta que **forman parte de esta decisión**, no de la implementación:

**1. La consulta escribe `"procesadoAt" IS NOT NULL` de forma explícita, aunque
`"procesadoAt" < $1` ya lo implique semánticamente.** Es la lección del ADR 0012 aplicada al revés:
allí el riesgo era un predicado parcial que dejaba de estar implicado y volvía el índice invisible en
silencio. Aquí la implicación depende de cómo el planificador razone sobre la no-nulidad de un
operador estricto, y eso es un detalle de una versión de Postgres, no una garantía del esquema.
Escribiendo la condición literal, la implicación es **sintáctica** y no depende de nada:

```sql
WHERE "procesadoAt" IS NOT NULL AND "procesadoAt" < ${cutoff}
```

Cuesta una línea y quita una dependencia de comportamiento no verificado. Un índice que se desactiva
sin error es el modo de fallo más caro de esta familia de decisiones.

**2. La fase `processed` ordena por `"procesadoAt"`, no por `id`.** Es la columna guía del índice, así
que el `LIMIT 500` sale de un recorrido ordenado sin `Sort`. Y el orden es indiferente para lo que
esta fase hace: cualquier conjunto de 500 filas purgables es tan bueno como otro —a diferencia del
drenaje, donde el orden por `id` es lo que hace los lotes deterministas—. Ordenar por `id` aquí
obligaría a un `Sort` sobre todo lo que el índice devolviera, o a un índice compuesto
`("procesadoAt", id)` que no aporta nada.

## Por qué este índice sí indexa el histórico, a diferencia del del ADR 0012

Es la diferencia que hay que dejar escrita, porque contradice en apariencia el argumento central del
ADR 0012:

> *«El índice parcial solo indexa lo pendiente: **no crece con el histórico**.»*

`idx_outbox_purgable` hace lo contrario: indexa **todas** las filas procesadas, que son casi todas.
El ADR 0012 descartó explícitamente un índice así («indexa las 200 000 filas procesadas: unos 14 MB
que crecen para siempre»). La razón por la que aquí sí se acepta es que **la premisa cambió**: cuando
se escribió el ADR 0012 nadie borraba nada, así que «todas las procesadas» significaba «todo lo
emitido desde el despliegue, para siempre». Con el ADR 0039 en pie, el conjunto procesado está
acotado a `QAB_OUTBOX_PROCESSED_TTL_DAYS` (30 días) de tráfico de catálogo, y el índice está acotado
con él.

Los dos ADR se sostienen mutuamente, y en el orden que importa: **este índice está acotado porque la
purga funciona, y la purga funciona porque este índice existe.** El corolario operativo, que no hay
que descubrir a golpes: si el cron se desactiva o falla en silencio durante meses, no crece solo la
tabla —crece también este índice—, y volver de ahí exige purgar en pasos, no de una vez.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Ningún índice nuevo: aceptar el `Seq Scan` una vez al día** | Medido en el ADR 0012: 18 s por lote sobre 200 000 filas, con 40 lotes por corrida y un `maxDuration` de 60 s. No es que sea lento: es que no termina. Y cada lote pagaría esa exploración sobre el pool compartido del POS. |
| **Índice completo `("procesadoAt")`, sin el `WHERE`** | Funciona igual para la consulta, y además indexa las filas pendientes y agotadas (`procesadoAt IS NULL`), que esta fase nunca quiere y que `idx_outbox_pendiente` ya cubre. La versión parcial es estrictamente más pequeña y dice en su definición a qué consulta sirve. |
| **Índice compuesto `("procesadoAt", id)`** | Solo aportaría si la fase ordenara por `id` dentro de cada `procesadoAt`, y no lo hace. Una columna más en cada entrada por un orden que a una purga le da igual. |
| **Añadir la columna a `idx_outbox_pendiente` o cambiar su predicado** | Ese índice sirve a la consulta más caliente de la integración, cada 2 minutos. Son dos accesos distintos que quieren dos índices distintos — el mismo argumento con el que el ADR 0012 decidió no tocar el índice de F-001. |
| **Reutilizar el índice de F-001 `(negocioId, procesadoAt, id)` purgando negocio a negocio** | Haría usable el índice existente, a cambio de convertir una corrida en N corridas (una por negocio), y de meter `negocioId` en un proceso que deliberadamente no filtra por tenant (ADR 0040). Más consultas, más código y una superficie de datos por negocio que no hacía falta. |
| **Declararlo en `schema.prisma`** | Imposible: Prisma no expresa índices parciales. Es la misma restricción del ADR 0002 y del ADR 0012. |
| **`CREATE INDEX` sin `CONCURRENTLY`** | Toma un `SHARE` lock y bloquea las escrituras de `OutboxEvento` mientras construye — es decir, bloquea el `outboxEnqueue` que corre dentro de las transacciones de mutación del catálogo. Sobre la tabla de hoy daría igual; el archivo de migración es permanente y se ejecutará en bases que sí tengan datos. `CONCURRENTLY` cuesta lo mismo. |
| **Meterlo en la misma migración que otra cosa** | `CREATE INDEX CONCURRENTLY` no puede correr dentro de un bloque de transacción, y Prisma envuelve implícitamente cualquier `migration.sql` con más de una sentencia. Verificado ejecutando en el ADR 0002 (`25001` / `P3018`). |

## Procedimiento exacto de la migración

No hay cambio en `schema.prisma`, así que **no hay diff que generar y no interviene
`--create-only`** — que es donde aparece E-004. La migración se escribe a mano:

```bash
mkdir -p prisma/migrations/20260904120000_qab_idx_outbox_purgable
# escribir migration.sql con comentarios y UNA sola sentencia
npx prisma migrate deploy
```

- El nombre del directorio debe ordenarse **después** de `20260902120000_qab_idx_outbox_pendiente`.
- `migrate deploy` es el comando a usar: es no interactivo por diseño y solo aplica lo pendiente.
  `migrate dev` también funciona (verificado en el ADR 0002 con este mismo patrón), pero no hay razón
  para arriesgar una pregunta interactiva cuando no hay nada que generar.
- **No hace falta `prisma generate`** y la trampa de E-002 (servidor de desarrollo sirviendo un
  cliente viejo) **no aplica aquí**: no cambia ninguna columna ni ningún modelo, así que el cliente
  generado es idéntico antes y después. Un índice no se ve desde el cliente.
- **Si la construcción concurrente falla** —se cancela la sesión, se queda sin espacio— Postgres deja
  un índice **inválido**, y el `IF NOT EXISTS` de una segunda pasada lo daría por hecho y saltaría
  para siempre. Comprobar `indisvalid` (como hizo el ADR 0002, que verificó `t`) y, si es `f`,
  `DROP INDEX CONCURRENTLY IF EXISTS "idx_outbox_purgable";` antes de reintentar:

```sql
SELECT indisvalid FROM pg_index WHERE indexrelid = 'idx_outbox_purgable'::regclass;
```

## Consecuencias

**A favor:**
- La fase `processed` pasa de una exploración de la tabla completa por lote a un recorrido ordenado
  que se detiene en la fila 500, sin `Sort`.
- La fase `exhausted` no cuesta ningún objeto nuevo: `idx_outbox_pendiente` ya la cubre, y eso queda
  escrito para que nadie añada un tercer índice buscándolo.
- La condición `IS NOT NULL` explícita hace la implicación del predicado parcial sintáctica: el
  índice no puede volverse invisible por un detalle del planificador.
- Reversión trivial: `DROP INDEX CONCURRENTLY IF EXISTS "idx_outbox_purgable";`.

**En contra / coste asumido:**
- **Es el primer índice de este repositorio que sí crece con el histórico de `OutboxEvento`**, y su
  cota es la constante de TTL del ADR 0039, no su propia definición. Si la purga se detiene, este
  índice es una de las cosas que crecen.
- Un cuarto índice sobre `OutboxEvento` encarece cada `INSERT` de `outboxEnqueue`, que corre dentro
  de las transacciones de mutación del catálogo. Es una entrada btree más sobre una columna que en el
  momento del `INSERT` es `NULL` y por tanto **no entra en este índice parcial** — el coste se paga
  en el `UPDATE` del acuse, no en el alta.
- Otro objeto de base de datos que **no está en `schema.prisma`**: quien lea el modelo no lo ve. Van
  tres (`idx_disp_divergente`, `idx_outbox_pendiente`, `idx_outbox_purgable`), y las tres constantes
  de nombre en `src/constants/qab.ts` son la única pista dentro del código.
- Los números del ADR 0012 se citan aquí como referencia de magnitud del `Seq Scan`; **no se ha
  medido el plan de esta consulta nueva con este índice**. Lo que se afirma es la forma del plan que
  el índice hace posible, no un tiempo concreto.

**Impacto en seguridad y escalabilidad:**
- Sin efecto sobre el aislamiento: un índice no cambia qué filas puede ver una consulta.
- Es lo que hace que el coste de una corrida de purga dependa del tamaño del **lote** y no del de la
  tabla, que es la condición para que el ADR 0040 pueda ejecutarla sobre el pool compartido en
  sentencias cortas.
- El riesgo residual está nombrado arriba y es el acoplamiento entre los dos ADR: la cota de este
  índice es que la purga corra. Su señal de alarma es la misma que la del ADR 0040,
  `stopReason: "batch_cap"` día tras día.
