# ADR 0073: La forma de pago la declara el encargado al entregar, y lo que no puede aterrizar se rechaza **antes** de llamar a QAB

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-014

## Contexto

El criterio 4 pide generar la `Venta` **«con su forma de pago»**. Ese dato no existe en ninguna parte:

- **No está en el contrato de queandabuscando.** Verificado contra la v10.1: cero apariciones. Lo
  único parecido es `checkoutMode: "WHATSAPP" | "ONSITE"`, que es una propiedad **de la tienda** y
  dice cómo se arma la compra, no cómo se paga.
- **No está en `PedidoEntrante`**, porque no llegó nunca por el cable.

Y no es un olvido de nadie: el cobro de un pedido de tienda online ocurre **fuera de las dos
aplicaciones** —en efectivo contra entrega, por transferencia acordada por WhatsApp, lo que pactaran
las dos partes— y ninguno de los dos sistemas lo presencia.

`Venta`, en cambio, sí lo exige para ser una venta útil: `totalcash`, `totaltransfer`, `monedaCobro`,
`pagosDetalle` y, cuando hay transferencia, `transferDestinationId`. Sin eso, la venta entra al
`CierrePeriodo` sin decir de qué gaveta salió el dinero, y el cuadre de caja —que es el nombre del
producto— deja de cuadrar.

Hay además tres condiciones locales que pueden impedir el aterrizaje y que **no** dependen de QAB:

- La tienda del pedido puede no tener un `CierrePeriodo` abierto. `Venta.cierrePeriodoId` es
  nullable, pero `sales-stream.ts` filtra por `cierrePeriodo: { fechaInicio…, fechaFin… }`: una venta
  sin período es una venta que ningún reporte ve. Sería el criterio 4 incumplido en silencio.
- El `transferDestinationId` que declare el encargado puede no ser de esa tienda. `TransferDestinations`
  es por tienda (`@@unique([nombre, tiendaId])`).
- El negocio puede no tener tasa registrada para la moneda del pedido. `cupTasa`, en
  `src/lib/currency.ts`, devuelve **1** para una moneda desconocida, así que un pedido en una moneda
  sin tasa se convertiría en silencio como si valiera lo mismo que la base. El POS ya rechaza ese
  caso (`MISSING_EXCHANGE_RATE`); aquí no puede quedar por debajo. **Y «qué tasas necesita una
  venta» ya está definido una sola vez, en `missingRateCodes`: no se vuelve a decidir aquí.**

Y el orden importa, por el ADR 0063: la ruta llama a QAB **primero** y escribe la fila local
**después**. Si una de esas dos condiciones se descubre después de la llamada, el comprador ya ve
`DELIVERED` y cuadrecaja no puede escribirlo — divergencia permanente, sin salida por la UI.

## Decisión

**La forma de pago viaja en el cuerpo del `PATCH`, la elige el encargado en la bandeja al marcar
`DELIVERED`, y todo lo que impida aterrizar se comprueba antes de llamar a QAB.**

### El dato

El cuerpo de `PATCH /api/tienda-online/pedidos/[pedidoId]/status` gana un campo `pago`, **obligatorio
si y solo si** `status === "DELIVERED"`, y prohibido en los otros cinco destinos reportables. Un
cuerpo que incumpla eso sale por el `400 INVALID_BODY` que la ruta ya tiene: **ningún código de error
nuevo para esto**.

`pago` declara el método —`EFECTIVO` o `TRANSFERENCIA`— y, solo para transferencia, el destino. **Un
solo método para el importe completo**: no hay pago partido. El POS lo permite porque un cajero
tiene el dinero delante y lo cuenta; aquí el encargado está registrando un cobro que ya ocurrió en
otro sitio, y una rama de pago mixto que ningún criterio ejercita es una rama que nadie prueba
(E-032). El día que se necesite, `pagosDetalle` ya es un array y admite más de una línea sin cambiar
el esquema de la base.

Como el `PATCH` a `DELIVERED` deja de ser un botón y pasa a necesitar una elección, **este feature
añade UI y por tanto exige el paso del `ui-designer`** (`.agents/designs/F-014.md`) antes de que se
escriba el componente.

### La moneda y el importe

