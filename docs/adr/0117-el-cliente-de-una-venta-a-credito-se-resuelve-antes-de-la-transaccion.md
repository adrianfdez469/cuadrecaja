# ADR 0117: El cliente de una venta a crédito se resuelve antes de la transacción, y el cliente nuevo nace dentro de ella

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-034 (vender a crédito en el POS)

> Este ADR cierra las **tres preguntas abiertas** del spec de F-034 que tocan al servidor: el orden
> entre resolver el cliente y comprobar la invariante, qué pasa en una carrera real de alta offline,
> y qué se hace con `checkCreditInvariant` en una venta al contado.
>
> El contrato de interfaces de F-034 (`.agents/specs/F-034.md`, § 5) traduce esta decisión a firmas
> concretas. En caso de contradicción entre los dos documentos, **gana este**.

## Contexto

El POS tiene que poder vender a crédito **sin conexión, nombrando a un cliente que todavía no
existe** (decisión de producto 6 del dosier del epic, `.agents/cuentas-por-cobrar.md` § 1). Eso
significa que una petición de venta puede traer un **nombre** donde el modelo espera un
**`clienteId`**, y que la fila de `Cliente` hay que escribirla al recibirla.

Las restricciones, todas verificadas leyendo el código:

- `checkCreditInvariant` (`src/lib/cuentasPorCobrar/creditInvariant.ts`, entregado por F-031 y
  cerrado con `passes: true`) es una **función pura** que solo conoce `clienteId`: su primera
  violación, `CREDIT_WITHOUT_CUSTOMER`, se dispara cuando `creditoBase > 0` y `clienteId` está
  ausente, `null` o vacío. No consulta nada y no sabe qué es un nombre.
- El contrato de F-031 fija además un orden que F-034 hereda: `reconcileSaleTotal` corre
  **primero**, y `checkCreditInvariant` recibe el total **ya reconciliado por el servidor**, nunca
  el que reportó el cliente. Validar contra el total del cliente anularía la única defensa contra
  una deuda inventada.
- El patrón de las dos rutas de venta es que todo lo que solo lee o solo calcula corre **fuera** de
  la `$transaction`: con el transaction pooler (`connection_limit=1`), una consulta que corra
  dentro usando el cliente global `prisma` pide una segunda conexión inexistente y da
  «Transaction already closed».
- La deuda tiene que nacer **en la misma `$transaction`** que la `Venta` (dosier § 6, «Rutas de
  venta»), y con ella la fila de `Cliente` que le falte, para que un fallo posterior —existencia
  insuficiente, por ejemplo— no deje ni una deuda huérfana ni un cliente fantasma.
- **E-038**, verificado en F-014 y registrado: en PostgreSQL una violación de restricción única
  **aborta la transacción entera**, no solo la sentencia. La transacción interactiva de Prisma corre
  sobre una sola conexión, así que un `catch` de JavaScript dentro atrapa el error pero **no
  revierte el estado del servidor**: todo lo que venga después se ignora, incluido el commit.
- **E-043**: el `syncId` `@unique` de la venta es el eje de idempotencia de la venta, y protege
  contra reenviar **la misma** venta. **No** protege contra dos ventas **distintas** —dos `syncId`,
  dos cajeros, dos dispositivos— nombrando al mismo cliente nuevo al mismo tiempo.
- `createOrReactivateCliente` (`src/lib/clientes/clienteUpsert.ts`, F-033) resuelve el alta con
  lectura previa y un reintento, pero habla con el `prisma` global y **no abre transacción**
  (ADR 0114). Su función pura `decideClienteUpsert` sí es reutilizable tal cual.

La pregunta abierta era: **dónde va la resolución del nombre a un id**, sin parafrasear la
definición de `CREDIT_WITHOUT_CUSTOMER` en un segundo sitio (**E-039**) y sin darle un tercer dato
de entrada a una función pura que ya está cerrada.

## Decisión

**El `clienteId` se resuelve —o se reserva— en un paso de solo lectura anterior a la transacción, y
`checkCreditInvariant` recibe siempre un id que va a existir cuando la transacción confirme. La
escritura de `Cliente` ocurre dentro de la transacción de la venta.**

