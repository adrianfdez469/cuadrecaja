# ADR 0012: El índice parcial `idx_outbox_pendiente` para la consulta de drenaje

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002

## Contexto

F-001 creó `OutboxEvento` con dos índices: `@@index([negocioId, procesadoAt, id])` y
`@@index([entidad, entidadId])`. La consulta de drenaje que publica el contrato en `§①` es:

```sql
SELECT * FROM "OutboxEvento"
WHERE "procesadoAt" IS NULL AND intentos < 6
ORDER BY id LIMIT 500
FOR UPDATE SKIP LOCKED;
```

No filtra por `negocioId` —el lote es global, por diseño del contrato— y sí filtra por `intentos`,
que no está en ningún índice. El spec de F-002 lo dejó anotado como riesgo a evaluar por el
arquitecto, sin resolverlo.

El detalle que lo convierte en un problema de verdad: **nadie borra las filas ya procesadas**. La
tabla es un histórico que solo crece, mientras que lo pendiente es un puñado de filas en la cabeza.
Con el tiempo, la selectividad de `procesadoAt IS NULL` se vuelve altísima y el coste de encontrar
esas filas depende de cómo se busquen.

## Decisión

**Se crea un índice parcial nuevo, en su propia migración de una sola sentencia** (el patrón que
fijó el ADR 0002, por la misma razón: `CREATE INDEX CONCURRENTLY` no puede correr dentro de un
bloque de transacción):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outbox_pendiente"
  ON "OutboxEvento" (id) WHERE "procesadoAt" IS NULL;
```

No se declara en `schema.prisma`: Prisma no sabe expresar índices parciales, y ya está verificado
(ADR 0002) que su diff no borra lo que no sabe representar.

**El predicado NO incluye `intentos < 6`, a propósito.** Un predicado parcial tiene que ser
implicado por el `WHERE` de la consulta para que el planificador use el índice; si un día
`QAB_OUTBOX_MAX_ATTEMPTS` subiera a 8, `intentos < 6` dejaría de implicar `intentos < 8` y el índice
se volvería **invisible en silencio**: la consulta seguiría funcionando, solo que veinte veces más
lenta, sin que nada avise. Dejando fuera esa condición, el índice sirve para cualquier valor de la
constante y Postgres filtra `intentos` sobre las poquísimas filas que ya trajo ordenadas.

Medido ejecutando contra `postgres:15-alpine` sobre 200 000 filas procesadas + 600 pendientes,
la forma que tendrá la tabla en producción:

| | Plan | Buffers | Tiempo |
|---|---|---|---|
| Solo con los índices de F-001 | `Seq Scan` + `Sort`, `Rows Removed by Filter: 200000` | 2675 | **18,081 ms** |
| Con `idx_outbox_pendiente` | `Index Scan using idx_outbox_pendiente` | 510 | **0,306 ms** |

**59× más rápido, y con 5× menos buffers.** Y el tamaño explica por qué el índice existente no
podía servir:

| Objeto | Tamaño |
|---|---|
| Tabla `OutboxEvento` | 21 MB |
| `OutboxEvento_negocioId_procesadoAt_id_idx` (F-001) | 14 MB |
| **`idx_outbox_pendiente`** | **32 kB** |

El índice parcial solo indexa lo pendiente: **no crece con el histórico**. Es el mismo argumento del
índice parcial de divergencia del ADR 0002, aplicado a otra tabla.

Comprobado también que el planificador lo sigue eligiendo con filas envenenadas (`intentos = 6`) en
la cabeza: las descarta con `Rows Removed by Filter: 6` y sigue usando el índice.

Y el índice existente **no se toca**: sirve a las consultas por negocio que F-003 y la
monitorización necesitarán.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| No crear nada: la tabla nace vacía y F-002 no emite eventos | Cierto hoy y falso dentro de dos features. El índice cuesta 32 kB y se crea gratis sobre una tabla vacía; añadirlo después será sobre una tabla en producción. Se paga ahora, cuando no duele. |
| Índice normal `(id) WHERE …` sin `CONCURRENTLY` | Sobre la tabla vacía daría igual, pero el archivo de migración es permanente y se ejecutará también en bases futuras que sí tengan datos. `CONCURRENTLY` cuesta lo mismo y no bloquea escrituras. |
| Índice completo sobre `("procesadoAt", id)` | Funciona, pero indexa las 200 000 filas procesadas: unos 14 MB que crecen para siempre, contra los 32 kB del parcial. Todo ese espacio indexa filas que la consulta nunca quiere. |
| Incluir `intentos < 6` en el predicado | Un poco más selectivo y una trampa silenciosa: acopla el índice al valor de una constante de aplicación, y cambiarla desactiva el índice sin ningún error. |
| Añadir `intentos` como columna `INCLUDE` | No aporta: `FOR UPDATE` obliga a visitar el heap de todas formas, así que no hay index-only scan que ganar. |
| Cambiar el índice de F-001 en vez de añadir uno | Ese índice sirve a otras consultas (las de un negocio concreto) que F-003 va a necesitar. Son dos accesos distintos y quieren dos índices distintos. |

## Consecuencias

**A favor:**
- La consulta más caliente de la integración pasa de `Seq Scan` sobre el histórico completo a un
  `Index Scan` que se detiene en la fila 500.
- El coste del índice está acotado por el **atraso pendiente**, no por el volumen acumulado: si el
  cron va al día, pesa kilobytes indefinidamente.
- Robusto ante un cambio de `QAB_OUTBOX_MAX_ATTEMPTS`.
- F-002 sigue sin crear ni una tabla ni una columna: un índice no es ninguna de las dos cosas.

**En contra / coste asumido:**
- Un tercer índice sobre `OutboxEvento` encarece un poco cada `INSERT`. Es un índice minúsculo y las
  inserciones van dentro de transacciones de mutación que ya hacen bastante más trabajo.
- Es un objeto de base de datos que **no está en `schema.prisma`**: quien lea el modelo no lo ve.
  Mismo coste que el `idx_disp_divergente` del ADR 0002, y se paga por la misma razón.
- Otra migración manual que hay que recordar aplicar (`prisma migrate deploy`), y reiniciar el
  servidor de desarrollo después (E-002).

**Impacto en seguridad y escalabilidad:**
- Sin efecto sobre el aislamiento: un índice no cambia qué filas puede ver una consulta.
- Es lo que hace que el cada-2-minutos sea sostenible: sin él, el coste de **cada** corrida crece
  linealmente con el histórico de eventos, aunque no haya nada pendiente.
- **El hueco que este ADR no tapa:** `OutboxEvento` no tiene purga. El índice hace que el drenaje no
  note el crecimiento, pero la tabla y el índice de F-001 sí lo notan. Hace falta un cron de purga
  de filas con `procesadoAt` antiguo **antes** de que F-005/F-006 emitan tráfico real; los dos crons
  de purga que ya existen en `src/app/api/crons/` son el molde.
- **Reversión trivial:** `DROP INDEX CONCURRENTLY IF EXISTS "idx_outbox_pendiente";`.
