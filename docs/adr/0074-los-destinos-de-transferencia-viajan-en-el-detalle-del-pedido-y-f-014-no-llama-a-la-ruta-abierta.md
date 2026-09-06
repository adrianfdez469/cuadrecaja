# ADR 0074: Los destinos de transferencia viajan en el detalle del pedido, y F-014 no llama a la ruta abierta

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-014

## Contexto

El diálogo de entrega que diseñó el paso 4b necesita la lista de destinos de transferencia del local
dueño del pedido, para que el encargado elija uno cuando declara que el cobro fue por transferencia
(ADR 0073).

Lo que existe es `GET /api/transfer-destinations?tiendaId=…`
(`src/app/api/transfer-destinations/route.ts`), y **está abierto**:

```ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tiendaId = searchParams.get('tiendaId');
  // ...
  const transferDestinations = await prisma.transferDestinations.findMany({
    orderBy: { nombre: 'asc' },
    where: { tiendaId: tiendaId },
  });
```

El archivo importa `getSession` y `verificarPermisoUsuario` y **el `GET` no llama a ninguno de los
dos**. No hay `negocioId` en el `where`. El `POST` de veinte líneas más abajo, en el mismo archivo,
sí verifica sesión, permiso y que la tienda pertenezca al negocio del usuario — así que es un olvido,
no una decisión de diseño.

Consecuencia: cualquier sesión autenticada puede leer los destinos de cobro de cualquier tienda de
cualquier negocio con solo pasar su uuid. `TransferDestinations` guarda `nombre` y `descripcion`, que
es exactamente donde se apuntan las cuentas de cobro.

**Ese agujero es preexistente y F-014 no lo abre.** Pero F-014 **sí sería su primer llamador con un
`tiendaId` que no es el de la sesión**: hasta hoy, quien pide destinos pide los de la tienda en la
que está trabajando; el diálogo de entrega pediría los de la tienda **dueña del pedido**, que puede
ser cualquiera del negocio. Eso convierte una fuga latente en una superficie usada.

Y hay una consecuencia práctica que no es teórica: el día que alguien cierre ese `GET` como está
cerrado el `POST`, exigirá `configuracion.destinostransferencia.acceder`. Un encargado con
`tiendaonline.pedidos.gestionar` y sin ese permiso de configuración —el reparto normal de un
vendedor— **dejaría de poder entregar un pedido por transferencia**. F-014 se rompería por un arreglo
correcto de otra ruta.

## Decisión

**Los destinos de transferencia del local dueño del pedido viajan en la respuesta de
`GET /api/tienda-online/pedidos/[pedidoId]`, y F-014 no llama a `GET /api/transfer-destinations`.**

`tiendaOnlineOrderDetailSchema` gana una clave **hermana** de `order` —no dentro de él: no son datos
del pedido, son configuración de la tienda— con una proyección **mínima**:

```ts
export const tiendaOnlineTransferDestinationSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    /** The store's default destination, preselected by the dialog. */
    default: z.boolean(),
  })
  .strict();
```

**`descripcion` NO se expone.** Es el campo donde se escriben los números de cuenta, y el diálogo
solo necesita nombrar el destino y preseleccionar uno. Una proyección que no lo lleva no lo puede
filtrar.

La ruta del detalle ya pasa por la puerta de ADR 0056 —`.acceder`, el ámbito de la sesión y la
tienda **dueña del pedido**— y el `where` lleva `tiendaId`, que esa puerta ya validó contra el
`negocioId` de la sesión. Los destinos de ese local son exactamente tan sensibles como el pedido que
los acompaña, y quedan detrás de la misma puerta.