Y `resolveCreditCustomer` se invoca **únicamente** dentro de `if (creditoBase > 0)`: fuera de ahí
`clienteIdEfectivo` vale `null` porque se inicializa así, no porque la función lo haya calculado.
La rama 1 de esa función —`creditoBase <= 0` → `NONE`— es la red para cualquier llamador futuro que
la invoque sin la guarda, no el camino de estas dos rutas.

En detalle, y en este orden:

1. Fuera de la transacción, después de `reconcileSaleTotal` y solo si `creditoBase > 0`, la ruta
   hace **como mucho una** consulta acotada con `withTenantScope("cliente", …, negocioId)`: por
   `id` si la petición trae `clienteId`, o por nombre normalizado si trae `clienteNombre`. Ninguna
   de las dos filtra por `deletedAt`.
2. Una función pura nueva, `resolveCreditCustomer`
   (`src/lib/cuentasPorCobrar/creditCustomer.ts`), decide con esas lecturas cuál de cuatro cosas
   toca: `NONE`, `EXISTING`, `REACTIVATE` o `CREATE`. Para el caso `CREATE` **devuelve un uuid
   recién acuñado por la ruta**: el id con el que la fila se va a escribir.
3. `checkCreditInvariant` recibe ese `clienteId` y **no cambia de firma ni de comportamiento**. En
   los tres casos en que hay cliente —lo hay ya, o lo va a haber— recibe un uuid real; cuando no lo
   hay recibe `null` y contesta `CREDIT_WITHOUT_CUSTOMER`, que la ruta traduce a **409** con
   `CREDIT_INVARIANT_HTTP_STATUS`, que también es de F-031.
4. Dentro de la `$transaction`, y **antes** de crear la venta, la ruta vuelve a leer por nombre con
   `tx.cliente.findFirst` y solo entonces escribe: crea con el id reservado, o reactiva la fila
   borrada que encontró, o no escribe nada.
5. La `CuentaPorCobrar` se crea inmediatamente después del `tx.venta.create`, en el mismo bloque,
   con el `tiendaId` derivado de **la misma variable** ya persistida como `Venta.tiendaId`.

**La carrera real se recupera fuera de la transacción, con un reintento y solo uno.** Si el
`create` del cliente choca con `@@unique([nombre, negocioId])`, la transacción entera queda abortada
y nada de ella se confirmó. El `catch` que ya existe en las dos rutas —que primero busca la venta
por `syncId` y la devuelve con 200 si ya existía, y eso no cambia— gana una rama: cuando el error es
un `P2002`, la búsqueda por `syncId` no encontró nada y la resolución era `CREATE` o `REACTIVATE`,
se vuelve a ejecutar el camino entero **una vez**. En esa segunda pasada la lectura del punto 1
encuentra la fila que el ganador escribió y la resolución vuelve `EXISTING`, sin escribir en
`Cliente`.

**Si el reintento tampoco basta, la respuesta es 409** con
`code: "CREDIT_CUSTOMER_CONFLICT"`, y no un 500.

