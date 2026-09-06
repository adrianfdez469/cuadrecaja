# ADR 0072: Un pedido se ata a su `Venta` por una columna única, y a su reserva por un reclamo en el propio pedido

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-014

## Contexto

El ADR 0071 fija **qué** pasa en cada transición. Falta **cómo se sabe si ya pasó**. Ni `Venta` ni
`MovimientoStock` tienen hoy una columna que apunte a un `PedidoEntrante`, y sin ella hay tres
preguntas que no se pueden responder:

1. ¿Ya se generó el movimiento de reserva de este pedido? (criterio 9, rama `CONFIRMED`)
2. ¿Ya se generó la `Venta` de este pedido? (criterio 9, rama `DELIVERED`)
3. Dada una `Venta`, ¿viene de un pedido de tienda online, y de cuál? (criterio 6)

Y el problema no es solo de lectura. F-012 dejó escrito, literalmente, que **no hay guarda de
transición en el backend** (ADR 0065): un `PATCH { status: "CONFIRMED" }` repetido, o un `DELIVERED`
reportado dos veces, son peticiones que la ruta acepta sin más. *«F-014 no puede asumir que la
llegada a `CONFIRMED` o a `DELIVERED` sea única ni monótona: si cuelga de ahí un `MovimientoStock` o
una `Venta`, la guarda de idempotencia de esa escritura es suya.»*

Una guarda de idempotencia que sea «leer si ya existe y, si no, escribir» tiene una carrera entre las
dos mitades. Dos `PATCH` simultáneos con el mismo destino leen ambos «no existe» y escriben ambos.
Con doble clic desde la bandeja, eso no es hipotético.

El precedente más cercano en el modelo es `MovimientoStock.referenciaId`: texto libre, sin FK, sin
índice único, donde `DEVOLUCION_VENTA` guarda el id de la venta original. Sirve para **encontrar**,
no para **impedir**.

## Decisión

**Dos mecanismos distintos, porque las dos escrituras tienen forma distinta: la `Venta` es una fila y
se ata con un `@unique`; la reserva son N filas y se reclama con un `UPDATE` condicional sobre el
propio pedido.**

### La `Venta`: `Venta.pedidoEntranteId`, único y nullable

```prisma
model Venta {
  // ...
  pedidoEntrante   PedidoEntrante? @relation(fields: [pedidoEntranteId], references: [id])
  pedidoEntranteId String?         @unique
}
```

- Responde la pregunta 2 y la 3 a la vez.
- El `@unique` **es** la guarda: la segunda escritura concurrente no gana una carrera, choca contra el
  índice y sale por `P2002`. La idempotencia la garantiza el motor, no el orden en que se ejecuten
  dos peticiones.
- `NULL` significa «venta del POS». `NOT NULL` significa «pedido de tienda online», y esa es la
  respuesta consultable que el criterio 6 pedía: los agregadores de `src/lib/reports/` ya leen filas
  de `Venta`, así que el origen viaja con la fila sin un `JOIN` adicional ni un `LIKE`.

### La reserva: `PedidoEntrante.stockReservedAt`, reclamado con un `UPDATE` condicional

```prisma
model PedidoEntrante {
  // ...
  /// NOT NULL <=> this order currently holds a stock reservation. Claimed and
  /// released with a conditional updateMany, never with a read-then-write.
  stockReservedAt DateTime?
}
```

El reclamo, dentro de la transacción del aterrizaje:

```ts
const claimed = await tx.pedidoEntrante.updateMany({
  where: { id: pedidoId, negocioId, stockReservedAt: null },
  data: { stockReservedAt: new Date() },
});
if (claimed.count === 0) {
  // Already reserved. Not an error: this is the repeated PATCH of criterion 9.
}
```

Un solo `UPDATE` con predicado. Dos transacciones concurrentes se serializan sobre el candado de
fila: la segunda espera, reevalúa el predicado contra la fila ya escrita y afecta a **cero** filas.
La liberación es el espejo exacto, con `stockReservedAt: { not: null }` y `data: { stockReservedAt:
null }`, y ahí está el criterio 10 sin ninguna rama dedicada: un pedido que nunca pasó por
`CONFIRMED` tiene `stockReservedAt` a `NULL`, el reclamo de liberación afecta a cero filas, y no se
escribe ningún reverso.

