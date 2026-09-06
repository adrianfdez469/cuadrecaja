# ADR 0048: La consulta de divergencia se ejecuta en SQL crudo, con la expresión en una sola constante

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-007

## Contexto

F-007 tiene que leer las filas de `ProductoTienda` cuyo enum de disponibilidad calculado difiere de
`dispPublicada`. La condición es la que F-001 ya horneó en el índice parcial `idx_disp_divergente`:

```sql
CASE WHEN existencia <= 0             THEN 'OUT_OF_STOCK'
     WHEN existencia <= "umbralBajo"  THEN 'LOW_STOCK'
     ELSE                                  'AVAILABLE' END
IS DISTINCT FROM "dispPublicada"
```

Tres restricciones se cruzan:

1. **El query builder de Prisma no expresa un `CASE`.** No hay forma de escribir esa condición con
   `where`, ni de proyectar su resultado como columna. Tampoco hay columna generada ni vista que la
   materialice, y el spec prohíbe crear una: F-007 **usa** lo que F-001 dejó, no crea nada.
2. **Si la expresión que escribe el código no coincide con la del índice, el índice no se usa.** El
   planificador solo aprovecha un índice parcial cuando el `WHERE` de la consulta **implica** su
   predicado, y esa comprobación se hace sobre el árbol de expresiones ya normalizado, no sobre el
   texto. Una diferencia real —un literal de otro tipo, un cast implícito distinto, un operando
   cambiado de sitio— degrada la consulta a un recorrido secuencial del catálogo entero, sin ningún
   error visible. Es exactamente el motivo por el que la columna `umbralBajo` es `Float` y no `Int`
   (ver el comentario en `prisma/schema.prisma`).
3. **La misma definición escrita en varios sitios se desincroniza.** Es [E-014] en estado puro: una
   señal derivada parafraseada en ocho lugares, y una corrección que dejó uno atrás.

Lo que Postgres tiene guardado del índice, leído ejecutando
`SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_disp_divergente'`:

```
WHERE (CASE
    WHEN (existencia <= (0)::double precision) THEN 'OUT_OF_STOCK'::text
    WHEN (existencia <= "umbralBajo") THEN 'LOW_STOCK'::text
    ELSE 'AVAILABLE'::text
END IS DISTINCT FROM "dispPublicada")
```

Es decir: **Postgres no guarda el texto que se escribió, guarda el árbol ya normalizado**. Los
espacios, los saltos de línea y las mayúsculas de la sintaxis no importan; los tipos de los
literales, los casts y las columnas referenciadas sí.

## Decisión

La consulta se ejecuta con **`$queryRaw`** (plantilla etiquetada de Prisma), y el texto del `CASE`
vive en **una sola constante**, `QAB_AVAILABILITY_CASE_SQL` en `src/constants/qab.ts`, interpolada
con `Prisma.raw` en los dos sitios de la misma sentencia donde hace falta (la proyección y el
`WHERE`). Ningún otro archivo del repositorio vuelve a escribir ese `CASE`.

La constante es **carácter por carácter** el fragmento que aparece en
`prisma/migrations/20260901225538_qab_idx_disp_divergente/migration.sql`, sangría incluida. No
porque Postgres lo exija —no lo exige— sino porque una copia idéntica es lo único que una
comprobación automática puede verificar sin reimplementar el normalizador del planificador.

Esa copia se sostiene con dos comprobaciones de distinta naturaleza, y hacen falta las dos:

- **Estática, sin base de datos** (suite de Vitest): leer el archivo de migración del disco,
  normalizar los espacios de los dos textos y comprobar que el de la constante está contenido en el
  de la migración. Se rompe en el instante en que alguien edita uno de los dos lados. Es la defensa
  contra [E-014].
- **Ejecutable, con volumen** (QA): sembrar filas divergentes suficientes y leer el plan real con
  `EXPLAIN (ANALYZE, BUFFERS)` dentro de una transacción con `ROLLBACK`, comprobando que
  `idx_disp_divergente` aparece. Es la defensa contra el punto 2, y **solo vale con volumen**: sobre
  la tabla de desarrollo, con decenas de filas, el planificador elige un `Seq Scan` que es correcto
  y no dice nada ([E-023]). Ni se toca `enable_seqscan`.

Este ADR **no promete una forma de plan concreta**. Promete que la expresión escrita es la misma que
la del índice y que existe una forma de comprobarlo ejecutando. Qué plan elige el planificador con
las estadísticas de cada base es suyo, no nuestro ([E-017]).

Dos decisiones más de la misma consulta, por la misma razón de coste:

- **Una sola consulta por corrida para todos los negocios elegibles**, con
  `t."negocioId" = ANY($ids::text[])`, y partición por negocio en TypeScript después. Es el mismo
  patrón que el drenaje del outbox (ADR 0010): reclamar global, partir después. Por negocio serían
  N recorridos del mismo índice parcial —que cubre las filas divergentes de **todos** los negocios,
  no solo las del que se consulta— para leer una fracción de cada uno.
- **`ORDER BY pt."id"` y `LIMIT`**, tope `QAB_AVAILABILITY_MAX_ROWS_PER_RUN`. El orden es el del
  propio índice (`ON "ProductoTienda" (id)`, colación por defecto), así que el planificador *puede*
  servirlo desde él; se escribe sin `COLLATE`, porque un `COLLATE "C"` explícito sería otro orden y
  ya no coincidiría con el índice. Como `id` es un UUID, ese orden reparte las filas entre negocios
  en vez de agotar el tope con el primero por orden alfabético.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Traer todas las filas con Prisma y calcular el enum en TypeScript | Es O(catálogo) por corrida y por negocio: exactamente lo que el índice parcial existe para evitar, y lo que el criterio 6 prohíbe. Además no hay forma de filtrar «divergentes» sin la expresión |