**`checkCreditInvariant` se invoca solo cuando `creditoBase > 0`.** Una venta al contado atraviesa
el servidor exactamente igual que antes de este feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dar a `checkCreditInvariant` un tercer dato de entrada (`clienteNombre`) | Es un archivo de F-031, cerrado con `passes: true`, con sus doce criterios verificados contra la firma actual. Y no arregla nada: la función seguiría sin poder decir si ese nombre corresponde a un cliente **del negocio**, que es la otra mitad de la regla dura. Cambiar una firma cerrada para que siga sin contestar la pregunta es coste sin beneficio |
| Que la ruta compruebe «hay nombre o hay id» por su cuenta antes de llamar a la función | Sería una **paráfrasis** de `CREDIT_WITHOUT_CUSTOMER` en un segundo sitio: la definición de «esta venta no tiene cliente» pasaría a estar escrita dos veces, y una corrección dejaría una atrás. Es literalmente **E-039**, y en un feature que ya tiene la regla escrita en un símbolo exportado |
| Crear el `Cliente` **antes** de la transacción, con `createOrReactivateCliente` | Deja un cliente huérfano cada vez que la venta falle después —existencia insuficiente, período equivocado, invariante rota—, y esas ventas fallan a diario en este producto. Además contradice el dosier § 6, que asigna el alta a la misma transacción que la venta |
| Reutilizar `createOrReactivateCliente` **dentro** de la transacción | Habla con el `prisma` global, no con el `tx` del llamador: bajo el transaction pooler pide una segunda conexión y da «Transaction already closed». Lo que sí se reutiliza es su función pura, `decideClienteUpsert` |
| Solo el `catch` del `P2002` dentro de la transacción, sin lectura previa | Es exactamente el error que **E-038** documenta: el `catch` atrapa el error pero la transacción sigue abortada y el `findFirst` de recuperación y el commit fallan con «current transaction is aborted» |
| Solo la lectura previa, sin el `catch` fuera | Deja la carrera dentro: entre la lectura y la escritura otra petición puede ganar, y el `P2002` resultante tumba la venta sin recuperación posible |
| Más de un reintento | El único fallo que un reintento puede resolver es «alguien ganó la carrera», y eso se resuelve a la primera o no era eso (E-038, y el mismo razonamiento que `CLIENTES_UPSERT_RETRIES` en ADR 0114) |
| Devolver **500** cuando el reintento tampoco basta | Un 5xx no es permanente para `isPermanentSyncError`, así que la cola offline reenviaría la venta sola hasta `MAX_SYNC_ATTEMPTS`. Después de dos lecturas y dos escrituras fallidas seguidas, repetir no es lo que hace falta: girar es justo el comportamiento que la primera regla dura del dosier existe para evitar |
| Llamar a `checkCreditInvariant` también con `creditoBase = 0` | La función es **más estricta que lo que el servidor hace hoy**, y F-031 lo dejó escrito: con `creditoBase = 0` el único desenlace posible además de `ok` es `TOTAL_MISMATCH`, que **sí** es alcanzable hoy —una venta con un sobrepago que no quedó registrado como vuelto se persiste sin más—. Sin la guarda, ventas al contado que hoy se registran empezarían a devolver 400, que es exactamente la degradación que el criterio 1 de F-034 prohíbe |

## Consecuencias

**A favor:**

- `checkCreditInvariant`, `CREDIT_INVARIANT_VIOLATIONS` y `CREDIT_INVARIANT_HTTP_STATUS` se
  consumen **tal cual**: F-031 no se reabre, y las dos mitades de la primera regla dura —«presente»
  y «del negocio»— hablan un **solo** vocabulario, el de aquella función. Un `clienteId` de otro
  negocio no resuelve, y por no resolver produce el mismo `CREDIT_WITHOUT_CUSTOMER` y el mismo 409
  que un `clienteId` ausente. Es lo que hace verificable el criterio 6 sin inventar un código nuevo.
- La decisión de qué hacer con el cliente es **pura** y por tanto testeable desde `src/__tests__/`
  sin base de datos: las dos consultas son del llamador, y pasarle `null` por una lectura que no se
  hizo es cómo «no encontrado» y «no preguntado» dicen lo mismo.
- La deuda y su cliente nacen y mueren con la venta: no hay estado a medias que reparar a mano.
- Una venta al contado no paga **nada** por este feature: ni una consulta más, ni una validación
  más, ni un byte más en el payload.

**En contra / coste asumido:**

- **Se acuña un uuid antes de saber si se va a usar.** Cuando la resolución acaba siendo `EXISTING`
  —porque otra petición creó la fila entretanto—, ese id se descarta. No cuesta nada y no se
  escribe en ningún sitio, pero es una pieza que hay que explicar para que no se lea como un fallo:
  el id no es «un cliente inventado», es el id con el que la fila se escribiría, y por eso satisface
  la pregunta que `checkCreditInvariant` hace.