**El `where` lleva `negocioId`.** No es defensa en profundidad decorativa: es el mismo par
`(id, negocioId)` que `writeTiendaOnlineOrderStatus` ya usa, y `PedidoEntrante` tiene el
`@@unique([id, negocioId])` que lo hace barato.

### Qué se reserva y qué se libera

`MovimientoStock.referenciaId = pedidoId` en los dos tipos nuevos. No es la guarda —para eso está el
reclamo— sino la trazabilidad: es lo que permite responder «qué se tomó exactamente por este pedido».

Y esa es la fuente del reverso. **La liberación espeja los `PEDIDO_ONLINE_RESERVA` realmente
escritos, nunca las líneas del pedido.** Las dos no son lo mismo: una línea con
`storeProductExternalId` nulo, o que ya no resuelve, o sin existencia suficiente, se saltó al
confirmar (ADR 0071) y no tiene movimiento. Reversar desde las líneas devolvería a inventario
mercancía que nunca salió de él.

### El `DELIVERED` también deriva del pedido, no de la reserva

Las líneas de la `Venta` (`VentaProducto`) se construyen cruzando **las dos** fuentes: el
`PEDIDO_ONLINE_RESERVA` dice qué `ProductoTienda` y qué cantidad salieron de verdad; la
`PedidoEntranteLinea` dice a qué precio y en qué moneda las aceptó el comprador. Una línea sin
reserva no produce `VentaProducto` —`VentaProducto.productoTiendaId` es una FK obligatoria y no hay
nada a lo que apuntar—, pero **sí está incluida en `Venta.total`**, que se copia del pedido (ADR
0073).

Eso significa que `Σ(precio × cantidad)` de las líneas puede ser menor que `Venta.total`. No es una
anomalía nueva: el `deliveryFee` **siempre** produce esa diferencia, porque no es ningún producto.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `Venta.syncId` con un valor como `qab:<pedidoId>` | Ya es `String? @unique`, así que la guarda saldría gratis. Pero significa otra cosa —«id generado en el front para no repetir ventas por fallos de sincronización»— y no responde la pregunta 3: identificar el origen exigiría un `LIKE 'qab:%'`, que es analizar cadenas para recuperar una relación que se podría haber declarado. |
| Solo `MovimientoStock.referenciaId`, sin columnas nuevas | Es el precedente del proyecto, pero no tiene índice único: la idempotencia sería un «leer y luego escribir» con la carrera dentro. Y no responde la pregunta 3 sin recorrer movimientos desde una `Venta` que no los tiene. |
| Una columna `canal`/`origen` en `Venta` (enum `POS` \| `TIENDA_ONLINE`) | Responde la 3 y nada más: no dice **de qué** pedido, y no aporta ninguna guarda. Habría que añadir igualmente el `pedidoEntranteId`, y entonces la columna de canal sería un segundo hecho derivable del primero — dos banderas para una misma afirmación. |
| `PedidoEntrante.ventaId` en vez de `Venta.pedidoEntranteId` | La misma relación al revés, pero los reportes leen `Venta` y tendrían que volver a `PedidoEntrante` para saber el origen de cada fila. La columna vive donde la pregunta se hace. |
| FK compuesta `(pedidoEntranteId, negocioId)` en `Venta`, como hizo el ADR 0007 con las líneas | `Venta` no tiene `negocioId` —llega a él por `tiendaId`—, así que la FK compuesta no está disponible sin desnormalizar el negocio dentro de `Venta`. El aislamiento se sostiene en el camino de escritura: la `Venta` se crea con la `tiendaId` **dueña del pedido**, ya validada por la puerta de F-011. |
| Una columna `stockReserved Boolean @default(false)` en vez del `DateTime?` | Mismo mecanismo y un dato menos. El instante en que se comprometió el inventario es justo lo que hace falta para el reporte de reservas abiertas que la pregunta abierta 2 del spec anticipa, y no cuesta nada guardarlo ahora. |
| Un contador `reservationAttempts` o una tabla de idempotencia como la de `POST /api/venta/devolucion` | La tabla de idempotencia se apoya en una cabecera `Idempotency-Key` que el cliente genera. Aquí la clave natural ya existe y es el propio pedido: añadir un segundo mecanismo con su propia clave sería más superficie para el mismo invariante. |

