# ADR 0065: Las guardas de transición viven en una función pura que alimenta la pantalla, y el backend solo estrecha el enum a los seis valores reportables

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-012
**Se apoya en:** [ADR 0004](0004-enums-del-contrato-como-texto.md) ·
[ADR 0056](0056-acceder-por-sesion-y-gestionar-por-la-tienda-duena-del-pedido.md) ·
[E-015](../../.agents/errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md)

## Contexto

El contrato v10.1 es explícito sobre quién manda: fuera de la guarda del envío sin cotizar, «el POS
sigue siendo la autoridad y puede reportar cualquiera de los seis valores sobre cualquier pedido que
le pertenezca». QAB no comprueba que `DELIVERED` venga después de `READY`, ni que un pedido ya
entregado no vuelva a `CONFIRMED`.

Los criterios 12, 13 y 14 del spec sí piden esas restricciones, pero son **decisiones de producto de
cuadrecaja**, no del contrato, y su enunciado es sobre lo que la pantalla ofrece: «no ofrece ningún
control», «la UI solo ofrece como destino…». El único criterio que habla de un rechazo del servidor
es el 2, y es sobre un valor concreto: `AWAITING_CUSTOMER` responde `400`.

Y hay una restricción que atraviesa todo: **`PedidoEntrante.status` es texto libre** (ADR 0004). El
enum ya creció una vez, de 6 a 9 valores. El décimo que QAB introduzca mañana llegará por el pull, se
guardará tal cual y tendrá que pintarse sin romper nada — que es exactamente por lo que
`orderStatusPresentation` de F-011 no tiene un `switch` exhaustivo.

## Decisión

**Una sola función pura decide qué transiciones se ofrecen, vive en un `.ts` de `src/lib/`, y el
backend no comprueba ninguna transición: su única guarda de estado es que el valor sea uno de los
seis que `POST /orders/status` acepta.**

### 1. La función, y exactamente qué devuelve

`offerOrderStatusTransitions(currentStatus: string): IOrderTransitionOffer`, en
`src/lib/tiendaOnline/tiendaOnlineOrderStatus.ts`. Un `.ts` y no un `.tsx` por E-015: ningún símbolo
que viva en un `.tsx` es importable desde un test, aunque sea puro. Y en `lib/` y no en
`orderPresentation.ts` porque no es copy: es una regla de producto sobre el dominio, y quien la lea
tiene que encontrarla junto al resto de las reglas del cambio de estado.

Devuelve `{ targets, blocked }`, con la invariante `blocked === null` ⟺ `targets.length > 0`. Una
sola función y no dos (`isTerminal` + `targets`): la misma pregunta contestada en dos sitios diverge
la primera vez que alguien afine una (E-014). Y `blocked` existe porque la pantalla necesita decir
**tres cosas distintas** cuando no hay controles, no solo esconderlos.

Las reglas, y no hay ninguna más (E-032):

- La secuencia es `PULLED → CONFIRMED → READY → IN_TRANSIT → DELIVERED`, escrita una sola vez en
  `QAB_ORDER_STATUS_SEQUENCE`.
- **Terminal** (`DELIVERED`, `CANCELLED`, `REJECTED_BY_STORE`): `targets: []`, `blocked: "TERMINAL"`.
- **`AWAITING_CUSTOMER`**: `targets: []`, `blocked: "AWAITING_CUSTOMER"`. Responder a una propuesta
  es trabajo de F-013, y ofrecer aquí un cambio de estado sobre un pedido que está esperando al
  comprador es pisar esa conversación.
- **En la secuencia y no terminal** (`PULLED`, `CONFIRMED`, `READY`, `IN_TRANSIT`): todos los valores
  **estrictamente posteriores** en la secuencia, en su orden, más `CANCELLED` y `REJECTED_BY_STORE`
  al final. Saltar hacia adelante está permitido —desde `PULLED` se puede ir directo a `DELIVERED`—;
  retroceder, no. `blocked: null`.
- **Cualquier otro valor**, `PENDING` incluido y el décimo que llegue mañana: `targets: []`,
  `blocked: "UNKNOWN_STATUS"`.

`AWAITING_CUSTOMER` no aparece en la secuencia ni entre los dos extras, así que **no puede salir en
`targets` desde ningún estado de origen**. El criterio 13 se cumple por construcción, no por una
comprobación.

La rama de lo desconocido es la que hace que ADR 0004 siga en pie: el décimo estado no rompe la
pantalla ni la ruta, simplemente no ofrece ningún control. No hay ningún `switch` exhaustivo, y el
valor desconocido se pinta con `normalizeUnknownCode` como ya hacía F-011.

### 2. El backend no comprueba transiciones

`PATCH /api/tienda-online/pedidos/[pedidoId]/status` **no** llama a `offerOrderStatusTransitions` ni
lee el `status` actual del pedido para compararlo. Su única guarda de estado es el schema del cuerpo,
que pasa de aceptar las **nueve** posiciones de `QAB_ORDER_STATUSES` a aceptar exactamente los
**seis** de `QAB_ORDER_STATUS_REPORTABLE`. `AWAITING_CUSTOMER`, `PENDING` y `PULLED` responden
`400 INVALID_BODY`, que es el criterio 2.

Motivos, en orden de peso:

1. **El spec lo dice y el contrato lo respalda:** las guardas 12-14 son de la UI. Una copia en el
   backend sería la misma regla en dos sitios, con la garantía de que una de las dos se queda vieja.
