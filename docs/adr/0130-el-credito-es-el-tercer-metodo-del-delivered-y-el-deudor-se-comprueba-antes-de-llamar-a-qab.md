# ADR 0130: El crédito es el tercer método del `DELIVERED`, y el deudor se comprueba —por negocio— **antes** de llamar a QAB

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-036
**Enmienda a:** [ADR 0073](0073-la-forma-de-pago-la-declara-el-encargado-al-entregar-y-lo-que-no-puede-aterrizar-se-rechaza-antes-de-llamar-a-qab.md)
**Reafirma:** [ADR 0071](0071-el-inventario-baja-al-confirmed-con-un-movimiento-propio-y-la-venta-del-delivered-no-vuelve-a-descontar.md) ·
[ADR 0072](0072-un-pedido-se-ata-a-su-venta-por-una-columna-unica-y-a-su-reserva-por-un-reclamo-en-el-propio-pedido.md)
**Se apoya en:** [ADR 0063](0063-qab-decide-primero-y-la-base-local-despues.md) ·
[ADR 0104](0104-el-credito-es-una-columna-no-una-linea-de-pago.md) ·
[ADR 0056](0056-acceder-por-sesion-y-gestionar-por-la-tienda-duena-del-pedido.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) ·
[E-043](../../.agents/errors/E-043-una-columna-unique-global-usada-para-idempotencia-es-un-eje-de-tenant.md)

> **Esto es una enmienda, no un reemplazo.** El ADR 0073 sigue vigente entero. Lo único que cambia
> es el número de métodos y el número de comprobaciones previas: donde decía dos, dice tres; donde
> decía tres, dice cuatro. Su frase **«un solo método para el importe completo»** sobrevive
> intacta, y este documento la cita como vigente.

## Contexto

El ADR 0073 cerró cómo se declara el cobro de un pedido de tienda online: al marcarlo `DELIVERED`,
el encargado dice si fue `EFECTIVO` o `TRANSFERENCIA`, y la `Venta` nace con esa gaveta declarada.
Asume, sin decirlo, que **el dinero está en la tienda en ese instante**.

Hay un caso corriente en el que no lo está: **el mensajero se lleva la mercancía y vuelve con el
dinero uno o dos días después**. Durante ese hueco no hay efectivo que contar ni transferencia que
señalar; hay una deuda. Con dos métodos, el encargado solo tiene tres salidas y las tres son malas:

- **Declarar efectivo y confiar en corregirlo.** Mete dinero inventado en la caja del período. El
  propio ADR 0073 rechazó el «valor por defecto documentado» con el argumento que también aplica
  aquí: un dato ausente es corregible, un dato falso ya está en los libros.
- **No marcar `DELIVERED` hasta que el mensajero vuelva.** El comprador no ve su pedido entregado
  cuando lo recibe, y el inventario dice que la mercancía sigue en la tienda cuando ya no está.
- **Entregar y no registrar la venta.** La existencia baja en `CONFIRMED` (ADR 0071) y nunca aparece
  la venta que la explica.

Entretanto, el epic de cuentas por cobrar (F-029 … F-037) construyó exactamente el vocabulario que
falta: `Venta.creditoBase`, `Venta.clienteId`, `CuentaPorCobrar`, y un motor de cierre que ya sabe
leerlos. **«El dinero no está cuando sale la mercancía» es literalmente la definición de una cuenta
por cobrar**, y F-032 ya resolvió cómo se crea la deuda en la misma transacción que la venta, para
la ruta del POS.

Queda una restricción que no es evidente y que decide la parte delicada de este ADR. El ADR 0073
puso tres comprobaciones locales **antes** de llamar a QAB —`NO_OPEN_PERIOD`,
`UNKNOWN_TRANSFER_DESTINATION`, `MISSING_EXCHANGE_RATE`— porque el ADR 0063 manda llamar a QAB
primero y escribir después: lo que se descubra tarde deja al comprador viendo `DELIVERED` sin que
cuadrecaja pueda escribirlo. Un `clienteId` que no sirve es exactamente de esa familia, y **ahora
son cuatro**.