`Venta.total` se guarda en la moneda base del negocio, como cualquier otra venta. El pedido está
íntegramente denominado en `PedidoEntrante.currencyCode` (contrato v10.1: «`currencyCode`,
`lineTotal`, `subtotal`, `discountTotal`, `deliveryFee` y `total` están **todos** en la moneda del
pedido»). Cuando esa moneda no es la base, se convierte con **las tasas de cuadrecaja**
(`convertToBase` sobre `TasaCambio`), y el `tasaSnapshot` resultante se persiste en la `Venta` igual
que hace el POS.

**No con el `rateSnapshot` del pedido**: ese JSON son las tasas de queandabuscando y el ADR 0060 ya
dejó dicho que `src/lib/currency.ts` no le aplica. Mezclar dos tablas de tasas dentro de un mismo
número lo vuelve imposible de reconciliar contra el cierre.

Los precios de línea, en cambio, se copian **verbatim**: `VentaProducto.precio = linea.unitPrice`
con `monedaPrecioCode = pedido.currencyCode`. Es el mismo patrón de snapshot que ya usa el POS
—precio en su moneda, con su código, convertido por quien lee— y es lo que hace que el criterio 5
se verifique sin recalcular ningún importe del pedido (ADR 0062).

El criterio 5 se lee, entonces, así: **`Venta.total` es `PedidoEntrante.total` expresado en la moneda
base del negocio.** Cuando el pedido ya viene en moneda base —el caso corriente— la conversión es la
identidad y los dos números son iguales al céntimo.

### La guarda previa

Cuando el destino es `DELIVERED`, y **antes** de `reportTiendaOnlineOrderStatus`, la ruta comprueba
tres cosas locales y responde `409 PEDIDO_NOT_LANDABLE` con el motivo si alguna falla:

- `NO_OPEN_PERIOD` — la tienda dueña del pedido no tiene `CierrePeriodo` con `fechaFin: null`.
- `UNKNOWN_TRANSFER_DESTINATION` — el `transferDestinationId` declarado no es de esa tienda.
- `MISSING_EXCHANGE_RATE` — **`missingRateCodes` dice que falta alguna**, sobre el snapshot que
  devuelve `resolveSaleTasaSnapshot`. Corregido el 2026-09-05: la redacción original de este ADR
  decía «no hay tasa para `PedidoEntrante.currencyCode` y esa moneda no es la base», y esa paráfrasis
  bloqueaba dos casos legítimos —un pedido en `CUP` de un negocio con base `USD` (el ancla nunca
  tiene fila de `TasaCambio`) y cualquier pedido en la propia moneda base (que no necesita tasa
  alguna)—. `missingRateCodes` es la definición única del proyecto y ya resuelve el enrutado por
  `CUP`; describirla con otras palabras era E-014.

Nada se llama y nada se escribe. Esto **no reabre** lo que el spec excluyó: no toca el gate de
permisos ni la llamada a QAB, y no traduce ningún resultado del otro lado. Es una condición nuestra,
comprobada por nosotros, antes de comprometer al otro lado con algo que no vamos a poder cumplir.

El envío sin cotizar **no** entra en esta guarda. Ahí la protección ya la da el contrato: QAB responde
`409 ORDER_DELIVERY_NOT_QUOTED` a `DELIVERED` mientras `deliveryFeePending` sea `true`, y F-012 solo
escribe la fila local si QAB aceptó. Repetir esa comprobación aquí sería una segunda copia
parafraseada de una regla del otro lado, que se queda vieja cuando la original cambie (E-014).

### El usuario de la venta

`Venta.usuarioId` es obligatorio y se toma de **la sesión que ejecuta el `PATCH`**, nunca del cuerpo
—exactamente como `CreateMoviento` fuerza el suyo—. Es quien está entregando el pedido, y es quien
aparecerá en el reporte de vendedores.

### El permiso

