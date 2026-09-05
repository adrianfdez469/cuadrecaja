# ADR 0052: El pull escribe por pre-lectura y `create`, nunca por `upsert` ni por capturar el `P2002`

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-010

## Contexto

`pullQabOrders` corre **dentro** de la transacción interactiva que abre
`withQabOrderPollLock` (ADR 0009, ADR 0015). Dentro de esa transacción tiene que escribir en
`PedidoEntrante` los pedidos que el pull incremental acaba de entregar, y el spec fija dos
comportamientos que a primera vista parecen el mismo:

- **Criterio 3:** la corrida siguiente no vuelve a traer el pedido y no crea un duplicado.
- **Criterio 4:** entregar **dos veces** el mismo pedido crea una sola fila, y lo impide la clave
  `@@unique([negocioId, qabOrderId])`.

No son el mismo. El criterio 3 lo sostiene el cursor: `since = qabUltimoPedidoVisto` excluye el
pedido para siempre en cuanto el cursor lo supera. El criterio 4 es la defensa de **debajo** del
cursor: el propio contrato de QAB declara que la lectura y la marca como `PULLED` de su lado no son
atómicas entre sí, y que dos pollers simultáneos del mismo negocio pueden recibir el mismo pedido
dos veces.

A eso se suma que el spec exige que un pedido ya presente **no se reescriba** ("el pull incremental
no vuelve a traerlo por diseño del cursor"), y que la corrida tiene que saber **cuáles** pedidos son
nuevos: sin esa lista no puede escribir las líneas de cada uno ni publicar un `created` que
signifique algo.

Y una ambigüedad que el spec delega explícitamente al arquitecto: **cómo se verifica el criterio 4
sin depender de ganarle una carrera al advisory lock.** Provocar dos pollers HTTP realmente
simultáneos del mismo negocio no es reproducible de forma determinista, y un criterio que solo se
comprueba ganando una condición de carrera no es un criterio verificable.

## Decisión

**Una pre-lectura de los `qabOrderId` ya presentes, y después un `create` por cada pedido ausente.
Ni `upsert`, ni `createMany({ skipDuplicates })`, ni capturar el `P2002` dentro de la transacción
del lock.**

```ts
const existing = await readExistingQabOrderIds({ tx, negocioId, qabOrderIds });
const toCreate = selectNewQabOrders(existing, orders); // puro
for (const order of toCreate) { await tx.pedidoEntrante.create({ data: /* ... */ }); }
```

`readExistingQabOrderIds` filtra por `negocioId` **y** por `qabOrderId: { in }` en el mismo `where`:
el conjunto que devuelve nunca contiene el id de un pedido de otro negocio, aunque el `qabOrderId`
sea global y otro negocio tenga uno con el mismo valor.

`selectNewQabOrders` es **puro**: recibe el conjunto de ids presentes y la lista de pedidos, y
devuelve los que hay que crear, deduplicados también **dentro** de la propia lista — la misma página
puede traer el mismo id dos veces y esa es exactamente la anomalía que el contrato de QAB describe.

Y la verificación del criterio 4, en **tres niveles disjuntos**, ninguno de ellos una carrera:

1. **Puro, en la suite.** `selectNewQabOrders(new Set(["42"]), [pedido42])` devuelve `[]`.
   Determinista, sin base de datos y sin red.
2. **Contra la base, sin el lock.** Invocar `insertQabOrders` **dos veces seguidas** con el mismo
   lote, cada una en su propia transacción y **fuera** de `withQabOrderPollLock`. Después:
   `count` de `PedidoEntrante` para ese `(negocioId, qabOrderId)` es `1`, y la segunda invocación
   devuelve `created: 0`. Esto prueba la idempotencia de la función, no la del lock.

   **Para que ese nivel exista, `insertQabOrders` tiene que pre-leer ella misma**, y por eso lo hace
   aunque el bucle ya haya filtrado el lote con `selectNewQabOrders`. Sin esa segunda lectura la
   segunda invocación no devolvería `created: 0`: lanzaría un `P2002`, y el nivel 2 sería
   inejecutable tal como está escrito.

   La duplicidad es deliberada y va más allá del test: hace que la idempotencia sea una propiedad de
   **la función**, no del comportamiento de quien la llama. Un reintento tras un fallo parcial, o un
   segundo llamante futuro, no pueden convertirse en un `P2002` que aborte la transacción entera. El
   `P2002` sigue existiendo como última red, y es lo que mide el nivel 3.
3. **Contra la restricción misma.** Un `create` directo de una fila con un `(negocioId, qabOrderId)`
   que ya existe responde `P2002` nombrando esos dos campos. Esto es lo que prueba que *la clave lo
   impide*, y no solo que nuestra pre-lectura lo cazó. Se ejecuta en su propia sentencia, aislada de
   cualquier transacción del pull.

**El criterio 4 nunca se verifica lanzando dos pollers concurrentes.** Queda escrito aquí para que
`qa` no diseñe ese montaje: es una prueba de la restricción de base de datos, no de temporización de
red.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `upsert` con `update: {}` | El spec exige que un pedido presente **no se reescriba**. Un `update` vacío es una escritura que toca `updatedAt` y, sobre todo, no dice cuáles filas eran nuevas: sin esa lista no se sabe a qué pedido colgarle sus líneas ni qué contar como `created` |
| `createMany({ skipDuplicates: true })` | Conserva la primera escritura, que es lo que queremos ([E-024]), pero **no admite líneas anidadas** y tampoco informa de cuáles filas entraron. Habría que volver a leer para saberlo, que es la pre-lectura otra vez, hecha después y peor |
| `create` con `try/catch` del `P2002` | Prisma no envuelve cada sentencia de una transacción interactiva en un savepoint. Una violación de restricción deja la transacción de Postgres en estado abortado, y todas las sentencias posteriores del mismo pull fallarían — el fallo de **un** pedido se llevaría por delante a los demás del lote, que es justo lo contrario del criterio 10. Aunque ese detalle no se ha verificado ejecutándolo, la pre-lectura hace que la pregunta no llegue a plantearse, y ese es el motivo principal para preferirla |
| Confiar solo en el advisory lock | El lock evita la concurrencia **en la práctica**; el criterio 4 pide la defensa de debajo. Un lock es un mecanismo de proceso y la clave es un invariante de la base: no se sustituyen |

## Consecuencias

**A favor:**

- La corrida sabe exactamente qué filas creó, así que `created`, `duplicates` y las líneas de cada
  pedido salen de un solo recorrido y no de una segunda lectura.
- El criterio 4 se verifica de forma repetible, sin temporización y sin montar dos pollers.
- Ninguna escritura toca una fila ya presente: `rateSnapshot`, importes y `status` de un pedido ya
  pulleado quedan intactos, que es lo que el contrato de QAB exige de `rateSnapshot` («byte a byte»).
- La deduplicación dentro de la propia página está cubierta por la función pura, no por la base.

**En contra / coste asumido:**

- **Dos `pedidoEntrante.findMany` por página, no una**: la del bucle, que alimenta `duplicates` del
  informe, y la interna de `insertQabOrders`, que es la que sostiene su idempotencia. Las dos van con
  `qabOrderId: { in }` sobre `@@unique([negocioId, qabOrderId])`, así que son dos viajes indexados
  frente a los hasta `QAB_ORDER_PULL_PAGE_SIZE` `create` de esa misma página: el coste es real y es
  pequeño. Colapsarlas —pasarle el conjunto ya leído a `insertQabOrders`— devolvería la idempotencia
  al llamante, que es justo lo que se quiere evitar.
- Entre la pre-lectura y el `create` hay una ventana teórica en la que otro escritor podría insertar
  el mismo `(negocioId, qabOrderId)`. Dentro del advisory lock no hay otro escritor de este camino;
  si aun así ocurriera, el `create` fallaría con `P2002` y **la transacción del pull de ese negocio
  se aborta**, sin avanzar el cursor y sin escribir nada. Se reintenta en la corrida siguiente. Es un
  fallo ruidoso y recuperable, no una fila duplicada.

  Ese `P2002` **no lo puede atrapar `pullQabOrders`**: para cuando llega, la transacción de Postgres
  ya está abortada y cualquier sentencia posterior fallaría también. Sale por fuera de
  `withQabOrderPollLock`, y por eso **cada iteración del bucle de `syncTiendaCron.ts` lleva su propio
  `try/catch`** — sin él, un `P2002` de un negocio dejaría sin procesar a todos los que vinieran
  detrás en esa corrida, que es justo lo que prohíbe el criterio 12. El desenlace se reporta con
  `lock: "unknown"`, porque desde fuera del slot no se puede saber si el `pg_try_advisory_xact_lock`
  llegó a ejecutarse.
- La pre-lectura no reescribe un pedido cuyo `status` haya cambiado del lado de QAB. Es deliberado y
  está fuera del alcance de F-010: releer un pedido ya pulleado es la lectura lateral de F-017.

**Impacto en seguridad y escalabilidad:**

- El `where` de la pre-lectura lleva `negocioId`, así que el conjunto de "ya presentes" nunca cruza
  tenants. Un `qabOrderId` que exista en otro negocio no cuenta como presente aquí, y por tanto no
  suprime un pedido legítimo de este.
- Los `create` de una página son como mucho `QAB_ORDER_PULL_PAGE_SIZE`, dentro de una transacción con
  presupuesto de tiempo propio (ADR 0054). No hay recorrido `O(pedidos totales del negocio)` en
  ninguna parte de este camino.

[E-024]: ../../.agents/errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md