Y esa cuarta comprobación tiene una trampa que no la tiene ninguna de las tres anteriores: la que
está justo encima, `UNKNOWN_TRANSFER_DESTINATION`, filtra el destino por **`tiendaId`**, porque
`TransferDestinations` cuelga de la tienda (`@@unique([nombre, tiendaId])`). **`Cliente` cuelga del
negocio** (`@@unique([nombre, negocioId])`). Copiar el filtro del vecino —lo más natural del mundo
al escribir el bloque de al lado— rechazaría a todos los clientes legítimos y dejaría de discriminar
el caso para el que la guarda existe. Es la clase de fallo que `AGENTS.md` llama el más grave
posible en este sistema.

## Decisión

**`CREDITO` es el tercer método del `pago` que el encargado declara al marcar `DELIVERED`. Elige un
deudor en vez de una cantidad; la `Venta` nace igual que hoy, con `totalcash` y `totaltransfer` en
cero y su importe completo en `Venta.creditoBase`, y su `CuentaPorCobrar` se crea en la misma
transacción. Que ese deudor exista y sea del NEGOCIO es la cuarta comprobación previa a llamar a
QAB.**

En detalle:

### 1. Un método más, y la frase del 0073 se queda

`CREDITO` es **un método para el importe completo**, igual que los otros dos. No hay pago partido en
pedidos online: ni mitad efectivo y mitad crédito, ni un anticipo. El POS sí soporta crédito parcial
(F-032) porque allí el cajero tiene el dinero delante y lo cuenta; aquí el encargado registra un
cobro que ocurrió —o no ocurrió— en otro sitio, y ningún criterio de F-036 ejercita una rama mixta.
Una rama que nadie prueba es una rama que nadie prueba (**E-032**). El día que haga falta,
`pagosDetalle` sigue siendo un array y `creditoBase` una columna, y los dos admiten la mezcla sin
tocar la base.

### 2. El crédito no es una línea de pago, y por eso la caja no se mueve

La rama de `CREDITO` de `buildOnlineSaleAmounts` devuelve `totalcash: 0`, `totaltransfer: 0`,
`pagosDetalle: []` y el mismo `total` que las otras dos, con el mismo `convertToBase`.

`buildResumenMonedas` arma la caja recorriendo `pagosDetalle`, y **no mira `Venta.totalcash` en
ningún momento**. Como aquí no hay ninguna línea que recorrer, la caja del período **no se mueve sin
que nadie toque el motor de caja**. No es una casualidad afortunada: es el ADR 0104 —el crédito
viaja en una columna propia, nunca como una línea de `pagosDetalle`— aplicado a esta ruta. Quien «arregle» esto metiendo el crédito dentro de `pagosDetalle` rompe el cuadre de caja
del producto entero.

Las dos columnas informativas de `CuentaPorCobrar` —`monedaDeudaCode` y
`montoDeudaMonedaOriginal`— se escriben aquí **por primera vez en el proyecto**, que es lo que su
propio comentario en `prisma/schema.prisma` anticipaba: un pedido online puede venir denominado en
una moneda que no es la base, y poder decirle al cliente «debes 20 USD» es justo para lo que se
reservaron. **Ninguna aritmética las lee**: la deuda se denomina en moneda base (ADR 0104), y esa
decisión no se relitiga aquí.

### 3. La cuarta comprobación, y su filtro

Cuando el destino es `DELIVERED` y el método es `CREDITO`, y **antes** de
`reportTiendaOnlineOrderStatus`, `findOrderLandingBlocker` comprueba que el `clienteId` declarado
resuelve a un `Cliente` **del negocio de la sesión**, y responde `409 PEDIDO_NOT_LANDABLE` con el
motivo `UNKNOWN_CLIENTE` si no. Nada se llama y nada se escribe.

Tres precisiones, y las tres importan:

- **Por negocio, nunca por tienda.** El `where` se construye con `withTenantScope("cliente", { id },
  negocioId)`, que es la definición única del camino del tenant en este proyecto
  (`TENANT_RELATION_PATH.cliente` es `[]`, la columna está en el propio modelo). No se escribe el
  filtro a mano: el helper sigue siendo correcto si el modelo se reencadena, y una copia a mano se
  queda vieja en silencio. El filtro entra **como valor de un `where`**, que es la comprobación que
  **E-043** pide y que no se satisface mencionando `negocioId` en una guarda de al lado.
- **`negocioId` sale de la sesión.** `session.user.negocio.id`, en el paso 1 de la ruta, es la
  única fuente. El cuerpo del `PATCH` no lo lleva y no podría llevarlo: el schema es `.strict()`.