| Columna generada (`GENERATED ALWAYS AS`) o vista materializada con el enum | Es una migración, y el spec excluye crear columnas o índices en este feature. Además duplicaría la definición en un tercer sitio (schema + índice + código) en vez de reducirla |
| `$queryRawUnsafe` con la sentencia montada por concatenación | La lista de negocios y el `LIMIT` viajarían como texto interpolado. La plantilla etiquetada los pasa como parámetros y deja `Prisma.raw` **solo** para una constante del propio repositorio, nunca para un dato |
| Escribir el `CASE` inline en la consulta, sin constante | Es [E-014]: hoy hay un sitio, mañana hay tres (la consulta, un test, un comentario) y una corrección deja alguno atrás. Y sin un texto único no hay nada que comparar con la migración |
| Guardar la expresión en `src/lib/qab/` en vez de en `src/constants/` | `AGENTS.md` manda las cadenas compartidas a `src/constants/`, y `QAB_DIVERGENCE_INDEX_NAME` ya vive ahí. Partir el par «nombre del índice / predicado del índice» entre dos capas no ayuda a nadie |
| Comparar la constante contra `pg_indexes.indexdef` en un test | Es la comparación correcta, pero exige reimplementar la normalización del planificador (casts, tipos de literal, paréntesis) para comparar dos textos que Postgres ya considera iguales. Queda como comprobación de QA sobre el plan, que mide la propiedad de verdad |

## Consecuencias

**A favor:**

- Una definición, un archivo. Corregir la regla de disponibilidad es editar una constante, y la
  comprobación estática avisa si el índice se queda atrás.
- La consulta es declarativa y sin cursor: no hay ventana de pérdida de datos, y una corrida que no
  ocurrió no deja nada pendiente que alguien tenga que reencolar (criterio 6).
- Un solo recorrido del índice por corrida, no uno por negocio.

**En contra / coste asumido:**

- `$queryRaw` no tiene tipado de columnas: la forma del resultado se valida con
  `qabDivergentRowSchema` al salir de la función, no la comprueba el compilador.
- El índice parcial cubre las filas divergentes de **todos** los negocios, incluidas las de los que
  nunca serán elegibles (sin token, o con la tienda online apagada), que son divergentes para
  siempre. El tope por corrida acota el trabajo, no el tamaño del índice. Si algún día ese índice
  crece de más, la salida es un índice más estrecho, y eso es una migración, no un cambio aquí.
- La copia carácter por carácter entre la migración y la constante es una convención que solo un
  test sostiene. Sin ese test, se pierde en la primera reindentación.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** el filtro por `negocioId` entra por el `JOIN` con `Tienda`
  (`ProductoTienda` no tiene `negocioId` propio) y se pasa como **parámetro**, nunca interpolado.
  Es la frontera real de la lectura; el `businessId` del cuerpo no lo es (ver ADR 0050).
- La lectura y las escrituras de esta fase van por `qabPrisma`, el pool dedicado de ADR 0015: un
  recorrido largo de este índice no puede quedarse con una conexión del pool que atiende al POS.
- El tope por corrida (`QAB_AVAILABILITY_MAX_ROWS_PER_RUN`) y el presupuesto de tiempo
  (`QAB_AVAILABILITY_DEADLINE_MS`) acotan la fase. Lo que no entra en una corrida sigue divergente y
  entra en la siguiente: es la propiedad de auto-reparación, no una pérdida.

### El tope es global, y eso permite que un tenant acapare el cupo

`QAB_AVAILABILITY_MAX_ROWS_PER_RUN` acota **la corrida entera**, no cada negocio. El `ORDER BY
pt."id"` sobre un UUID reparte las filas entre negocios de forma probabilística, y con backlogs
comparables eso basta. **Deja de bastar cuando un solo negocio diverge de forma sostenida y masiva**
—una migración de precios, un ajuste de inventario completo, un tercero que hace oscilar su
`existencia`—: con 100 000 filas divergentes de un negocio frente a 10 de otro, el reparto por id
entrega casi todo el cupo al primero corrida tras corrida, y las 10 filas del segundo esperan.

**No es un problema de integridad.** El estado nunca queda incoherente: lo que no se lee sigue
divergente, lo que no se confirma se reintenta solo y nadie reencola nada. Es un problema de
**equidad y de latencia entre tenants**: un negocio pequeño ve su escaparate desactualizado por
culpa del volumen de otro, sin que nada falle.

**Cómo se detecta.** La señal es `capped: true` en el informe de la fase, cruzada con el desglose
`byBusiness[].outcome`: `capped` sostenido corrida tras corrida, con un mismo `negocioId`
concentrando el grueso de `items` y otros apareciendo con `skipped_deadline` o directamente sin
aparecer, es el patrón. `capped: true` aislado no lo es —una punta puntual es normal—; lo que
importa es que se repita con el mismo protagonista.

**Cuál sería la salida, si llega a observarse.** Paginar **por negocio dentro de la misma
consulta**, con una ventana en vez del `LIMIT` global:

```sql
ROW_NUMBER() OVER (PARTITION BY t."negocioId" ORDER BY pt."id")
```

acotada por negocio, de modo que cada tenant tenga un cupo propio por corrida y el volumen de uno no
consuma el de los demás. Se deja **escrito como trabajo futuro, no como parte de F-007**: hoy no hay
ninguna medición que lo justifique, la ventana encarece la consulta para todos los casos y añade una
constante más que ajustar. Optimizar antes de tener la señal sería resolver un problema que puede no
llegar a existir.

[E-014]: ../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md
[E-017]: ../../.agents/errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md
[E-023]: ../../.agents/errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md