**El agujero de `GET /api/transfer-destinations` no se arregla aquí.** Está fuera del alcance de
F-014 y le corresponde al `security-guardian` si el humano lo prioriza. Esta decisión lo deja *sin
un llamador nuevo*, que es lo único que F-014 puede hacer al respecto sin salirse de su mandato.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Llamar a `GET /api/transfer-destinations?tiendaId=…` tal como está | Añade el primer llamador que cruza de tienda a una ruta sin sesión, sin permiso y sin `negocioId`. Convierte una fuga latente en una superficie usada, y ata F-014 a que esa ruta **siga** rota. |
| Llamarla y arreglarla de paso, dentro de F-014 | El spec excluye tocar rutas ajenas al `PATCH`, y el arreglo correcto —sesión, permiso, `negocioId`— cambia el contrato de una ruta que hoy consumen el POS y la configuración. Un cambio así se decide midiendo a sus llamadores actuales, no de refilón dentro de otro feature. |
| Una ruta nueva, `GET /api/tienda-online/pedidos/[pedidoId]/destinos` | Una segunda puerta que mantener sincronizada con la del detalle, para un dato que la pantalla ya necesita en el mismo instante en que carga el detalle. Sería una petición de más y un gate de más. |
| Meter los destinos dentro de `order` | No son del pedido. `tiendaOnlineOrderSchema` describe lo que llegó de queandabuscando más lo que cuadrecaja resolvió **sobre ese pedido**; la configuración de cobro del local es otra cosa y mezclarla haría que un lector del pedido creyera que el dato viene del otro lado. |
| Llevarlos también en el **listado** de pedidos | El listado es multitienda y paginado: serían N configuraciones repetidas por página para un diálogo que solo se abre en el detalle. El diseño 4b sitúa `PedidoEntregaDialog` en el detalle, no en el listado. |
| Exponer `descripcion` «por si el encargado necesita ver la cuenta» | Ningún criterio lo pide, y es el campo con más probabilidad de contener un número de cuenta. El diálogo elige un destino por su nombre; ver la cuenta es trabajo de la pantalla de configuración, que ya tiene su permiso. |

## Consecuencias

**A favor:**

- F-014 no depende de una ruta rota, así que arreglarla más adelante no rompe F-014.
- Una petición menos en el camino crítico del diálogo. Eso elimina de raíz los estados «cargando
  destinos» y «falló la carga» que el diseño 4b tuvo que narrar con frases para no usar un girador:
  cuando el diálogo abre, la lista ya está.
- La proyección mínima reduce lo que la ruta del detalle puede filtrar aunque su puerta fallara algún
  día: sin `descripcion`, no hay número de cuenta que se escape.

**En contra / coste asumido:**

- **El diseño 4b hay que corregirlo.** Sus dos estados de carga de destinos (§3.5) y sus dos frases
  —`Buscando los destinos de transferencia de este local…` y `No se pudieron cargar los destinos de
  transferencia de este local…`— quedan sin caso posible. Vuelve al `ui-designer` como una
  eliminación, no como un rediseño. Un contrato que describe un estado inalcanzable es E-030
  esperando a pasar.
- La lista queda **congelada al cargar el detalle**. Si alguien crea un destino en otra pestaña, hay
  que recargar el detalle para verlo. Es el mismo comportamiento que el listado de pedidos ya tiene
  (F-012 §2) y no lo empeora.
- La respuesta del detalle crece. Son tres campos por destino y un local tiene un puñado: irrelevante
  frente al pedido con sus líneas.
- El agujero de `GET /api/transfer-destinations` **sigue abierto**. Esta decisión no lo cierra y no
  finge cerrarlo; solo evita darle un llamador más.

**Impacto en seguridad y escalabilidad:**

- La consulta es `{ tiendaId }` sobre el índice `@@index([tiendaId])` que el modelo ya tiene, con
  `orderBy: { nombre: "asc" }`. **Es forzosamente secuencial y no paralela** —corregido el
  2026-09-05: su `tiendaId` sale de la fila del pedido, así que no puede salir antes que ella—. Un
  viaje más, de coste constante.
- **Vive en `getTiendaOnlineOrderDetail`, no en la ruta.** Es donde está la fila que produce el
  `tiendaId`, y así la regla de aislamiento —«el `tiendaId` sale de la fila, nunca de la query»—
  tiene un solo hogar en vez de repetirse en el llamador. Además evita que la función devuelva un
  `Omit<ITiendaOnlineOrderDetail, "transferDestinations">`: una firma pública que anuncia que
  devuelve una versión incompleta de un tipo con nombre es una costura que el siguiente llamador
  hereda sin saber por qué.
- El `tiendaId` **nunca** sale del cliente: es el de la fila del pedido, resuelto por la misma puerta
  que decidió si esa persona puede ver el pedido.
- Un `transferDestinationId` que el cliente declare en el `PATCH` **se sigue validando en el
  servidor** contra la tienda dueña del pedido (ADR 0073, `UNKNOWN_TRANSFER_DESTINATION`). Que la
  lista venga del servidor no es la autorización: es la comodidad. La autorización es la guarda.