- **Ni más ancha ni más estrecha que «existe y es del negocio»** (**E-032**). Ni aceptar cualquier
  UUID sin consultar; ni exigir `deletedAt: null`, porque un cliente borrado en blando sigue
  respondiendo por una deuda y perder la deuda es peor que mostrar un nombre borrado — el mismo
  criterio que `resolveCreditCustomer` ya tomó en el POS.

### 4. El schema pasa de un xor a una tabla

El `superRefine` de `pedidoEntrantePagoSchema` era un xor de dos ramas: «necesita destino» debía ser
lo contrario de «no viene destino». Con un tercer método esa condición **se cumple por casualidad**
para `CREDITO` sin destino, y no sabe absolutamente nada del campo `clienteId`.

Se sustituye por **una tabla que declara, por método, qué campo extra exige y cuál prohíbe**
(`TIENDA_ONLINE_PAYMENT_METHOD_FIELDS`), y un `superRefine` que la recorre. La tabla es la
definición única de las nueve combinaciones —el schema la lee, la pantalla la obedece, la suite la
prueba— y su tipo `Record<…>` hace que **un cuarto método no compile hasta que se decida su fila**.
Las dos combinaciones que un `superRefine` reescrito como «exige uno u otro» dejaría pasar
—`TRANSFERENCIA` con cliente, `CREDITO` con destino— son justo las que la tabla cierra: el campo
prohibido está presente, y eso basta.

### 5. Lo que **no** cambia

- **La `Venta` sigue naciendo en `DELIVERED`**, y no descuenta stock: la mercancía salió en
  `CONFIRMED` con su `PEDIDO_ONLINE_RESERVA`. **El ADR 0071 se reafirma sin una coma de cambio.**
  La tabla de efectos de aquel ADR sigue siendo limpia: cada transición hace exactamente una cosa.
- **La idempotencia sigue siendo la de siempre**: el `@unique` de `Venta.pedidoEntranteId` y el
  reclamo condicional de `stockReservedAt`. **El ADR 0072 se reafirma**, y `CREDITO` **no estrena
  ningún segundo mecanismo**: la `CuentaPorCobrar` se crea solo en la rama que crea la `Venta`, así
  que un segundo `DELIVERED` sobre el mismo pedido no llega a abrir una segunda deuda.
- **`pago` sigue siendo obligatorio si y solo si el destino es `DELIVERED`**, y prohibido en los
  otros cinco. Es la regla del ADR 0073, ajena al número de métodos.
- **`offerOrderStatusTransitions` no se toca.** No conoce la forma de pago, así que un `DELIVERED`
  —a crédito o no— sigue siendo terminal por la misma regla de siempre. Que no haya que tocarla es
  la señal de que esta decisión va a favor del diseño.
- **Ni un permiso nuevo, ni una ruta nueva, ni un código de error nuevo.**
  `tiendaonline.pedidos.gestionar`, evaluado contra la tienda dueña del pedido (ADR 0056), sigue
  siendo el que autoriza mover el estado; elegir `CREDITO` es un **atributo** de ese movimiento, no
  una operación aparte, igual que hoy elegir `TRANSFERENCIA` no necesita un permiso distinto de
  `EFECTIVO`. El 409 usa el `PEDIDO_NOT_LANDABLE` que ya existe, con un motivo más en su enum.
