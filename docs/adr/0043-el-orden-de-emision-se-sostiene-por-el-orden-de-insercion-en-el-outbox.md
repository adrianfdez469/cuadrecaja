# ADR 0043: El orden de emisión se sostiene por el orden de inserción en el outbox, no por coordinación entre eventos

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-006
**Se apoya en:** [ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md) ·
[ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md) ·
contrato QAB v10.1, § ① «`payload` de `CATEGORY`», «`payload` de `EXCHANGE_RATE`» y § «Cambios respecto a la v10»

## Contexto

La v10.1 del contrato destaca, entre las cinco asimetrías, una que **falla en silencio en los dos
sitios donde aplica**:

> **El orden de emisión importa en dos sitios**, y los dos fallan en silencio: `CATEGORY` antes que
> los `PRODUCT` que la referencian (si no, el producto se publica sin categoría y se queda así), y
> `CURRENCY` antes que la primera `EXCHANGE_RATE` de esa moneda.

Y lo dice con todas las letras en la sección de `CATEGORY`:

> Un `PRODUCT` cuyo `localCategoryId` apunta a una categoría que todavía no llegó **no falla**: se
> guarda sin categoría, con `localCategoryId` a `NULL`, y se queda así hasta el siguiente evento de
> ese producto — el evento de la categoría, cuando llegue, no va a buscar quién la esperaba.

No hay error, no hay reintento, no hay alerta. El comerciante ve su producto publicado y sin
categoría, y nada del sistema le dice por qué. Los criterios 11 y 13 de F-006 existen exactamente
por esto.

Lo que había disponible cuando se tomó esta decisión:

- `OutboxEvento.id` es `BigInt @default(autoincrement())`.
- El drenaje de F-002 (`claimOutboxBatch`) reclama con `ORDER BY o.id LIMIT 500 FOR UPDATE SKIP
  LOCKED`, y `groupOutboxEventsByNegocio` reordena por id ascendente antes de agrupar.
- `toQabCatalogBatch` construye `events[]` en el orden del array que recibe, sin tocarlo.
- `enqueueOutboxEvents` (F-002) inserta con un único `createManyAndReturn`.

Es decir: **el orden ya estaba resuelto de punta a punta y nadie lo había nombrado como garantía.**
El riesgo era que F-006 inventara un mecanismo nuevo —una columna de prioridad, dos fases de
drenaje, una espera de confirmación del `CATEGORY` antes de encolar el `PRODUCT`— para un problema
que el diseño ya cubría, y que además ninguna de esas alternativas resuelve mejor.

## Decisión

**El orden de emisión es el orden de inserción en `OutboxEvento`, y se garantiza encolando toda la
emisión de una mutación en UNA sola llamada a `enqueueOutboxEvents`, con el array ya ordenado por
dependencia.**

El orden se escribe una vez, en `QAB_CATALOG_EMISSION_ORDER` (`src/constants/qab.ts`):

```
CURRENCY  →  EXCHANGE_RATE  →  CATEGORY  →  PRODUCT
```

Cuatro consecuencias directas:

1. **El planificador es una función pura que devuelve un array ordenado.**
   `planQabProductPublishEvents` (`src/lib/qab/qabCatalogEmission.ts`) devuelve
   `IOutboxEventoCreate[]` en ese orden. El `dev-tester` puede afirmar el orden **sin base de
   datos**, comparando contra `QAB_CATALOG_EMISSION_ORDER`. Es la única parte del orden que es
   lógica pura, y por eso vive separada de quien la persiste.

2. **Una sola sentencia de inserción.** `createManyAndReturn` emite un único
   `INSERT ... VALUES (...), (...), ...`; PostgreSQL evalúa `nextval` fila a fila en el orden en
   que la sentencia las lista, así que los ids salen ascendentes en el orden del array. No se
   depende del reloj: **`ocurridoAt` no es la clave de orden, el `id` lo es** — de hecho toda la
   emisión de una mutación comparte el mismo `occurredAt`.

3. **La cadena que lo conserva está nombrada y no se toca:** `claimOutboxBatch` (`ORDER BY o.id`)
   → `groupOutboxEventsByNegocio` (reordena por id) → `toQabCatalogBatch` (copia el array). F-006
   no modifica ninguna de las tres.

4. **No hace falta que los eventos viajen en el mismo lote.** Si el corte de 500 filas cae entre el
   `CATEGORY` y su `PRODUCT`, el `CATEGORY` tiene el id menor y sale en la corrida anterior. Lo que
   importa es el **orden de llegada**, no la coincidencia de lote.