## Consecuencias

**A favor:**

- El criterio 9 no depende de que nadie recuerde comprobar antes de escribir: las dos guardas son del
  motor de base de datos y valen igual para peticiones secuenciales y simultáneas.
- El criterio 10 sale del mismo mecanismo, sin una rama propia que probar por separado.
- El criterio 6 se responde con una columna que las consultas de reportes ya traen.
- `stockReservedAt` vuelve a `NULL` al liberar, así que un pedido cancelado y luego reconfirmado
  —secuencia que F-012 permite explícitamente— vuelve a reservar. El estado modela «tiene reserva
  viva», no «tuvo reserva alguna vez».

**En contra / coste asumido:**

- Una migración que añade dos columnas y un índice único. `Venta` es la tabla más grande del sistema:
  el índice se crea sobre una columna nueva, así que arranca vacía y su construcción no recorre datos
  existentes, pero el `ALTER TABLE` sigue tomando su candado.
- `stockReservedAt` es un hecho derivable —«¿hay movimientos de reserva vivos de este pedido?»— y aun
  así se guarda. Es desnormalización deliberada: la derivación no se puede reclamar atómicamente y
  ese reclamo es todo el punto.
- Un `P2002` sobre `Venta.pedidoEntranteId` hay que **capturarlo y tratarlo como éxito**, no dejarlo
  salir como 500. ~~Un `P2002` no capturado dentro de una transacción interactiva la aborta entera.~~
  **Esa frase era incorrecta y se corrige en la segunda enmienda, abajo: capturarlo no la salva.**
- La liberación depende de que los movimientos de reserva sigan ahí. Nada los borra hoy; si algún día
  se purgan movimientos antiguos, un pedido `CONFIRMED` de antes del corte quedaría irreversible.

**Impacto en seguridad y escalabilidad:**

- Los tres `where` del aterrizaje llevan `negocioId` (o la `tiendaId` dueña del pedido, ya resuelta
  por la puerta): el reclamo, la liberación y la lectura de `ProductoTienda`.

---

## Enmienda (2026-09-05, tras el paso 4b)

**La guarda ya no solo impide el segundo efecto: dice que lo impidió.**

El diseño de la pantalla levantó dos casos que este ADR resolvía correctamente y **narraba mal**:

1. Un `reservedProducts: 0` sale de dos causas que la pantalla no puede distinguir —el pedido ya
   estaba reservado (`claimed.count === 0`), o ninguna línea era reservable— y decir «0 productos»
   sin saber cuál es afirmar algo que no se observa (E-013).
2. **Dos mostradores entregando el mismo pedido a la vez.** El `@unique` garantiza una sola `Venta`
   y el `P2002` se trata como «ya vendido»: gana la primera declaración de forma de pago y la
   segunda se pierde. Sin una señal, la segunda persona ve un aviso de éxito idéntico al de la
   primera y cree que su declaración quedó registrada. Ese cobro puede haber sido por otra vía.

Por eso `IOrderLandingOutcome` y `tiendaOnlineOrderLandingSchema` ganan un campo:

```ts
/**
 * FALSE when THIS call produced the effect. TRUE when it found it already done:
 * the reservation claim matched no row, the release matched no row, or the sale
 * hit the unique index. Always FALSE for the NONE effect, which lands nothing.
 */
alreadyLanded: boolean;
```

No cambia ninguna guarda ni ningún invariante: los dos mecanismos siguen siendo el `@unique` y el
`updateMany` condicional. Lo único que cambia es que **el resultado de la carrera es observable**, en
vez de deducible. La pantalla usa `alreadyLanded: true` con `effect: "SELL"` para decir que la venta
ya estaba registrada por otra persona, y para no imprimir un recuento que no significa nada.