- **Nada de esto viaja a queandabuscando.** `postQabOrderStatus` recibe el estado y el id del
  pedido, y nunca el `pago`: la forma de cobro es un dato local, como estableció el ADR 0073. El
  contrato con QAB no cambia por este feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Crear la `Venta` al despachar al mensajero (`IN_TRANSIT`) en vez de esperar a `DELIVERED`.** Fue la petición inicial del humano, que eligió esta opción tras ver el análisis. | Tres razones, y la primera es la cara. **(1) Deshacer una venta aquí no es borrarla.** El precedente del repositorio es `DevolucionVentaDialog` y el flujo `DEVOLUCION_VENTA`, que deliberadamente descuenta del período **actual**. Crear la venta en `IN_TRANSIT` no hereda un *undo*: hereda **una segunda entrada automática al motor de devoluciones**, disparada por un cambio de estado, potencialmente a caballo entre dos períodos y con el de origen ya cerrado. Es lo más caro de todo el epic. **(2) Los dos mecanismos de stock se solaparían.** La mercancía ya sale en `CONFIRMED` con `PEDIDO_ONLINE_RESERVA` y vuelve en `CANCELLED` con `PEDIDO_ONLINE_LIBERACION`. Con una venta creada en `IN_TRANSIT`, cancelar tendría que liberar la reserva **y** compensar una venta que ya contabilizó esa misma salida. **(3) El crédito ya cubre la necesidad**, sin mover el momento de creación: el encargado marca `DELIVERED` al salir la mercancía con `pago.metodo = CREDITO`, y la deuda cubre el hueco hasta que el mensajero vuelve. Y como señal de diseño: bajo esa alternativa habría que meterle a `offerOrderStatusTransitions` la noción de «esta transición crea una venta» y «esta la revierte», que es justo lo que su docstring prohíbe re-derivar fuera. |
| Un cuarto estado local, entre `IN_TRANSIT` y `DELIVERED`, solo en cuadrecaja | Un estado que QAB no conoce es una divergencia permanente por diseño, y el ADR 0022 ya cerró que este POS no espeja ni inventa estados del otro lado. La bandeja mostraría un valor que la página del comprador nunca puede mostrar. |
| Ampliar `pagoLineaSchema.tipo` con un tercer valor `credit` en vez de usar `Venta.creditoBase` | Es el ADR 0104, y no se reabre aquí: `buildResumenMonedas` y `buildResumenPropinas` suman `equivalenteBase` **fuera** del `if`, así que un tercer valor entraría como transferencia *y* como equivalente base, y el cuadre de caja mentiría por el monto exacto del crédito. Además el crédito no tiene moneda física y contaminaría el desglose por moneda del ticket y del cierre. |
| Comprobar el `clienteId` **después** de llamar a QAB, y responder `persisted: false` | Es la forma que el ADR 0063 tiene para lo imprevisible, no para lo que se puede saber antes. El comprador vería `DELIVERED` y el pedido quedaría bloqueado en cuadrecaja sin salida por la UI. Es exactamente el argumento con el que el ADR 0073 puso sus tres comprobaciones donde están. |
| Filtrar el `Cliente` por `tiendaId`, como el bloqueo de transferencia de al lado | `TransferDestinations` es por tienda; `Cliente` es del negocio. Rechazaría a **todos** los clientes legítimos —incluidos los de la propia tienda, porque la columna ni siquiera existe— y dejaría de discriminar el caso para el que la guarda existe. Es el error fácil de este feature y por eso tiene un criterio de aceptación propio que lo verifica **ejecutando**. |
| Confiar en la clave foránea de `CuentaPorCobrar.clienteId` en lugar de comprobar el tenant | Una FK garantiza que la fila existe; **no** garantiza de qué negocio es. Un `clienteId` de otro negocio pasaría la FK sin una queja y abriría la deuda en el sitio equivocado. |
| Permitir crédito parcial en pedidos online, como en el POS | Ningún criterio lo ejercita y la rama de más no se prueba (**E-032**). La forma del dato ya lo admite el día que haga falta: `creditoBase` es una columna y `pagosDetalle` un array. |
| Un permiso nuevo, del estilo `tiendaonline.pedidos.credito` | Elegir cómo se cobró no es una operación distinta de mover el estado. Es la misma decisión que el ADR 0073 tomó para la transferencia, la que el ADR 0070 tomó para el SSO y la que el ADR 0112 tomó para vender a crédito en el POS: el módulo cerró con cuatro permisos y no se añade un quinto. |

## Consecuencias

**A favor:**

- El caso del mensajero deja de obligar a mentir. La mercancía sale, la venta se registra, la
  ganancia se devenga, y el dinero que falta **está contado como lo que es**: una cuenta por cobrar
  con su deudor y su antigüedad.
- La caja del período **no se mueve** por un pedido entregado a crédito, y no hubo que tocar el
  motor de caja para conseguirlo. Cuando el mensajero vuelva, el abono entrará a la caja del período
  en que se cobre, que puede ser otro — y ese comportamiento ya existía, de F-033.
- El aterrizaje sigue siendo **imposible de dejar a medias** por una causa local conocida: ahora son
  cuatro las que se descubren antes de comprometer al comprador con un estado que este POS no podría
  escribir.
