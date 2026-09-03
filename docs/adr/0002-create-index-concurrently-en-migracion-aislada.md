# ADR 0002: `CREATE INDEX CONCURRENTLY` en una migración propia con una sola sentencia

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

El contrato de integración con queandabuscando resuelve la sincronización de disponibilidad con una
**consulta convergente** en vez de un cursor de tiempo, y la hace barata con un índice **parcial por
expresión** sobre `ProductoTienda`:

```sql
CREATE INDEX CONCURRENTLY idx_disp_divergente ON "ProductoTienda" (id)
WHERE (CASE WHEN existencia <= 0             THEN 'OUT_OF_STOCK'
            WHEN existencia <= "umbralBajo"  THEN 'LOW_STOCK'
            ELSE                                  'AVAILABLE' END)
      IS DISTINCT FROM "dispPublicada";
```

Tres restricciones chocan entre sí:

1. **`ProductoTienda` es la tabla más caliente del sistema.** Un `CREATE INDEX` normal toma un
   `SHARE` lock: bloquea todas las escrituras de la tabla mientras construye. Sobre la tabla que
   toca cada venta, eso es una caída del POS durante el despliegue. El `CONCURRENTLY` no es un
   adorno del contrato: es la única forma de crearlo en producción sin parar de vender.
2. **`CREATE INDEX CONCURRENTLY` no puede ejecutarse dentro de un bloque de transacción.** Postgres
   lo rechaza con `25001`.
3. **Prisma no sabe expresar un índice parcial por expresión** en `schema.prisma`, así que tampoco
   lo genera solo. Y las `notes` del feature ya avisaban del choque sin resolverlo.

La restricción real es más fina de lo que suele contarse. Prisma no abre un `BEGIN` explícito por
migración: manda el contenido de cada `migration.sql` como **una sola cadena de consulta**, y es el
protocolo simple de Postgres el que envuelve implícitamente en una transacción **cuando esa cadena
lleva más de una sentencia**. Con una sola sentencia no hay bloque de transacción que valga.

Eso se comprobó ejecutando, con `prisma@6.5.0` —la versión fijada en `package.json`— contra
`postgres:15`, en una base desechable:

| Comprobación | Resultado |
|---|---|
| `migration.sql` con solo el `CONCURRENTLY` (más comentarios) | `migrate dev` y `migrate deploy` lo aplican sin error |
| El mismo `CONCURRENTLY` con un `ALTER TABLE` delante en el mismo archivo | `P3018` / `25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block` |
| Segunda pasada de `migrate deploy` | `No pending migrations to apply.` |
| `migrate dev` posterior con un cambio de schema no relacionado | no genera ningún `DROP INDEX`: el diff de Prisma ignora lo que no sabe representar |
| `indisvalid` del índice resultante | `t` |

## Decisión

**El índice va en su propia migración, escrita a mano, cuyo `migration.sql` contiene comentarios y
exactamente una sentencia** — la del contrato, literal, con `IF NOT EXISTS`.

F-001 produce dos migraciones:

1. `<ts>_qab_tienda_online_fundaciones` — generada por `prisma migrate dev`, con las 22 columnas
   nuevas, las tres tablas nuevas y sus índices expresables. Transaccional, como cualquier otra.
2. `<ts+1>_qab_idx_disp_divergente` — a mano, una sola sentencia.

El índice **no se declara en `schema.prisma`**. Verificado que el diff de Prisma no intenta
borrarlo después, así que las migraciones de features futuros no lo tumban.

La regla que hay que sostener en el tiempo: **en esa carpeta nunca entra una segunda sentencia.**
Cualquier índice concurrente futuro abre su propia migración con la misma forma.

En producción funciona por el mismo motivo que en local: el motor de migraciones usa la conexión
declarada en `directUrl`, que es directa y no agrupada. Sobre un pooler en modo transacción esto no
sobreviviría.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `CREATE INDEX` normal dentro de la migración generada | Bloquea las escrituras de `ProductoTienda` durante toda la construcción. Es exactamente lo que el contrato evita al escribir `CONCURRENTLY`. |
| `prisma db execute --file` como paso de despliegue aparte | Queda fuera del historial de migraciones: `migrate reset --force` no lo aplica y el criterio 5 falla en cualquier base recreada. Y añade un paso manual que alguien olvidará. |
| Crearlo desde `prisma/seed.ts` | El seed es de datos, no de esquema; no corre en producción con `migrate deploy`, y ata la existencia de un índice a que alguien siembre. |
| Envolverlo en un `DO $$ … $$` de plpgsql | Un bloque `DO` **es** un bloque de transacción: falla igual con `25001`. |
| Declararlo en `schema.prisma` con `@@index` y editar el SQL generado a mano | Prisma no representa el predicado parcial, así que el schema y la base quedarían desalineados y la siguiente migración intentaría reconciliar algo que no entiende. |
| Esperar a que Prisma soporte índices parciales | No hay fecha, y el feature no puede depender de eso. |

## Consecuencias

**A favor:**
- El índice existe tras `migrate reset --force`, tras `migrate deploy` y tras un despliegue en
  Vercel, sin ningún paso manual (criterios 5 y 7).
- Se crea sin bloquear las escrituras de la tabla más caliente del sistema.
- `migrate deploy` sigue siendo idempotente y el historial de migraciones sigue siendo la única
  fuente de verdad del esquema.

**En contra / coste asumido:**
- Una migración escrita a mano, que Prisma no regenera ni valida. Si alguien le añade una segunda
  sentencia, vuelve el `25001` — y por eso el aviso está escrito dentro del propio archivo.
- La expresión del índice vive solo en SQL: `schema.prisma` no la refleja y quien lea únicamente el
  schema no sabrá que existe.
- Si la construcción concurrente falla a mitad, Postgres deja un índice **inválido** y el
  `IF NOT EXISTS` se lo saltaría para siempre. La recuperación es explícita:
  `DROP INDEX CONCURRENTLY IF EXISTS "idx_disp_divergente";` y volver a aplicar. Por eso la
  verificación correcta no es «existe» sino «existe y `indisvalid = true`».

**Impacto en seguridad y escalabilidad:**
- Es la decisión que hace que la consulta de disponibilidad sea O(cambios) y no O(catálogo): el
  índice parcial solo indexa las filas divergentes, que en régimen normal son unas pocas.
- Ningún impacto en aislamiento entre tenants: el índice no filtra por negocio porque la consulta
  convergente se acota por tienda, y las tiendas ya cuelgan de su negocio.
- Riesgo operativo acotado: el peor caso es un índice inválido que hay que rehacer, no una
  migración a medias ni una tabla bloqueada.