**El flag no es informativo en las tres ramas, y no se debe leer como si lo fuera.** En `RESERVE` y
en `SELL` distingue una causa de la otra y por eso hay algo que decir. En `RELEASE`, en cambio,
`alreadyLanded: true` sale de un único hecho —el reclamo de liberación no encontró fila— que tiene
**dos** causas indistinguibles: el pedido ya se había liberado, o nunca llegó a reservar (el criterio
10). Afirmar cualquiera de las dos sería inventarse lo que no se observa (E-013), así que ahí el
valor existe para el registro y **no se traduce a una frase**. El paso 4b lo resolvió así y es
correcto.

El coste es un booleano en la respuesta y dos frases de copy, que el `ui-designer` redacta.

- La búsqueda de las reservas vivas de un pedido es
  `{ tiendaId, tipo: "PEDIDO_ONLINE_RESERVA", referenciaId: pedidoId }`. `MovimientoStock` ya tiene
  índice por `tiendaId`; `referenciaId` no está indexada, así que **es un filtro dentro del subárbol
  de la tienda, no una búsqueda global**. Si el volumen de movimientos por tienda llegara a hacerlo
  caro, el índice a añadir es `(tiendaId, referenciaId)` — no se añade ahora porque medirlo sobre una
  tabla sin las filas del caso da una conclusión falsa en las dos direcciones (E-023).

---

## Segunda enmienda (2026-09-05, tras la implementación)

**Un índice único usado como guarda de idempotencia no puede capturar su violación *dentro* de la
transacción que guarda.** Esta enmienda corrige una frase de las consecuencias de arriba que decía lo
contrario por implicación, y con ella el paso 5 del § 5 del contrato de interfaces.

### Lo que este ADR dio por hecho, y es falso

«Un `P2002` no capturado dentro de una transacción interactiva la aborta entera» se lee como que
capturarlo la salva. **No la salva.** En PostgreSQL, cualquier violación de restricción deja la
transacción **en estado abortado**: a partir de ahí todo comando —incluido el `COMMIT`— falla con
`current transaction is aborted, commands ignored until end of transaction block`. La transacción
interactiva de Prisma corre sobre **una sola conexión**, así que un `catch` de JavaScript atrapa el
error pero no revierte ese estado del servidor. El `findFirst` que iba a recuperar el `ventaId`
existente fallaría, y con él la escritura del `status` que ya se había hecho.

Escribirlo así no era un descuido de detalle: era **la única pieza del mecanismo que este ADR no
verificó contra el motor**, y precisamente la que sostenía el criterio 9.

### La regla, que no es de este feature

Vale para cualquier `@unique` usado como guarda de idempotencia dentro de un `$transaction`, y va a
reaparecer:

> **La restricción única sigue siendo la autoridad; lo que no puede vivir dentro de la transacción es
> la recuperación.** El patrón correcto tiene dos mitades y hacen falta las dos:
>
> 1. **Una lectura antes de insertar, dentro de la transacción.** Resuelve el caso corriente —el
>    reintento secuencial, el doble clic ya confirmado— sin llegar a violar nada, y es lo que hace
>    que el resultado sea observable (`alreadyLanded`) en vez de deducible.
> 2. **El `catch` del `P2002` fuera del `$transaction`, con un reintento acotado.** Es para la
>    carrera de verdad: dos transacciones que pasan la lectura a la vez. La segunda revienta, su
>    transacción entera se descarta —no había commiteado nada— y el reintento vuelve a entrar, esta
>    vez encontrando la fila en la lectura del punto 1.
>
> La lectura sola no basta (tiene la carrera dentro). El índice solo tampoco (no deja recuperar el
> dato). **Ninguna de las dos mitades es redundante.**

El reintento es **uno y acotado**. No es una escalera de reintentos: el único fallo que puede resolver
es «alguien ganó la carrera», y eso se resuelve a la primera o no era eso.

### Qué cambia y qué no

**No cambia ninguna garantía.** Sigue habiendo como mucho una `Venta` por pedido, la sigue
garantizando el `@unique`, y el resultado observable —`alreadyLanded: true` con el `ventaId`
existente— es idéntico. Lo único que se mueve es **dónde vive el `catch`**.

**Coste asumido:** en el caso raro de la carrera real, la transacción se ejecuta dos veces. La primera
pasada no deja nada escrito (se descarta entera), así que el reintento no es un efecto duplicado, es
trabajo repetido. Y el `claim` de `stockReservedAt` no interviene aquí: la venta no lo toca.