- Cero rutas nuevas, cero permisos nuevos, cero códigos de error nuevos, cero migraciones. La ruta
  del `PATCH` no cambia ni una línea: el tercer método entra por los dos puntos de extensión que el
  ADR 0073 ya había dejado abiertos, que es la mejor señal de que la decisión va con el diseño.

**En contra / coste asumido:**

- **Entre «sale el mensajero» y «el cliente recibe», el pedido figura `DELIVERED` en QAB y el
  comprador lo ve.** Es real y no se disimula: el encargado marca la entrega cuando la mercancía sale
  de la tienda, no cuando llega a la puerta del comprador. En la práctica es una ventana de horas y
  el comprador tiene el pedido en camino, pero un negocio puede considerarlo inaceptable.

  **Y la salida, si eso llegara a molestar, NO es mover la venta a `IN_TRANSIT`** —eso reabre las
  tres razones de la tabla de arriba—. Es **pedirle a queandabuscando un estado intermedio del tipo
  `HANDED_TO_COURIER`**, por la vía de `.agents/solicitudes-qab.md`: un cambio de contrato **fuera de
  este repositorio**, que la página del comprador tendría que saber pintar. Ese día, `CREDITO`
  seguiría siendo el método correcto; lo único que cambiaría es en qué transición se declara.
- La forma de pago sigue siendo **una declaración, no una observación**, y ahora también lo es la
  identidad del deudor. Si el encargado elige el cliente equivocado, la deuda nace en la ficha
  equivocada. Es el mismo grado de confianza que el POS ya deposita en el cajero, y es corregible
  desde el panel de cuentas por cobrar.
- Un `409 UNKNOWN_CLIENTE` es una pared para el encargado hasta que elija un cliente válido. Es
  deliberado, y es la misma pared que `UNKNOWN_TRANSFER_DESTINATION`: la alternativa era una deuda
  colgando de la ficha de otro negocio.
- El diálogo de entrega gana un tercer camino y un selector, así que vuelve a pasar por el
  `ui-designer`. El copy que decía «ninguno de los **dos** métodos» pasa a decir tres, en el
  docstring y en la pantalla.

**Impacto en seguridad y escalabilidad:**

- El `clienteId` es el único dato nuevo que cruza la frontera de confianza, y se acota **dos veces
  con el mismo helper**: en el paso 6, para rechazar antes de llamar a QAB, y dentro de la
  transacción, donde lo que se escribe es **el id que devolvió la consulta acotada** y no el que
  mandó el cuerpo. Dos llamadas al mismo `withTenantScope`, no dos definiciones del mismo filtro.
  La segunda es inalcanzable a través de la ruta hoy —el paso 6 ya rechazó ese caso— y existe para
  que un futuro segundo llamador de `landTiendaOnlineOrderStatus` no pueda abrir una deuda entre
  negocios; cuando salta, la transacción revierte entera, se escribe una línea de divergencia y la
  ruta responde `persisted: false`, que es la salida recuperable que el ADR 0063 diseñó.
- `CuentaPorCobrar.tiendaId` se deriva de la **misma variable** ya persistida como `Venta.tiendaId`,
  nunca de un parámetro de ruta ni del cuerpo: `TENANT_RELATION_PATH.cuentaPorCobrar` alcanza
  `negocioId` por esa columna y solo por esa, así que una fila nacida con otro `tiendaId` colgaría
  del negocio equivocado con un camino correcto.
- La comprobación nueva añade **una lectura corta y condicional**, solo cuando el destino es
  `DELIVERED` y el método es `CREDITO`, por clave primaria más una igualdad de columna. La misma
  forma que el bloqueo de destino de transferencia que el ADR 0073 ya aceptó. No hay N+1 nuevo: la
  transacción del `SELL` sigue leyendo en un solo `Promise.all`, ahora con una entrada más.
- La deuda es **una fila por venta**, con `ventaId @unique` y los índices que F-029 ya puso sobre
  `[tiendaId, settledAt]` y `[tiendaId, fechaVenta]`. Este feature **no** añade ninguna consulta que
  recorra el histórico de cuentas por cobrar: el panel que las agrega y el motor de cierre que las
  suma existen desde F-030 y F-033, y aquí solo se escribe.
