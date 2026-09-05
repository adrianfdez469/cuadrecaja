# ADR 0063: QAB decide primero y la base local después, y la divergencia se cuenta en vez de repararse sola

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-012
**Reemplaza a:** [ADR 0030](0030-el-cambio-de-estado-de-pedido-no-escribe-en-f-004.md)
**Se apoya en:** [ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) ·
[ADR 0056](0056-acceder-por-sesion-y-gestionar-por-la-tienda-duena-del-pedido.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) ·
[E-024](../../.agents/errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md)

## Contexto

`PATCH /api/tienda-online/pedidos/[pedidoId]/status` es la **primera escritura de cuadrecaja hacia
QAB** en el hilo de pedidos. Hasta F-011 este módulo solo leía filas que el cron de F-010 ya había
persistido, y el `PATCH` respondía `501` sin tocar nada (ADR 0030). Ahora tiene que hacer dos cosas
que pueden fallar por separado:

1. contarle el nuevo estado a QAB, que es quien pinta la página pública del comprador;
2. reflejarlo en `PedidoEntrante.status`, que es lo que ve el encargado en la bandeja.

No hay transacción posible entre las dos: una es una petición HTTP a otro sistema y la otra un
`UPDATE` en Postgres. Así que hay un orden, y el orden decide **qué queda escrito cuando solo una de
las dos sale bien**. Los dos repartos posibles fallan de forma distinta:

- **Local primero.** Si después falla la llamada, cuadrecaja cree un estado que la página del
  comprador nunca mostró. Es una mentira invisible: nada la señala, y solo se descubre cuando
  alguien compara los dos sistemas a mano. Y no hay compensación barata — deshacer el `UPDATE`
  exige otro `UPDATE` que también puede fallar.
- **QAB primero.** Si falla la llamada, no se escribió nada y no hay nada que limpiar. Si QAB acepta
  y falla la escritura local, cuadrecaja se queda atrás: el comprador ya ve el estado nuevo y el
  encargado ve el viejo. Es recuperable a mano, y volver a pulsar el botón lo arregla — porque
  reportar el mismo estado dos veces está permitido por el contrato («el POS sigue siendo la
  autoridad y puede reportar cualquiera de los seis valores sobre cualquier pedido que le
  pertenezca», § ③④).

Hay además una asimetría que no depende de la implementación: **QAB es quien le habla al comprador.**
Una discrepancia en la que QAB va por delante es un retraso de una pantalla interna; una en la que
cuadrecaja va por delante es una promesa que nadie le hizo al comprador.

Y un dato del terreno que quita el miedo a quedarse atrás: **el pull de F-010 solo crea filas**
(`insertQabOrder`, y `readExistingQabOrderIds` salta las que ya están), así que ninguna corrida del
cron va a pisar —ni a reparar— el `status` que este feature acaba de escribir. Lo que quede
divergente, se queda divergente hasta que alguien actúe.

## Decisión

**Se llama a QAB primero. Solo si QAB acepta se escribe en la base local. Si la escritura local
falla después de un `200`, el pedido queda divergente, la ruta responde `200` diciéndolo
explícitamente, y el servidor deja un registro que nombra el pedido por su `pedidoId` interno.**

En detalle, y esto es todo lo que hay:

1. **Ninguna escritura local antes de la llamada.** Si QAB responde cualquier error (`400`, `401`,
   `403`, `404`, `409`, `503`, un estado no documentado) o la llamada no llega a tener respuesta
   (transporte, timeout), `PedidoEntrante.status` **no cambia** y la ruta responde `502` (ADR 0064).
   No se escribe ninguna otra columna tampoco: ni una marca de intento fallido, ni un contador.
2. **La escritura local es un `updateMany` filtrado por `negocioId`**, y su resultado se mira: un
   `count` distinto de 1 cuenta como fallo, igual que una excepción (E-024: un `updateMany` que no
   escribe no falla).
3. **La divergencia es un valor, no una excepción.** El resultado de la operación es una unión:
   `{ kind: "applied"; status; persisted: boolean }` o `{ kind: "refused"; code }`. `persisted` solo
   existe dentro de la rama en la que QAB ya aceptó, así que «QAB rechazó pero se escribió» no es un
   estado representable — no hace falta prohibirlo.
4. **`persisted: false` sale con `200`, no con `500`.** El cambio ocurrió donde más importa: el
   comprador ya lo ve. Un `500` diría «no pasó nada», que es falso, y dejaría al encargado
   recargando una pantalla que le enseñaría el estado viejo sin explicación.
5. **El registro de la divergencia es una línea de log con tres campos y ni uno más:** el prefijo
   fijo `TIENDA_ONLINE_ORDER_STATUS_DIVERGED`, el `pedidoId` interno, el `status` reportado (uno de
   los seis literales de nuestro propio enum) y una `cause` acotada. **Nunca `Order.code`, nunca
   `qabOrderId`, y nunca el error capturado** — un error de driver cita el dato que lo rompió
   (E-031). La línea la fabrica una función pura cuya firma no recibe el `code` ni el `qabOrderId`:
   no es una promesa de no escribirlos, es que no los tiene.
6. **No se reintenta nada, ni se compensa nada.** Ni la llamada a QAB (ADR 0064), ni la escritura
   local. La recuperación es que una persona vuelva a pulsar: repite la llamada, QAB la acepta otra
   vez, y la escritura local se intenta de nuevo.