2. **Rechazar una transición «hacia atrás» en el servidor exigiría leer el `status` actual**, y ese
   dato es el que puede estar divergente respecto de QAB (ADR 0063). Se estaría rechazando una acción
   legítima basándose en una copia posiblemente atrasada del estado que la otra parte ya tiene.
3. **QAB es la autoridad de esa decisión** y la ejerce con su propia guarda cuando le importa (el
   `409` del envío sin cotizar). Duplicarla aquí es E-032 con otro traje.

Lo que esto significa, dicho sin rodeos para que nadie lo lea como un descuido: **una petición
fabricada a mano por un usuario que sí tiene `.gestionar` en la tienda dueña puede reportar
`CONFIRMED` sobre un pedido ya entregado, o `DELIVERED` sobre uno recién pulleado.** No es una
escalada de privilegios —ese usuario ya está autorizado a cambiar el estado de ese pedido— y el
resultado es exactamente el que tendría si lo hiciera desde la pantalla en dos pasos. Lo que no
puede hacer es tocar un pedido fuera de su alcance (`404`) ni sin `.gestionar` (`403`): esas dos sí
son fronteras y sí están en el backend (ADR 0056).

### 3. Las etiquetas de los destinos se reutilizan, no se reescriben

El texto de cada destino sale de `orderStatusPresentation(target).label`, que F-011 ya escribió. Esta
función devuelve **valores**, nunca palabras: cómo se presenta cada uno es del contrato de diseño.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Validar la transición también en el backend | Duplica la regla, y para hacerlo tendría que leer un `status` local que puede estar divergente del de QAB (ADR 0063): rechazaría acciones legítimas por una copia atrasada |
| Un `switch` exhaustivo sobre los nueve estados | `status` es texto libre y el enum ya creció una vez (ADR 0004). Un exhaustivo sin `default` rompe con el décimo valor, y con `default` no es exhaustivo: mejor una tabla de secuencia y una rama de desconocido explícita |
| Dos funciones, `isTerminalOrderStatus` y `orderStatusTransitions` | La misma pregunta en dos definiciones: la primera corrección deja una atrás (E-014) |
| Devolver solo `targets: []` y que la pantalla deduzca el motivo | La pantalla tendría que volver a preguntar «¿es terminal?, ¿es `AWAITING_CUSTOMER`?», que es la paráfrasis que `blocked` evita. Y son tres frases distintas para el encargado, no una |
| Ofrecer `AWAITING_CUSTOMER` como destino desde `PULLED` o `CONFIRMED` | Es el estado que fija `POST /orders/proposal`, no `POST /orders/status`, y el contrato responde `400 INVALID_BODY` si se intenta. Poner el pedido a esperar al comprador sin haberle propuesto nada es una promesa vacía |
| Ofrecer controles sobre un pedido en `AWAITING_CUSTOMER` | Hay una propuesta viva con un plazo. Cambiar el estado por debajo es F-013 decidiendo, y F-012 no tiene el contexto para hacerlo bien |
| Dejar la función en `orderPresentation.ts` | Ese archivo es el sitio del copy de estas pantallas. Qué transiciones son legítimas es una regla de dominio, y mezclarlas hace que un retoque de redacción toque el archivo donde vive una regla de negocio |

## Consecuencias

**A favor:**

- Los criterios 12, 13 y 14 se verifican llamando a una función pura con cada uno de los nueve
  estados más uno inventado, sin abrir el navegador; y en pantalla, comprobando que lo ofrecido
  coincide con lo que devuelve.
- El décimo estado que QAB introduzca no rompe nada: no ofrece controles y se pinta normalizado.
- La frontera de seguridad queda en un solo sitio y no se confunde con la regla de producto.

**En contra / coste asumido:**

- Un `PATCH` fabricado a mano puede saltarse las guardas 12-14. Está dicho arriba y es deliberado; si
  alguna vez deja de ser aceptable, el cambio es añadir la comprobación en el backend **y** decidir
  primero qué hacer cuando el `status` local está divergente.
- **La consecuencia que hereda F-014, y es la importante de este ADR.** Un mismo estado puede
  reportarse **más de una vez** y **fuera de secuencia**: un `PATCH` fabricado, un doble clic que la
  pantalla no bloquee, o simplemente el reintento manual con el que se recupera un
  `persisted: false` (ADR 0063). Así que **F-014 no puede asumir que la llegada a `CONFIRMED` o a
  `DELIVERED` sea única ni monótona.** Si cuelga de esas transiciones un `MovimientoStock` o la
  creación de la `Venta`, la guarda de idempotencia de esa escritura **es responsabilidad suya**: ni
  este ADR, ni el contrato de F-012, ni la ruta se la dan. Un descuento de inventario aplicado dos
  veces por dos pulsaciones no es un caso raro de laboratorio; es lo que pasa cuando una red lenta
  hace que alguien vuelva a pulsar.
- `PENDING` no ofrece ningún control, aunque en teoría sea un estado del que se podría avanzar. Es
  un estado que QAB pone antes de que el pedido esté listo para el POS y que los criterios no
  enumeran: ofrecer menos de lo pedido es recuperable; ofrecer de más, no.

**Impacto en seguridad y escalabilidad:**

- La función es pura y O(número de estados de la secuencia). No consulta nada.
- El estrechamiento del schema reduce la superficie del `PATCH`: tres valores que antes llegaban al
  gate y a las dos consultas ahora mueren en el `safeParse`, antes de tocar la base.
- `canManage` sigue siendo comodidad de la interfaz y no la frontera: el `PATCH` vuelve a comprobar
  `.gestionar` contra la tienda dueña en cada petición (ADR 0056).