### El caso residual, que se escribe y no se esconde

Hay un escenario en que el orden de llegada no basta:

> `CATEGORY` y `PRODUCT` viajan en el mismo lote, queandabuscando devuelve el `CATEGORY` en
> `failed[]` (un fallo **por evento**, no de transporte) y el `PRODUCT` en `ok`. El producto queda
> con `localCategoryId: NULL` y el `CATEGORY` reintentado no va a buscar quién lo esperaba.

**No se afirma que sea imposible** (E-017): este ADR no puede prometer un absoluto que el código no
sostiene. Es poco probable —el `payload` de `CATEGORY` sale de un `.strict()` con cuatro campos, y
un fallo de transporte tumba el lote entero en vez de un evento suelto— y la recuperación es la que
el propio contrato prescribe: **reemitir el producto**, que es volver a tocar su interruptor.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Columna `prioridad` en `OutboxEvento` y drenar por `(prioridad, id)` | Exige migración, cambia el índice parcial del drenaje (ADR 0012) y resuelve lo mismo que el autoincremental ya resuelve. Y una columna de prioridad invita a que alguien la use para algo que no es orden de dependencia |
| Dos fases de drenaje: primero las entidades de referencia, luego `PRODUCT` | Duplica el cron, duplica las llamadas HTTP por negocio y **no** garantiza nada extra: dentro de cada fase seguiría haciendo falta el orden por id. Además rompe la atomicidad del lote de 500 |
| Encolar el `PRODUCT` solo cuando el `CATEGORY` esté `procesadoAt` | Convierte una publicación en una operación asíncrona de varios minutos con estado propio, y deja al comerciante mirando un interruptor que no hace nada. Un fallo permanente del `CATEGORY` bloquearía la publicación de todos sus productos |
| Emitir el `CATEGORY` en su propia transacción, antes de la del `PRODUCT` | Rompe la regla del contrato («el `INSERT` va **dentro de la transacción que ya existe**»): si la mutación del producto revierte, queda un `CATEGORY` huérfano encolado |
| Ordenar por `ocurridoAt` en el drenaje | Toda la emisión de una mutación comparte el mismo instante a propósito, así que `ocurridoAt` no desempata. Y hacerlo obligaría a inventar desempates artificiales por milisegundos |
| Varias llamadas sucesivas a `enqueueOutboxEvent` (singular) en vez de una plural | Funcionaría, pero son N sentencias donde basta una, y deja de haber un sitio único donde el orden es visible. La plural existe desde F-002 precisamente para este caso |

## Consecuencias

**A favor:**

- Los criterios 11 y 13 se cumplen sin ningún mecanismo nuevo: el orden ya lo daba el diseño de
  F-002, y ahora está **nombrado** como garantía en vez de ser un accidente.
- El orden es testeable con Vitest sobre una función pura, sin base de datos y sin red.
- Ninguna migración, ningún cambio en el cron, ningún índice nuevo.
- El «arranque perezoso» del spec se implementa como un caso más del mismo planificador, no como
  un camino aparte.

**En contra / coste asumido:**

- La garantía depende de que `createManyAndReturn` siga emitiendo **una** sentencia. Si una versión
  futura de Prisma lo dividiera en varias sentencias sin orden, los ids seguirían siendo
  ascendentes por fila pero el orden entre sentencias dejaría de ser el del array. Mitigación: el
  planificador es puro y su test afirma el orden del array; el orden de los ids se verifica
  ejecutando (criterios 11 y 13).
- El caso residual de arriba: un fallo por evento del `CATEGORY` con el `PRODUCT` en `ok` deja el
  producto sin categoría hasta su siguiente evento propio.
- Toda la emisión de una mutación comparte `occurredAt`. Como `updatedAt` es guarda anti-rancio con
  `<=` en `CATEGORY` y `PRODUCT`, dos toques del **mismo** producto dentro del mismo milisegundo
  hacen que el segundo responda `stale` (que va en `ok`) y no se aplique. No se afirma que sea
  imposible; se acepta.

**Impacto en seguridad y escalabilidad:**

- Ninguna consulta nueva en el camino del drenaje: el coste por corrida no cambia.
- El encolado de una publicación es **una** sentencia de inserción, no N. La acción masiva de 500
  productos es una sola sentencia, lo que también es lo que hace verdadera la atomicidad del
  criterio 6.
- La emisión sigue dentro de la transacción de la mutación, así que un `rollback` se lleva los
  eventos con él: no hay forma de divergir.
