# ADR 0057: El listado pagina por keyset explícito sobre `createdAt`, y el detalle vive en su propia ruta

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

`PedidoEntrante` crece sin cota: una fila por pedido de la tienda online, para siempre. El propio
andamiaje de F-004 dejó escrito que un listado sin paginar sobre esa tabla es el precedente que no
hay que dejar, y el criterio 11 lo exige ejecutándolo.

F-006 ya resolvió un listado paginado en este mismo módulo
(`GET /api/tienda-online/productos`): `orderBy` con desempate por `id`, `take: limit + 1`,
`cursor: { id }` con `skip: 1`, y un `nextCursor` que es un hecho y no una estimación. Es el
precedente a seguir.

Hay tres cosas que ese precedente no resuelve solo:

**Por qué columna se ordena.** Lo natural para una bandeja es «lo más nuevo arriba», y la columna
que dice cuándo se creó el pedido de verdad es `qabCreatedAt`. Pero es **nullable**: el parser de
F-010 la deja en `null` cuando el instante no viene o no se puede leer. Cualquier paginación por
clave —la del motor o la escrita a mano— compara los valores de las columnas de ordenación contra
los de la fila-ancla, y un `NULL` en esa comparación no ordena: el resultado sería una página que se
salta filas sin dar ningún error. `Producto.nombre`, la columna de F-006, no tiene ese problema.

**Quién localiza la fila-ancla del cursor.** El `cursor` de Prisma recibe una clave única y la
resuelve **antes** de aplicar el `where`, así que la búsqueda del ancla no queda acotada al negocio
del llamante. Qué hace el motor con un ancla que no existe, y si eso se distingue de un ancla que
existe pero es de otro negocio, es comportamiento del query engine —un binario de Rust en la 6.5.0
de este proyecto— que **no se pudo verificar por inspección**. Si los dos casos se distinguieran,
habría un oráculo de existencia en el listado, y el criterio 9 no lo cubre porque solo habla de
`GET`/`PATCH` por `pedidoId`.

**Dónde vive el detalle.** El criterio 3 pide líneas, cantidades, importes, contacto, notas y
estado. El criterio 9 pide, con estas palabras, que «`GET`/`PATCH` sobre el `pedidoId` de un pedido
ajeno responda el mismo 404 que un `pedidoId` inexistente». Hoy no existe ningún `GET` direccionable
por `pedidoId`.

## Decisión

**El listado se ordena por `createdAt` descendente con desempate por `id` descendente, las dos
columnas `NOT NULL`; el ancla del cursor se resuelve con una consulta propia filtrada por negocio y
por alcance, y la página se pide con una comparación de fila explícita, no con el `cursor` de
Prisma; y el detalle vive en su propia ruta `GET /api/tienda-online/pedidos/[pedidoId]`.**

```ts
// 1. The anchor, with the tenancy filter IN the lookup itself.
const anchor = cursor
  ? await prisma.pedidoEntrante.findFirst({
      where: { id: cursor, negocioId, tiendaId: { in: tiendaIds } },
      select: { id: true, createdAt: true },
    })
  : null;

// 2. An anchor that does not resolve ends the listing, identically for the three
//    reasons it can fail to resolve: no rows and no `nextCursor`. The two
//    counters are still computed — they do not depend on the anchor.
const exhausted = cursor !== undefined && anchor === null;

// 3. The page, with the row comparison written out. No `cursor`, no `skip`.
orderBy: [{ createdAt: "desc" }, { id: "desc" }],
take: limit + 1,
where: {
  negocioId,
  tiendaId: { in: tiendaIds },
  ...(anchor
    ? {
        OR: [
          { createdAt: { lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { lt: anchor.id } },
        ],
      }
    : {}),
},
```

`createdAt` es `NOT NULL DEFAULT CURRENT_TIMESTAMP` (verificado en
`prisma/migrations/20260901225537_qab_tienda_online_fundaciones/migration.sql:80`) e `id` es la
clave primaria: el par es un orden total, que es lo que la paginación por keyset necesita.

El keyset explícito **no es una optimización**: es lo que hace que la pregunta sobre el motor no
haya que responderla. El ancla se busca con `negocioId` y `tiendaId: { in: tiendaIds }` dentro del
propio `where`, así que un `id` de otro negocio y un `id` inexistente producen el mismo `null` en el
mismo número de consultas, y el mismo desenlace: página vacía con `nextCursor: null` y los dos
contadores calculados como siempre. No reinicia en la primera página —una UI de «cargar más»
entraría en bucle— y no responde `400` —un cursor legítimamente viejo no es un error del llamante—.

`qabCreatedAt` **sí viaja** en cada fila de la respuesta. La pantalla muestra el instante real del
pedido; lo que no hace es ordenar por él.

El tamaño de página sale de `TIENDA_ONLINE_ORDER_PAGE_SIZE_DEFAULT` (25) y se topa en
`TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX` (100). `nextCursor` es el `id` de la última fila de la página
cuando la consulta devolvió `limit + 1` filas, y `null` cuando no.