Ninguno nuevo. `tiendaonline.pedidos.gestionar`, evaluado contra la tienda dueña del pedido (ADR
0056), es el que ya autoriza mover el estado, y aterrizarlo es el efecto de moverlo, no una operación
aparte. Es la misma decisión que tomó el ADR 0070 para el SSO: el módulo cerró con cuatro permisos y
no se añade un quinto.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Derivar la forma de pago de `checkoutMode` de la tienda | Es débil hasta ser falso: `ONSITE` no distingue efectivo de transferencia, y `WHATSAPP` no dice absolutamente nada sobre el cobro. Sería inventar un dato y presentarlo como registrado. |
| Pedírselo a queandabuscando | Dejaría el feature bloqueado a la espera de otro equipo, para un hecho que **ninguno de los dos sistemas presencia**: el cobro ocurre fuera de ambos. Aunque QAB añadiera el campo, seguiría siendo una declaración de alguien, no un dato observado. |
| Un valor por defecto documentado (todo a efectivo) sin preguntar | Es lo más barato de construir y lo peor de arreglar: mete dinero inventado en el cuadre de caja, y quien lo descubra tendrá que reconstruir a mano cómo se cobró cada pedido. Un dato ausente es corregible; un dato falso ya está en los libros. |
| Un endpoint aparte, `POST .../entregar`, en vez de un campo en el `PATCH` | Dos puertas hacia `DELIVERED`, con dos gates que mantener sincronizados, y una de ellas capaz de escribir el estado sin pasar por QAB. El spec es explícito: el `PATCH` de F-012 es el único punto de entrada. |
| Permitir el pago partido (varias líneas en `pagosDetalle`) desde ya | Ningún criterio lo ejercita, y la rama de más no se prueba (E-032). La forma del dato ya lo admite el día que haga falta. |
| Crear la `Venta` con `cierrePeriodoId: null` cuando no hay período abierto | Los reportes filtran por el período: la venta existiría y sería invisible. El criterio 4 quedaría incumplido en silencio, que es peor que un 409 explicando qué falta. |
| Abrir un `CierrePeriodo` automáticamente si no hay ninguno | Abrir el período es una decisión del negocio con consecuencias sobre el arqueo, y tomarla como efecto lateral de entregar un pedido online es exactamente el tipo de magia que nadie espera al pulsar un botón. |
| Comprobar las condiciones locales **después** de llamar a QAB y responder `persisted: false` | Es la forma que ADR 0063 tiene para lo imprevisible, no para lo que se puede saber antes. El comprador vería `DELIVERED` y el pedido quedaría bloqueado en cuadrecaja sin salida por la UI. |

## Consecuencias

**A favor:**

- El cuadre de caja sigue cuadrando: cada peso de un pedido online entra al cierre con su gaveta
  declarada por la persona que la abrió.
- La guarda previa hace **imposible** el estado «QAB entregado, cuadrecaja sin venta» por las tres
  causas locales conocidas. Las demás siguen saliendo por el `persisted: false` de siempre.
- Ni un código de error nuevo para el cuerpo, ni un permiso nuevo, ni una ruta nueva.

**En contra / coste asumido:**

- F-014 deja de ser un feature sin pantalla: marcar `DELIVERED` pasa de un botón a una elección, y eso
  arrastra el paso del `ui-designer`, más trabajo del `implementer` en la bandeja de F-011.
- La forma de pago es **una declaración, no una observación**. Si el encargado se equivoca, el cierre
  se equivoca con él. Es el mismo grado de confianza que el POS ya deposita en el cajero.
- Un `409 PEDIDO_NOT_LANDABLE` con motivo `NO_OPEN_PERIOD` es una pared para el encargado hasta que
  alguien abra el período. Es deliberado: la alternativa era una venta invisible.
- El criterio 5 solo se puede verificar de punta a punta contra una renegociación cuando exista F-013.
  Hasta entonces se siembra un `PedidoEntrante` con los importes ya actualizados, como acordó el
  spec. Nada de este ADR depende de F-013.

**Impacto en seguridad y escalabilidad:**

- El `transferDestinationId` se valida contra la **tienda dueña del pedido**, no contra el negocio:
  un destino de otra tienda del mismo negocio se rechaza igual que uno de otro negocio. La consulta
  lleva `tiendaId` y sale por índice.
- La guarda previa añade, como mucho, dos lecturas cortas y solo en el destino `DELIVERED`. La del
  `CierrePeriodo` es la misma que el POS ya hace (`findFirst({ where: { tiendaId, fechaFin: null } })`).
- El cuerpo del `PATCH` sigue siendo `.strict()`: un campo que nadie declaró no entra, y `pago` no
  puede colarse en un destino que no sea `DELIVERED`.
