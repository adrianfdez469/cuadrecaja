# ADR 0058: «Sin atender» se define una vez y su cuenta viaja en la respuesta del listado

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

El criterio 7 pide un contador de pedidos sin atender que coincida con el número de filas en estado
`PULLED` de las tiendas del usuario. El criterio 12 lo endurece con la lección de **E-014**: tiene
que existir **una** función o consulta nombrada que defina «sin atender», y ninguna otra parte del
código puede reimplementar el filtro parafraseado.

E-014 no es una preferencia de estilo. En F-005 una señal derivada se llamaba una cosa y se
calculaba otra, la definición estaba parafraseada en ocho sitios entre contrato, diseño y
comentarios, y corregirla dejó uno atrás. El daño no fue el error inicial: fue que la definición no
tenía dueño.

«Sin atender» tiene **dos mitades**, y las dos se pueden parafrasear:

- la mitad de **estado**: `status === "PULLED"`, uno de los nueve valores de `QAB_ORDER_STATUSES`
  guardados como texto libre (ADR 0004);
- la mitad de **alcance**: las mismas tiendas que filtran el listado de los criterios 1 y 2, ni una
  más.

Falta además decidir cómo llega el número al cliente: campo de la respuesta del listado, o endpoint
propio.

## Decisión

**Una constante para el estado, un constructor de `where` para el filtro completo, una función de
conteo, y el número viaja como un campo más de la respuesta del listado.**

```ts
// src/constants/tiendaOnline.ts
export const TIENDA_ONLINE_UNATTENDED_STATUS: (typeof QAB_ORDER_STATUSES)[number] = "PULLED";

// src/lib/tiendaOnline/tiendaOnlineOrders.ts
export function isUnattendedOrderStatus(status: string): boolean;
export function unattendedOrdersWhere(params: {
  negocioId: string;
  tiendaIds: string[];
}): Prisma.PedidoEntranteWhereInput;
export async function countUnattendedTiendaOnlineOrders(params: {
  negocioId: string;
  tiendaIds: string[];
}): Promise<number>;
```

`unattendedOrdersWhere` es el **único** sitio donde las dos mitades aparecen juntas.
`countUnattendedTiendaOnlineOrders` lo usa, y `tiendaIds: []` devuelve `0` sin tocar la base — el
mismo patrón que `readExistingQabOrderIds` de F-010.

La marca por fila (`unattended` de cada pedido del listado) sale de `isUnattendedOrderStatus`, la
misma función que define la mitad de estado del `where`. La mitad de alcance no se repite ahí
porque la fila ya está dentro del alcance: es lo que la puso en la página.

El número llega al cliente como **`unattendedCount`, un campo de la respuesta de
`GET /api/tienda-online/pedidos`**. No hay endpoint propio en F-011.

`tiendaIds` es siempre el `scope.tiendaIds` del ADR 0056, el mismo array que el listado pasa a su
propio `where`, en la misma petición. No se resuelve dos veces.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un endpoint propio `GET /api/tienda-online/pedidos/sin-atender` | Necesitaría su propia puerta, su propia resolución de alcance y su propio filtro de tenencia: un segundo sitio donde equivocarse en lo que más caro cuesta. Y el número podría discrepar del listado por resolver el alcance en otra petición |
| Contar en el cliente las filas `PULLED` de la página | La página está paginada, así que contaría la página y no el negocio. Es exactamente el filtro parafraseado que E-014 prohíbe, y encima daría un número menor sin avisar |
| Un `groupBy` por `status` en vez de un `count` | Devuelve más de lo que ningún criterio pide y obliga a la pantalla a buscar la clave `PULLED` dentro del resultado: la definición se mudaría al consumidor |
| Derivar «sin atender» de `pulledAt !== null` o de la ausencia de un cambio de estado | Es una segunda definición para la misma señal, y `pulledAt` lo escriben todas las filas del pull, no solo las no atendidas. E-013 con otra ropa |
| Un enum cerrado de `status` para tipar la constante | `status` es texto libre a propósito (ADR 0004): el décimo valor que QAB introduzca mañana no debe romper el render. La constante se tipa contra `QAB_ORDER_STATUSES` para que un `PULLED` mal escrito no compile, y eso es todo |

## Consecuencias

**A favor:**

- El criterio 12 se verifica comparando `unattendedCount` con un `COUNT` directo sobre la base con
  el mismo filtro, sembrando pedidos en varios `status`. No hace falta auditar la pantalla.
- El número y el listado no pueden discrepar: salen del mismo `scope.tiendaIds` de la misma
  petición.
- Una futura pantalla que necesite el número —un badge en el Drawer, por ejemplo— llama a
  `countUnattendedTiendaOnlineOrders`, no reescribe el `where`.

**En contra / coste asumido:**

- **Un `count` por cada página pedida**, aunque el número solo cambie cuando entra un pedido nuevo.
  Va sobre `(negocioId, status)`, que es un índice existente de `PedidoEntrante`. Cachearlo o
  pedirlo solo en la primera página haría que el número envejeciera justo mientras el encargado
  mira la pantalla, que es cuando importa.
- El número solo se puede obtener pidiendo una página del listado. Ninguna pantalla de F-011 lo
  necesita de otra forma; la que lo necesite abrirá su ruta llamando a la misma función.

**Impacto en seguridad y escalabilidad:**

- El `where` del contador lleva `negocioId` **y** `tiendaId: { in: tiendaIds }`. El `negocioId` es
  redundante —los `tiendaIds` ya salen filtrados por negocio— y se pone igual: hace que la consulta
  sea visiblemente multi-tenant en el sitio donde se lee, y aprovecha el índice
  `(negocioId, status)`.
- `tiendaIds: []` no consulta: un usuario sin tiendas asignadas en ese negocio recibe `0` sin
  provocar ninguna consulta ni ninguna fila.