Para poder llamar a QAB hace falta el `qabOrderId` del pedido, que el gate de F-011 no leía. La
consulta del gate (`readTiendaOnlineOrderTiendaId`) pasa a devolver `{ tiendaId, qabOrderId }` o
`null` y se renombra a `readTiendaOnlineOrderGateTarget`. **El colapso que protegía se conserva
íntegro**: sigue devolviendo un único `null` para «no existe», «es de otro negocio» y «existe y no
tiene tienda dueña», así que no queda ninguna rama que distinga esos tres casos. Lo que cambia es
solo qué trae cuando sí resuelve. Esto sustituye la frase del contrato de F-011 § 4.2 que explicaba
por qué devolvía `string | null`; el motivo que daba —el colapso— sigue siendo cierto y sigue
implementado.

El token del negocio (`loadQabToken`) se lee **después** de que el gate haya autorizado, nunca
antes: un llamante al que se le va a responder `403` o `404` no provoca la lectura de un secreto.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Escribir local primero y llamar a QAB después | Deja a cuadrecaja creyendo un estado que el comprador nunca vio, sin ninguna señal. Y el reverso —deshacer el `UPDATE`— es otra escritura que también puede fallar, así que no cierra el agujero, lo mueve |
| Un outbox: escribir local y encolar la llamada a QAB | Es la solución correcta para una escritura que puede esperar, y esta no puede: el encargado pulsa «entregado» y necesita saber ahora si el comprador lo verá. Además el `409` de envío sin cotizar (ADR 0064) no es reintentable, así que la cola tendría que saber distinguir sus propios fallos permanentes de los transitorios — que es exactamente el trabajo que el outbox del catálogo ya hace y que aquí no se gana nada replicando |
| Responder `500` cuando la escritura local falla tras el `200` de QAB | Miente sobre lo que pasó: el comprador ya ve el cambio. Y empuja al encargado a recargar, que es justo lo que le enseña el dato viejo |
| Reintentar la escritura local en el mismo request | Un segundo intento contra la misma base que acaba de fallar es casi siempre el mismo fallo, y alarga un request que el encargado está mirando. Volver a pulsar es un reintento mejor: lo decide una persona que sabe si tiene sentido |
| Escribir también `cancelledBy: "STORE"` al cancelar o rechazar | Es una regla de QAB —quién cerró el pedido— reescrita de este lado, y una regla parafraseada en dos sistemas diverge (E-014). La relectura lateral de un pedido concreto es de F-013, y es la que traerá ese campo con su valor real. El coste asumido está abajo |
| Envolver la llamada HTTP en la transacción de Postgres | Mantiene abierta una transacción durante una petición de red a otro sistema. Es la receta conocida para agotar el pool con un upstream lento, y no da atomicidad real de todas formas: el `200` de QAB no se deshace con un `ROLLBACK` |

## Consecuencias

**A favor:**

- El sistema que le habla al comprador nunca va por detrás del que le habla al encargado. La única
  discrepancia posible es la benigna, y es visible.
- Un fallo de QAB no deja rastro que limpiar: no se escribió nada, y el criterio 8 se comprueba
  leyendo el `status` en la base después de forzar cada fallo.
- La divergencia no es representable «al revés» —`persisted` vive dentro de la rama aceptada—, así
  que el caso imposible no hay que probarlo.
- La recuperación no necesita código: volver a pulsar es idempotente del lado de QAB por el propio
  contrato.

**En contra / coste asumido:**

- Un pedido puede quedar con el `status` viejo en la bandeja mientras QAB tiene el nuevo, **y ningún
  proceso lo arregla solo**. Depende de que alguien lea el log o vuelva a pulsar. Es un coste
  aceptado a cambio de no construir una cola para una acción interactiva.
- Un pedido cancelado o rechazado desde cuadrecaja queda con `cancelledBy: null` en la base local
  hasta que exista la relectura lateral de F-013, aunque QAB ya lo tenga como `STORE`. Se dice aquí
  para que no se lea como un olvido: la pantalla de detalle de F-011 ya no pinta la fila de
  `cancelledBy` cuando es `null`, así que no muestra nada falso, solo menos.
- El log de la divergencia dice qué pedido y qué estado, pero no dice **por qué** falló la base más
  allá de un código acotado. Diagnosticar exige mirar los logs de Postgres o de la plataforma. Es el
  precio de E-031: el mensaje del error es justamente lo que no puede salir.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** la escritura es `updateMany({ where: { id: pedidoId, negocioId } })`.
  El `negocioId` sale siempre de `session.user.negocio.id` y nunca del body ni del path. El
  `qabOrderId` que viaja a QAB se leyó de una fila que ya se resolvió por la clave compuesta
  `id_negocioId` (ADR 0007), así que no hay forma de reportar el estado de un pedido ajeno: el
  criterio 15 se sostiene porque la ruta ni siquiera llega a la llamada.
- El coste de un `PATCH` autorizado es constante: la lectura del interruptor, dos consultas en
  paralelo, la del token, una petición HTTP y un `UPDATE`. No depende del número de pedidos ni de
  líneas.
- Un QAB lento retiene el request hasta `QAB_HTTP_TIMEOUT_MS` (10 s), muy por debajo del timeout de
  30 s de `axiosClient`. No hay transacción abierta durante ese tiempo.