- **Un reintento es más caro que reintentar solo el `create`**, porque en Postgres eso último no
  existe: la violación abortó la transacción entera. El alcance del bucle está fijado **exactamente**
  en el § 5.6 del contrato —desde la resolución del cliente hasta el fin de la `$transaction`,
  ambos inclusive— y **no** incluye las lecturas de productos, tasas ni descuentos: ninguna depende
  del cliente ni cambia entre las dos pasadas, y sus resultados siguen siendo válidos. Es un coste
  acotado a dos consultas y una transacción, sobre un caso raro por construcción.

  > **Enmienda del 2026-09-09** (M1 de `.agents/F-034-seguridad.md`). Este párrafo decía antes «se
  > vuelven a hacer las lecturas de productos, tasas y descuentos», que describía un bucle más
  > ancho que el del § 5.6 del contrato. Como el propio contrato dice que en caso de contradicción
  > gana el ADR, la frase habría prevalecido sobre la sección que el `implementer` iba a seguir
  > letra por letra. Se corrige aquí y se precisa allí: el alcance es el estrecho, y las dos
  > redacciones ya dicen lo mismo.
- **Una venta a crédito puede acabar aparcada.** Con el 409 del segundo fallo, la cola no la
  reintenta sola. No se pierde —sigue visible como pendiente y el botón de reenvío del
  `SalesDrawer` la manda otra vez, y en ese envío la lectura previa ya encuentra al cliente—, pero
  cuesta un toque del cajero. Se prefiere eso a una venta girando indefinidamente.
- **La invariante es nueva solo para las ventas a crédito.** Una venta a crédito cuyo total del
  cliente diverja del recomputado por el servidor por más de `SALE_TOTAL_TOLERANCE_BASE` se
  **rechaza** con 400 (`TOTAL_MISMATCH`), donde hoy se persistiría con el total del servidor. Es
  deliberado y es el criterio 13: sin eso, la deuda la fija el cliente. Para una venta al contado no
  cambia nada.
- **Dos ventas offline con nombres parecidos pero no iguales siguen creando dos clientes.**
  `normalizeClienteNombre` recorta y colapsa espacios, pero no pliega mayúsculas ni quita tildes
  (F-033, ADR 0114): «Ana Pérez» y «ana perez» son dos filas. Fusionar clientes es deuda conocida
  de F-033 y sigue sin resolverse aquí.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant.** Las dos lecturas y las dos escrituras de `Cliente` van acotadas con
  `withTenantScope("cliente", …, negocioId)` —también en la segunda pasada del reintento, que
  reutiliza la misma variable `negocioId` fijada al principio de la función y no la vuelve a leer
  del cuerpo—, y ese `negocioId` sale del `ITenantScope` que devuelve
  `assertTiendaTenant`, **nunca** del cuerpo de la petición. Un `clienteId` de otro negocio no
  resuelve, y por eso la venta se rechaza en vez de colgar una deuda del tenant equivocado. La
  `CuentaPorCobrar` hereda su `tiendaId` de la misma variable ya persistida como `Venta.tiendaId`,
  que es el invariante que F-031 escribió en el comentario de esa columna: es la única vía por la
  que `TENANT_RELATION_PATH.cuentaPorCobrar` llega a `negocioId`, así que una fila nacida con otro
  `tiendaId` pasaría el filtro del negocio que no es, con un camino perfectamente correcto.
- **Permisos.** Esta decisión no cambia ninguna puerta; ver **ADR 0119**.
- **Escalabilidad.** El coste por venta a crédito es una lectura y, como mucho, dos escrituras; el
  de una venta al contado es cero. No hay N+1: se resuelve un cliente por venta, no uno por línea.
  La transacción crece en una sentencia (`cuentaPorCobrar.create`) y, en el caso de un cliente
  nuevo, en dos (lectura y `create`) — todas sobre índices que ya existen.
- **Reversión.** Reversible salvo por las filas escritas. Quitar el código deja `Venta.creditoBase`
  poblado y `CuentaPorCobrar` con filas, pero no corrompe nada: `buildResumenMonedas` sigue armando
  la caja iterando `pagosDetalle`, que es por qué la caja cuadra sola (ADR 0111). No hace falta
  migración para volver atrás.