El detalle no viaja dentro del listado. La respuesta del listado lleva, por pedido, lo que la
bandeja necesita para decidir en qué entrar —código, tienda, estado, importes, contacto principal y
`lineCount`— y **ninguna línea**. Las líneas, el contacto completo, las notas y la conversión de
moneda se piden por `pedidoId`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ordenar por `qabCreatedAt` con `nulls: "last"` | Es la columna correcta semánticamente, pero es nullable, y una comparación de fila sobre una columna nullable no ordena: se salta filas **en silencio**, sin error, sin traza y sin nada que un test de una sola página detecte. Un listado que pierde pedidos es peor que uno mal ordenado |
| Ordenar por `pulledAt` | Nullable igual, y además comparte el mismo valor para toda una corrida del cron, así que no resuelve el empate que sí tiene `createdAt` |
| Añadir un índice `(negocioId, createdAt)` y ordenar por ahí | Es una migración, y el spec excluye explícitamente cualquier migración de este feature |
| Paginar por `skip`/`take` (offset) | Sobre una tabla que crece sin cota el escaneo se degrada con el número de página, y una fila insertada entre dos peticiones desplaza la ventana. Es justo lo que el precedente de F-006 evitó |
| Devolver las líneas dentro del listado | Un pedido admite hasta `QAB_ORDER_MAX_LINES` (100) líneas. Una página de 25 pedidos podría llevar 2 500 líneas para pintar una tabla que muestra un resumen por fila. Y el criterio 9 pide de todas formas un `GET` por `pedidoId` |
| Un solo `GET` con un parámetro `?detalle=1` | Dos formas de respuesta en una ruta obligan a una unión en el schema y a que la pantalla adivine cuál le tocó. Dos rutas con dos schemas `.strict()` es más barato de verificar |
| Usar el `cursor` de Prisma y confiar en que un ancla ajena o inexistente dé lo mismo | Es lo que no se pudo verificar. Un contrato no puede apoyar una garantía de aislamiento en comportamiento de un motor que nadie ha comprobado; y comprobarlo ataría F-011 a una versión concreta de Prisma |
| Usar el `cursor` de Prisma y validar el `cursor` antes, con una consulta filtrada por negocio | Cierra el agujero, y deja dos mecanismos de paginación encadenados: nuestra consulta para autorizar el ancla y la del motor para volver a buscarla. Si el keyset ya hay que escribirlo para validar, escribirlo entero cuesta tres líneas más y elimina la segunda búsqueda |
| Responder `400` a un cursor que no resuelve | Es constante y no filtra nada, pero convierte un cursor viejo —una pestaña abierta desde ayer— en un error del llamante que no puede arreglar |
| Reiniciar en la primera página cuando el cursor no resuelve | También es constante, y mete a una UI de «cargar más» en un bucle que nunca termina |

## Consecuencias

**A favor:**

- El criterio 11 se verifica sembrando más filas que el límite y pidiendo la página siguiente, sin
  ningún montaje especial: es el mismo mecanismo que un `qa` ya ejecutó en F-006.
- El criterio 9 se verifica con dos `curl` sobre la ruta de detalle, sin pasar por la pantalla.
- La respuesta del listado tiene un tamaño acotado por el número de pedidos de la página, no por el
  número de líneas que traigan.
- La paginación no depende de ningún comportamiento no documentado del query engine: la comparación
  de fila está escrita y se lee en el propio `where`.

**En contra / coste asumido:**

- **Los pedidos que entran en la misma corrida del cron comparten el mismo `createdAt`.** El
  `DEFAULT CURRENT_TIMESTAMP` de Postgres es el instante de inicio de la transacción, y el pull de
  un negocio escribe todos sus pedidos dentro de una sola. Dentro de ese grupo el orden lo decide el
  `id`, que es un UUID: es estable entre peticiones y es arbitrario respecto al orden real de
  compra. Con una corrida cada dos minutos el grupo suele ser pequeño, y la fila muestra
  `qabCreatedAt` para que el encargado vea el instante verdadero. Cambiarlo pide un índice y una
  migración, que están fuera del alcance de F-011.
- **No hay índice que sirva a la vez al filtro y a la ordenación.** Los índices existentes de
  `PedidoEntrante` son `(negocioId, status)`, `(negocioId, code)` y `(tiendaId, qabCreatedAt)`;
  ninguno cubre `negocioId + tiendaId IN (…)` ordenado por `createdAt`. Con el volumen de una
  tienda online arrancando el coste no se nota, y la solución —un índice nuevo— es una migración
  fuera de alcance. Queda dicho aquí para que quien lo vea en un plan sepa que no es un descuido.
- Abrir un pedido cuesta una petición más. Es lo que ya cuesta cualquier detalle del sistema.
- **Una consulta más por página pedida con `cursor`**, la del ancla, que el `cursor` de Prisma
  habría hecho dentro del motor. Va sobre la clave primaria. La primera página no la paga.
- **Se aparta del precedente de F-006**, que sí usa `cursor`/`skip`. La diferencia es que allí el
  alcance es el negocio entero y aquí es un subconjunto de tiendas, y que allí nadie se hizo la
  pregunta. Este ADR no cambia F-006: es código cerrado y verificado, y revisarlo es su propia
  decisión, no un efecto lateral de esta.

**Impacto en seguridad y escalabilidad:**

- Las dos rutas de lectura llevan el mismo `where` de tenencia: `negocioId` de la sesión y
  `tiendaId: { in: scope.tiendaIds }` (ADR 0056). El detalle además resuelve el pedido por la clave
  compuesta `id_negocioId`, que es lo que hace imposible olvidarse del filtro.
- El `take` está topado por `TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX` en el schema de la query, así que
  un llamante no puede pedir la tabla entera subiendo `limit`.
- **El `cursor` no es un oráculo de existencia.** Su ancla se resuelve con `negocioId` y con el
  alcance de tiendas dentro del mismo `where`, así que un `id` de otro negocio, uno de una tienda
  no asignada y uno que no existe dan el mismo `null`, con la misma consulta, y producen la misma
  página vacía. La verificación ejecutable está en el § 9.5 del contrato, caso 7.
