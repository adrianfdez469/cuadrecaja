# F-033 — Auditoría de seguridad del contrato (previa a implementación)

> Escrito por el agente `security-guardian`, paso 4 del pipeline, en paralelo con `arch-guardian`.
> No toca `.agents/specs/F-033.md`, `docs/adr/` ni código. **El código de F-033 todavía no existe:**
> esta auditoría es sobre el contrato de interfaces (`.agents/specs/F-033.md`, spec líneas 1-311 y
> contrato §0-13, líneas 313-1256) y los ADR 0113-0116, no sobre una implementación. F-033 es
> obligatorio para este agente porque crea permisos nuevos, cinco rutas de API nuevas y convierte
> `Cliente` (entregado por F-031 como modelo puro) en la primera entidad de este epic con CRUD
> propio, caché de cliente y superficie de menú.

## Alcance auditado

- `.agents/specs/F-033.md` completo — spec (líneas 1-311) y contrato de interfaces (líneas
  313-1256, §0-13).
- `docs/adr/0113-los-selectores-de-cliente-nacen-en-la-pantalla-de-configuracion-no-en-el-pos.md`,
  `0114-reactivar-un-cliente-borrado-se-hace-sin-transaccion-con-lectura-previa-y-un-reintento.md`,
  `0115-el-cache-de-clientes-es-una-proyeccion-de-cuatro-campos-que-se-descarta-entera-al-cambiar-de-version.md`
  y `0116-el-permiso-de-clientes-va-a-vendedor-y-no-a-almacenero.md` — completos.
- `docs/adr/0077-fuera-de-tenant-es-404-sin-permiso-es-403-y-el-401-sigue-siendo-solo-del-middleware.md`
  — completo, incluida la tabla normativa de `tenantScopeDenial`.
- `.agents/cuentas-por-cobrar.md` §9 (mapa de propiedad) y §11 (errores conocidos aplicables).
- `.agents/F-031-seguridad.md` y `.agents/F-032-seguridad.md` completos — para la forma del informe
  y para verificar que sus hallazgos (B1, B2 sobre `CuentaPorCobrar.tiendaId` y
  `MovimientoCuentaPorCobrar.revierteId`) siguen escritos en `prisma/schema.prisma` tal como F-032
  los confirmó.
- Código real: `src/lib/tenantScope.ts` completo (`sessionNegocioId`, `withTenantScope`,
  `decideTenantScope`, `resolveTenantAxis`, `tenantForbiddenResponse`, `tenantNotFoundResponse`,
  `tenantScopeDenial`), `src/constants/tenantScope.ts` (entradas `cliente: []` y
  `cuentaPorCobrar: ["tienda"]`), `src/utils/permisos_back.ts`, `src/utils/getPermisosUsuario.ts`
  (`tienePermiso`, comparación exacta sobre el array separado por `|`), `src/schemas/cliente.ts`,
  `prisma/schema.prisma` líneas 1382-1500 (`Cliente`, `CuentaPorCobrar`,
  `MovimientoCuentaPorCobrar`), `src/app/api/proveedores/route.ts` y
  `src/app/api/proveedores/[id]/route.ts` (el precedente literal que el spec pide espejar),
  `src/constants/routeGuards/routeGuards.json` (formato real de las filas de `proveedores/**`),
  `src/components/Layout.tsx` (el `signOut()` de la línea 903 y el efecto de expiración de sesión),
  `src/context/AppContext.tsx`, `src/store/cartStore.ts` (para confirmar si existe algún
  precedente de limpieza de store al cerrar sesión — no lo hay, ver hallazgo B).
- `.agents/COMMON_ERRORS.md` → E-042, E-043, E-009, E-057, E-031 (fichas completas), más E-007,
  E-013, E-038, E-047, E-008 por referencia cruzada del propio contrato.

Todo lo citado abajo se leyó, no se dedujo.

---

## Recorrido ruta por ruta

El encargo pide las cinco rutas una a una, sin agrupar y sin eximir ninguna «porque otra la cubre»
(E-042). Las cinco resuelven el eje de tenant con `resolveTenantAxis({ session, permisoRequerido })`
— Gate B de `src/lib/tenantScope.ts:320-337`, la puerta correcta porque `Cliente` no llega con
`tiendaId` en la ruta (`TENANT_RELATION_PATH.cliente = []`, columna `negocioId` directa) — y las
consultas con `withTenantScope("cliente"/"cuentaPorCobrar", …, negocioId)`. Ninguna escribe
`negocioId` a mano en un `where`.

### R1 — `GET /api/clientes` (§5.1, `.agents/specs/F-033.md:705-721`)

- **Aislamiento de tenant:** `withTenantScope("cliente", { deletedAt: null, nombre: {...} }, negocioId)`
  produce `{ deletedAt: null, nombre: {...}, negocioId }` — filtro real sobre una columna propia
  de `Cliente` (`prisma/schema.prisma:1394-1395`), no un salto de relación ni una mención. El
  segundo query (`loadSaldoPorCliente`, §4.3, `.agents/specs/F-033.md:578-615`) se acota con
  `withTenantScope("cuentaPorCobrar", …, negocioId)`, que resuelve a `{ clienteId: {in}, tienda:
  { negocioId } }` — un JOIN real contra la FK `CuentaPorCobrar.tiendaId → Tienda.id`
  (`prisma/schema.prisma:1417-1424`), verificado en el schema, no una columna homónima (E-042). Los
  `clienteId` que entran a esa segunda consulta ya salieron del primer `findMany`, que ya está
  acotado por tenant — no hay forma de que un id ajeno llegue al `groupBy`.
- **Autenticación y autorización:** sin permiso, `permisoAusenteMotivo: "justificado"` — cualquier
  sesión válida del negocio, sin exigir ningún permiso de los dos nuevos ni de ningún otro. Ver
  hallazgo 🔴-1 más abajo: esto es más amplio que «lo que un vendedor puede ver» — es lo que
  **cualquier** usuario autenticado del negocio puede ver, tenga o no tenga permisos asignados.
- **Fuga por código de respuesta:** no aplica — no hay 404 en una lista. El 500 usa «una constante
  fija, nunca el mensaje de la excepción» (contrato, línea 719), correcto contra E-031.
- **Validación de entrada:** `nombre?: string` y `limit?: number` son parámetros de *query*, no de
  *body* — no hay Zod explícito citado para ellos en el contrato. Ver hallazgo 🟡-3.
- **Qué expone exactamente (el punto central del encargo):** `IClienteConSaldo[]`, es decir, la fila
  completa de `Cliente` (`nombre`, `descripcion`, `direccion`, `telefono`, `negocioId`, `createdAt`,
  `updatedAt`, `deletedAt`) más `saldo` (la deuda viva agregada, en moneda base). **Sí, el GET
  devuelve saldos de deuda — con todas las letras**: `clienteConSaldoSchema` (§2.2,
  `.agents/specs/F-033.md:407-410`) extiende `clienteSchema` con `saldo: z.number()`, y §0 decisión 8
  (`.agents/specs/F-033.md:325`) fija que ese `saldo` es la suma de `CuentaPorCobrar.saldoPendiente`
  de las cuentas vivas. Ninguna proyección more estrecha se aplica en el servidor: la que sí existe
  (`IClienteOption`, cuatro campos) es un recorte que hace el **cliente** (`toClienteOption`, §4.5),
  no el servidor. Ver hallazgo 🔴-1.

### R2 — `POST /api/clientes` (§5.2, `.agents/specs/F-033.md:722-739`)

- **Aislamiento de tenant:** el `negocioId` que entra a `createOrReactivateCliente` (§4.2,
  `.agents/specs/F-033.md:527-577`) sale de `resolveTenantAxis`, nunca del cuerpo — confirmado:
  `createClienteSchema` (`src/schemas/cliente.ts:15-20`) no tiene campo `negocioId`. La lectura
  previa (ADR 0114) usa `withTenantScope("cliente", { nombre }, negocioId)` — filtro real, columna
  propia. La escritura (`create` o `update`) recibe el mismo `negocioId` de la misma variable
  resuelta por `resolveTenantAxis` — una sola lectura, una sola variable, igual que el B1 de
  F-031-seguridad pidió para `CuentaPorCobrar.tiendaId`.
- **Autenticación y autorización:** `configuracion.clientes.acceder`, verificado en backend vía
  `resolveTenantAxis`/`decideTenantScope`, que llama a `verificarPermisoUsuario` — no es una
  comprobación solo de UI.
- **Fuga por código de respuesta:** el 409 (`action` interna `DUPLICATE`) responde
  `{ error: CLIENTES_API_ERRORS.nombreDuplicado }` — un string fijo, sin citar el `id` ni ningún
  otro campo de la fila colisionada. No hay oráculo: no se puede distinguir desde este 409 si la
  fila que colisionó está activa o borrada en blando (ninguna de las dos cosas es observable desde
  la respuesta), lo cual es consistente con que la decisión de reactivar vs duplicar ya se resolvió
  puertas adentro.
- **Validación de entrada:** `createClienteSchema` (F-031), cotas ya fijadas (200/300/300/40). El
  400 de validación **no incluye el detalle de Zod** (contrato, línea 736) — correcto contra E-031,
  aunque el motivo aquí no es una credencial sino evitar ecoar el valor que falló.
- **Mass assignment:** `createClienteSchema` no acepta `id`, `negocioId`, `createdAt`, `deletedAt`
  ni ningún campo que el cliente no deba poder fijar. Correcto.

### R3 — `GET /api/clientes/[id]` (§5.3, `.agents/specs/F-033.md:740-754`)

- **Aislamiento de tenant:** `withTenantScope("cliente", { id, deletedAt: null }, negocioId)` —
  **esto es exactamente la forma que el encargo pide distinguir**: un `where` compuesto de tres
  claves (`id`, `deletedAt: null`, `negocioId`), no un `findUnique({ where: { id } })` seguido de una
  comprobación en memoria. Las tres causas de 404 —no existe, es de otro negocio, está borrado en
  blando— colapsan en la misma consulta vacía, no en tres ramas de código con tres mensajes
  potencialmente distintos.
- **Autenticación y autorización:** sin permiso, mismo argumento que R1. Mismo hallazgo 🔴-1 aplica
  aquí: la ficha completa de un cliente, con su saldo, es legible por cualquier sesión del negocio
  sabiendo (o adivinando, aunque el 404 lo impide como oráculo) su `id`.
- **Fuga por código de respuesta:** el 404 es idéntico para las tres causas (contrato, línea 752:
  «Las tres causas del 404 responden idéntico, que es el punto del ADR 0077»). Correcto y explícito
  en el propio contrato — no hace falta pedir nada aquí.
- **Validación de entrada:** `params` es `Promise<{ id: string }>`, resuelto con `await` (Next 15
  asíncrono) — correcto. No se valida que `id` tenga forma de UUID antes de la consulta, pero un
  `id` mal formado simplemente no matchea ninguna fila y cae en el mismo 404 uniforme — no es una
  vía de inyección (Prisma parametriza) ni de oráculo.

### R4 — `PUT /api/clientes/[id]` (§5.4, `.agents/specs/F-033.md:755-771`)

- **Aislamiento de tenant:** el contrato no escribe la forma literal del `where` para esta ruta
  (a diferencia de R3, que sí la escribe: `withTenantScope("cliente", { id, deletedAt: null },
  negocioId)`). Lo que sí fija es el comportamiento observable — 404 para «no existe, es de otro
  negocio, o está borrado en blando» — que solo es alcanzable con un `where` compuesto igual al de
  R3, no con un `findFirst({ where: { id, negocioId } })` seguido de un `if (existing.deletedAt)`
  en memoria. Las dos formas producen el mismo 404 en el camino feliz, pero difieren en un punto que
  sí importa para la integridad de datos, no para el aislamiento de tenant: ver hallazgo 🟠-4.
- **Autenticación y autorización:** `configuracion.clientes.acceder`, backend, vía
  `resolveTenantAxis`.
- **Fuga por código de respuesta:** el 409 de nombre duplicado (`{ error:
  CLIENTES_API_ERRORS.nombreDuplicado }`, string fijo) no cita el `id` ni el estado
  (activo/borrado) de la fila colisionada — mismo argumento que R2. El chequeo de duplicado está
  además acotado a `negocioId` (contrato: «el `nombre` nuevo ya lo lleva **otra** fila del
  negocio»), así que no puede usarse para sondear nombres de otro negocio.
- **Validación de entrada:** `updateClienteSchema` = `createClienteSchema.partial()` — mismas cotas,
  ninguna nueva ampliación de campos. Correcto.
- **Orden de evaluación:** el contrato no dice explícitamente si el 404 (pertenencia) se evalúa
  antes que el 409 (duplicado de nombre) o al revés. Como el chequeo de duplicado ya está acotado al
  propio `negocioId` del que hace la petición, invertir el orden no abre una fuga entre tenants —
  pero si se evaluara el duplicado antes que la pertenencia, se gastaría una consulta extra en una
  petición que de todos modos va a ser rechazada. Ver hallazgo 🟠-4 para la instrucción concreta.

### R5 — `DELETE /api/clientes/[id]` (§5.5, `.agents/specs/F-033.md:772-793`)

- **Aislamiento de tenant:** mismo razonamiento que R4 — el 404 cubre «no existe, es de otro
  negocio, o ya estaba borrado», lo que exige un `where` compuesto con `deletedAt` incluido, no una
  comprobación en memoria después de un `findFirst` más amplio. El chequeo de deuda viva
  (`loadSaldoPorCliente`) solo se alcanza **después** de confirmar pertenencia — no hay manera de
  que un `clienteId` ajeno dispare el cálculo de saldo antes del 404.
- **Autenticación y autorización:** `configuracion.clientes.acceder`, backend.
- **Fuga por código de respuesta — el punto que el encargo pide dictaminar explícitamente:** el 409
  nombra el monto exacto (`CLIENTES_API_ERRORS.saldoPendiente(saldo)` interpola el número con
  `toFixed(2)`, más el campo `saldoPendiente` en `IClienteDeleteConflict`). **Dictamen: esto no es
  una fuga incremental hacia un usuario con permiso de escritura pero sin el de recuperaciones.**
  La cifra que el 409 revela es la **misma lectura** que R1/R3 ya devuelven sin exigir ningún
  permiso en absoluto (contrato, línea 786: «de modo que la cifra del mensaje y la del campo son la
  misma lectura, no dos» — y esa misma lectura es la que ya sale en `IClienteConSaldo.saldo`). Un
  usuario con `configuracion.clientes.acceder` (que además ya tenía acceso de sobra al GET, que no
  exige ningún permiso) no aprende nada por este 409 que no pudiera leer ya llamando a
  `GET /api/clientes/[id]`. El hallazgo real no es este 409 — es R1/R3 (hallazgo 🔴-1): mientras esa
  exposición exista, este 409 es un canal redundante, no uno nuevo.
- **Validación de entrada:** no hay body en un DELETE; nada que validar más allá del `id` de la
  ruta.
- **Efecto:** `UPDATE` de `deletedAt`, nunca `DELETE` de fila, y no toca `CuentaPorCobrar` — tal
  como F-031 lo dejó decidido (`.agents/specs/F-031.md`, § 2.1) y F-033 solo implementa.

---

## 🔴 Hallazgos que obligan a enmendar el contrato antes del paso 5

Los dos siguientes no son errores de diseño ni fugas entre tenants — el aislamiento de negocio es
correcto en las cinco rutas (ver recorrido arriba). Son **decisiones sin decidir por escrito**: el
contrato deja un comportamiento observable sin que nadie haya puesto la frase que dice si es
aceptado a propósito o si hay que cerrarlo. Es la misma clase de hueco que
`.agents/F-031-seguridad.md` (B1, B2) y `.agents/F-032-seguridad.md` (H1) ya señalaron para este
mismo epic: barato de escribir ahora, sobre un contrato que nadie implementó todavía; caro después,
porque F-034/F-035/F-037 van a leer lo que estos archivos digan, no van a releer esta auditoría.

### 🔴-1 — El GET sin permiso expone el saldo de deuda de todo el negocio a cualquier sesión, sin acotar el campo, y eso contradice en silencio la premisa de ADR 0116

**Dónde:** contrato §5.1 y §5.3 (`.agents/specs/F-033.md:705-754`), §2.2 (`clienteConSaldoSchema`,
líneas 407-410) y §0 decisión 8 (línea 325).

**La decisión de no exigir permiso en el GET está cerrada y este hallazgo no la reabre** — el
encargo lo fija así explícitamente, y el argumento («el selector del POS necesita leer la lista»,
espejo de `proveedores/route.ts`) es sólido y no es nuevo: `Proveedor` ya funciona así. Lo que
**no** está escrito en ningún sitio es qué pasa con el campo `saldo`, que `Proveedor` **no tiene**.

**Qué permite exactamente:** cualquier usuario con una sesión válida en el negocio —no solo un
`vendedor` con `configuracion.clientes.acceder`; **literalmente cualquiera**, incluido un usuario al
que se le hayan retirado todos los permisos desde la pantalla de roles, porque el GET no comprueba
ninguno— puede llamar `GET /api/clientes` (o `GET /api/clientes/[id]` con un `id` que ya conozca) y
leer, para cada cliente del negocio, cuánto dinero debe en este momento. Esto es precisamente la
cifra que `ADR 0116` describe como «una vista de dueño de negocio» al justificar por qué
`recuperaciones.cuentasporcobrar.acceder` —el permiso que protege el panel agregado de F-035— se
reserva **solo** a `administrador`:

> «Quién debe dinero es una vista de dueño de negocio.» (`docs/adr/0116-...md`, sección Decisión)

El GET de F-033 ya entrega esa misma vista —por cliente, no agregada, pero es el mismo dato— sin
ningún permiso. El gate de `recuperaciones.cuentasporcobrar.acceder` sobre el panel de F-035 protege
la **presentación agregada** del dato, pero no el dato en sí, que ya está abierto desde F-033. No es
una vulnerabilidad de aislamiento de tenant —el dato es del propio negocio del usuario, no de otro—,
pero sí es una decisión de sensibilidad de datos que el contrato no ha escrito, y que va en la
dirección contraria de lo que `ADR 0116` acaba de argumentar dos párrafos antes en el mismo epic.

**Por qué puede ser correcto igual, y por qué de todas formas hay que escribirlo:** hay un argumento
de producto real para que sea así: `ADR 0115` dice que el selector muestra el `saldo` «para elegir a
quién se le fía» — un `vendedor` que va a vender a crédito **necesita** saber cuánto debe ya el
cliente antes de decidir si le vende más fiado. Si esa es la razón, es una razón válida — pero hoy
solo vive en la cabeza de quien lo diseñó, no en un documento que F-035 o F-037 vayan a leer antes
de asumir lo contrario.

**Cambio concreto pedido al `arch-guardian`, en el contrato §5.1** (o en una nota nueva de ADR 0116),
una frase con esta forma:

```
El campo `saldo` de IClienteConSaldo viaja SIN permiso, a cualquier sesión del negocio, por
diseño: el vendedor necesita ver cuánto debe ya un cliente para decidir si extenderle más
crédito (ADR 0115, "para elegir a quién se le fía"). La clasificación de ADR 0116 ("quién debe
dinero es una vista de dueño de negocio") se aplica al PANEL agregado de F-035
(recuperaciones.cuentasporcobrar.acceder), no al saldo por cliente que este GET ya expone sin
permiso desde F-033. Ningún feature posterior debe asumir que el saldo de un cliente es un dato
protegido detrás de ese permiso: no lo está, y no lo estuvo desde que F-033 se entregó.
```

Si el humano decide lo contrario —que el `saldo` sí debería acotarse a un permiso—, la corrección
no es reabrir la decisión de «GET sin permiso» (que sigue siendo correcta para el resto de los
campos): es que `clienteConSaldoSchema` no lleve `saldo` cuando la sesión no tiene
`recuperaciones.cuentasporcobrar.acceder`, y que el selector lo reciba como `null`/ausente en ese
caso — un cambio de forma en el schema, no de permiso en la ruta. Cualquiera de las dos cierra el
hueco; dejarlo implícito es lo que este hallazgo no permite.

### 🔴-2 — El caché de `localStorage` no se limpia al cerrar sesión ni al cambiar de negocio, y en un dispositivo compartido de tienda eso deja nombre, teléfono y deuda del negocio anterior legibles por el siguiente usuario

**Dónde:** ADR 0115 completo, contrato §3 (`CLIENTES_CACHE_STORAGE_KEY`,
`.agents/specs/F-033.md:451-506`) y §8.1 (`.agents/specs/F-033.md:930-978`).

**Verificado en el código real, no supuesto:** `CLIENTES_CACHE_STORAGE_KEY = "clientes-cache"` es
una clave **global de `localStorage`**, no namespaced por `negocioId` ni por `usuarioId`. Busqué en
todo el repo un precedente de limpiar un store de Zustand persistido al cerrar sesión —
`src/context/AppContext.tsx`, `src/components/Layout.tsx:903` (el único `signOut()` manual del
código de producción) y `src/store/cartStore.ts` completo— y **no existe ninguno**: ni siquiera
`cartStore`, que también persiste con Zustand, se limpia en `signOut()`. F-033 no tiene un patrón
que copiar; sería el primero en necesitarlo.

**El riesgo real, en el escenario que el encargo señala (dispositivo compartido de tienda):**
`ADR 0115` sí razona sobre un escenario parecido —«cambiar de negocio con el mismo usuario»— y lo
cierra diciendo que la ventana la resuelve el servidor del lado de la **escritura** (F-034 rechaza
con 409 una venta a crédito cuyo `clienteId` no sea del negocio del vendedor). Pero eso solo cierra
el camino de **escribir** una venta con un cliente ajeno; no cierra el camino de **leer**: nada
impide que el selector, en modo sin conexión, muestre nombre, teléfono y saldo de los clientes del
negocio o del usuario **anterior** en ese mismo navegador, hasta que ocurra un `refresh` con éxito.
Y el escenario que el encargo pide analizar —una tableta o terminal de POS que varios empleados
comparten, entrando y saliendo con sus propias cuentas, posiblemente de negocios distintos si el
dispositivo se reutiliza entre locales— no es «el mismo usuario cambiando de negocio»: es un
**usuario distinto**, para el que `ADR 0115` no escribió ninguna regla, y que puede no tener
absolutamente ningún permiso sobre los clientes del negocio anterior.

Es exactamente el patrón que el criterio 10 protege en la dirección contraria (mostrar caché sin
conexión es una funcionalidad deseada) sin que nada acote **de quién** es ese caché. El dato en
juego —nombre, teléfono y deuda de un tercero, hasta `CLIENTES_CACHE_SIZE` (200) filas— es
justamente el que `ADR 0115` ya identificó como sensible al decidir **qué** persistir (cuatro campos,
no la fila completa); la misma sensibilidad se aplica a **cuánto tiempo** y **para quién** queda
accesible.

**No es un hallazgo bloqueante en el sentido de «hay una fuga hoy alcanzable»** — F-033 no tiene
código todavía, y `CuentaPorCobrar` no tiene filas hasta F-034 — pero es exactamente la clase de
garantía que hay que fijar por escrito antes de que `clientesStore.ts` se escriba, porque una vez
escrito sin este hook, nadie vuelve a mirarlo: es un componente sin cobertura de tests (§11.2,
`.agents/specs/F-033.md:1187-1195` — «no hay `@testing-library/react`»), así que la única red que
lo detectaría es una revisión de seguridad como esta, hecha después de que ya esté en producción.

**Cambio concreto pedido al `arch-guardian`, en el contrato §8.1**, fijando una de estas dos formas
(cualquiera de las dos es aceptable; lo que no lo es es el silencio actual):

```
clientesStore expone `clear()` (ya está en la interfaz, §8.1) y el `implementer` lo conecta al
único signOut() de producción (src/components/Layout.tsx:903) y al efecto de expiración de
sesión de ese mismo archivo, para que el caché no sobreviva a un cambio de usuario en el mismo
navegador. Es el primer store de este repo que lo hace; cartStore.ts queda fuera del alcance de
F-033 y su propia limpieza al cerrar sesión es deuda anotada, no de este feature.
```

o, si el humano prefiere no tocar el flujo de `signOut()` en este feature:

```
Se acepta el riesgo residual de un caché de cliente que sobrevive a un cambio de usuario en un
dispositivo compartido, con el mismo argumento que ADR 0115 ya usó para el cambio de negocio: la
escritura (venta a crédito) está protegida en servidor por F-034; lo que queda expuesto es
SOLO lectura (nombre, teléfono, saldo), nunca la capacidad de operar sobre ese cliente. Queda
escrito aquí para que nadie lo redescubra como si fuera nuevo.
```

La primera opción es la que este auditor recomienda — el costo (conectar `clear()` a un `signOut()`
que ya existe) es bajo comparado con dejar PII y deuda de terceros en el disco de una tableta de
tienda entre turnos de empleados distintos.

---

## 🟠 Alta severidad — instrucciones para el `implementer`, no bloquean el paso 5

### 🟠-3 — El `where` de PUT y DELETE debe incluir `deletedAt: null` en la MISMA consulta que resuelve la fila, no en una comprobación posterior en memoria

**Dónde:** contrato §5.4 y §5.5 (`.agents/specs/F-033.md:755-793`).

A diferencia de R3 (GET `/[id]`, que sí escribe literalmente
`withTenantScope("cliente", { id, deletedAt: null }, negocioId)`), el contrato para PUT y DELETE
solo describe el 404 observable («no existe, es de otro negocio, o está borrado en blando») sin
fijar la forma del `where`. Esto es ambiguo entre dos implementaciones que producen el mismo 200/404
en el camino feliz pero difieren en una ventana de carrera:

- **Correcta:** `prisma.cliente.findFirst({ where: withTenantScope("cliente", { id, deletedAt:
  null }, negocioId) })`, seguido de un `update`/`delete` sobre ese mismo `id` ya verificado.
- **Riesgosa:** `findFirst({ where: withTenantScope("cliente", { id }, negocioId) })` sin
  `deletedAt`, con un `if (existing.deletedAt) return tenantNotFoundResponse()` después en memoria.
  El aislamiento de tenant no se rompe (el `id`+`negocioId` sigue siendo un filtro real), pero se
  abre una ventana de carrera entre esa lectura y la escritura posterior: si otra petición
  soft-elimina la misma fila entre el `findFirst` y el `update`, la segunda petición escribe sobre
  una fila que ya no debería ser editable, porque su propio `where` de escritura no repite el
  `deletedAt: null`.

**Instrucción concreta para el `implementer`:** repetir el mismo `where` compuesto
(`withTenantScope("cliente", { id, deletedAt: null }, negocioId)`) tanto en la lectura de
verificación como, cuando Prisma lo permita sin un segundo roundtrip, en la propia operación de
escritura — o, como mínimo, no tratar `deletedAt` como una comprobación en memoria separada del
`where` que ya resuelve tenant e id.

### 🟠-4 — El orden de evaluación de PUT (404 de pertenencia antes que 409 de nombre duplicado) no está escrito, y debería estarlo aunque no abra una fuga entre tenants

**Dónde:** contrato §5.4 (`.agents/specs/F-033.md:755-771`).

El chequeo de nombre duplicado está acotado al propio `negocioId` del solicitante (contrato: «el
`nombre` nuevo ya lo lleva **otra** fila del **negocio**»), así que invertir el orden respecto al
404 de pertenencia no permite sondear nombres de otro negocio — no es un hallazgo de aislamiento.
Pero si el 409 se evaluara antes que el 404, una petición sobre un `id` ajeno gastaría una consulta
extra (`findFirst` de duplicado) antes de ser rechazada, contra el espíritu explícito de ADR 0077
(«comprobar primero lo barato evita ir a la base por una petición que ya está denegada»). Instrucción
para el `implementer`: pertenencia (404) antes que duplicado (409), en ese orden, igual que
`resolveTenantAxis` ya obliga a permiso antes que pertenencia.

### 🟠-5 — El precedente de `Proveedor` que el spec pide espejar es de antes de `withTenantScope`/`resolveTenantAxis`, y solo su matriz de permisos debe copiarse, no su estilo de código

**Dónde:** spec, «El precedente exacto a espejar: `Proveedor`» (`.agents/specs/F-033.md:132-163`);
código real en `src/app/api/proveedores/route.ts` y `src/app/api/proveedores/[id]/route.ts`.

Leí las cinco rutas reales de `Proveedor` que el spec cita como espejo. Las cinco construyen el
`where` de tenant escribiendo `negocioId: user.negocio.id` **a mano**, no con `withTenantScope`, y
el `GET /api/proveedores/[id]` usa `!user` → 401 en vez del 403 que exige ADR 0077 (ese ADR es de
F-021, posterior a este código de `Proveedor`, y las filas de `routeGuards.json` para
`proveedores/[id]/route.ts` no llevan `corregidaPor` — no fueron alcanzadas por esa corrección).
El contrato de F-033 ya especifica correctamente `resolveTenantAxis`/`withTenantScope` para las
cinco rutas nuevas (§5, línea 696-698: «Ninguno escribe un `NextResponse.json({ error }, { status
})` a mano para un caso que `tenantForbiddenResponse()` o `tenantNotFoundResponse()` ya
construyen»), así que esto **no es un defecto del contrato** — es una advertencia para el
`implementer`, que puede tener el archivo de `Proveedor` abierto como referencia de qué campos
enriquecer y en qué orden hacer las validaciones (usuario asociado, nombre duplicado): copiar esa
lógica de negocio está bien; copiar el `where` escrito a mano o el `401` de esa ruta no.

### 🟠-6 — El enlace «Cuentas por Cobrar» en el menú es cosmético hasta que F-035 exista, y la protección real de ese panel no es responsabilidad de F-033

**Dónde:** contrato §10.3, Entrada A (`.agents/specs/F-033.md:1128-1150`).

Ya está anotado como orden del backlog en el propio spec y contrato (§13, riesgo 2), y el criterio 7
solo exige que el ítem exista, esté gateado por `recuperaciones.cuentasporcobrar.acceder` y esté
situado correctamente — no que la navegación aterrice en una pantalla. Esto es correcto y no exige
cambio en F-033. La única razón para anotarlo aquí es la instrucción explícita del encargo: ocultar
un enlace de menú **no protege una ruta**; cuando F-035 construya `/cuentas-por-cobrar` y
`api/cuentas-por-cobrar/**`, la protección real tiene que estar en el backend de esas rutas nuevas
(sesión + `recuperaciones.cuentasporcobrar.acceder` + `withTenantScope`), con la misma disciplina
que este informe verificó para `api/clientes/**` — no en que el ítem de menú esté oculto para quien
no tiene el permiso. Es una nota para la auditoría de seguridad de F-035, no una corrección de
F-033.

---

## 🟡 Media / informativo

### 🟡-7 — `nombre`/`limit` de la query string de R1 no tienen un schema Zod citado en el contrato

El contrato (§5.1) describe `nombre?: string` y `limit?: number (por defecto y máximo
CLIENTES_LIST_LIMIT)` como parámetros de query, sin nombrar un schema Zod que los valide, a
diferencia de `createClienteSchema`/`updateClienteSchema` para los cuerpos de POST/PUT. No es un
riesgo de inyección (Prisma parametriza el `contains`) ni de aislamiento, pero `AGENTS.md` pide
validar con Zod «antes de persistir» — aquí no se persiste nada, se lee, pero un `limit` no acotado
en el borde (por ejemplo, un string no numérico, o un número negativo) debería fallar de forma
predecible, no depender de que `Number(...)` seguido de un `Math.min` en el código de la ruta lo
haga bien por casualidad. Instrucción para el `implementer`: acotar `limit` explícitamente (`Number`
+ `Math.min(…, CLIENTES_LIST_LIMIT)` + `Math.max(…, 1)` o un `z.coerce.number().int().positive()`
inline) antes de pasarlo a Prisma.

### 🟡-8 — E-057 no aplica hoy, pero queda anotado para cuando F-034 conecte el alta rápida de cliente al flujo de venta a crédito de la APK

`api/clientes/**` no tiene espejo en `api/app/**` en este contrato, y F-033 no toca la APK Flutter.
Si un futuro feature necesita que la app móvil cree o busque clientes directamente (no solo a través
del payload de una venta), quien lo diseñe debe recordar que el Bearer solo vale en `/api/app`
(E-057): un espejo de `api/clientes` bajo `api/app/clientes` necesitaría su propia fila de
`routeGuards.json` con el helper que valida Bearer, no `resolveTenantAxis` tal cual. No es un
hallazgo de F-033.

### 🟡-9 — El `saldo` en la respuesta de POST/PUT (`IClienteUpsertResponse.cliente`, `clienteConSaldoSchema`) siempre vale 0 en los casos que F-033 puede producir, y eso es correcto, no un hueco

Un cliente recién creado no tiene `CuentaPorCobrar` (no existen hasta F-034). Un cliente reactivado
tampoco puede tener deuda viva, porque el único camino para llegar a `deletedAt` no nulo es el
DELETE de R5, que responde 409 y no completa el borrado si hay `CuentaPorCobrar` con `settledAt
IS NULL` — así que todo cliente borrado en blando, por construcción, tiene saldo cero en el momento
de borrarse. No hace falta ningún cambio; lo dejo escrito porque el encargo pide distinguir
confirmación de hallazgo con la misma claridad.

---

## 🟢 Confirmaciones — lo que el contrato ya hace bien y no requiere cambios

1. **Las cinco rutas resuelven tenant con la puerta correcta.** `Cliente` no llega con `tiendaId`
   en el path, así que Gate B (`resolveTenantAxis`) es la puerta que corresponde, no Gate A
   (`assertTiendaTenant`) — y el contrato la usa en las cinco, nunca escribe `negocioId` a mano.
2. **El 404 de ADR 0077 es uniforme y no se convierte en oráculo por otra vía.** Verificado
   ruta por ruta (arriba): ningún 409 cita el `id`, el nombre o el estado de la fila ajena o
   colisionada; los cuerpos de error son strings fijos o plantillas con un número, nunca el mensaje
   de una excepción (E-031); no hay una vía de tiempo de respuesta diferencial entre «no existe» y
   «es de otro negocio», porque ambas causas hacen la misma única consulta antes de responder.
3. **Ningún `where` es una mención (E-042).** Verificado contra el schema real: `Cliente.negocioId`
   es columna propia (`TENANT_RELATION_PATH.cliente = []`); `CuentaPorCobrar.tiendaId` es una FK
   real a `Tienda` (`TENANT_RELATION_PATH.cuentaPorCobrar = ["tienda"]`), no una columna homónima
   sin relación. Las anotaciones de invariante que F-031-seguridad pidió (B1, B2) siguen escritas en
   `prisma/schema.prisma:1417-1424` y `1492-1497`, tal como F-032-seguridad ya confirmó.
4. **No hay un segundo eje de idempotencia (E-043).** ADR 0114 reutiliza
   `@@unique([nombre, negocioId])` — compuesto con tenant — para la reactivación, exactamente lo
   que E-043 exige y lo que el dosier §11 anota como lección aprendida de este mismo epic.
5. **`createClienteSchema`/`updateClienteSchema` no admiten mass assignment.** Ningún campo de
   control (`id`, `negocioId`, `deletedAt`, `createdAt`) es aceptable desde el cuerpo; las cotas de
   longitud (200/300/300/40) ya están fijadas por F-031 y F-033 no las redefine.
6. **El cableado de permisos (ADR 0116) no arrastra nada por accidente.** Verificado en
   `src/utils/getPermisosUsuario.ts:54-68`: `tienePermiso` compara con `.includes()` sobre un array
   separado por `|` — coincidencia exacta de string, no de prefijo — así que
   `configuracion.clientes.acceder` en la plantilla `vendedor` no habilita ningún otro permiso de
   `configuracion.*` por sustring. `recuperaciones.cuentasporcobrar.acceder` queda solo en
   `administrador`, sin excepción.
7. **La entrada de menú gateada por `recuperaciones.cuentasporcobrar.acceder` es efectivamente solo
   cosmética hoy** (no hay pantalla ni API detrás todavía), y el contrato lo anota como orden del
   backlog, no como defecto — correcto, ver 🟠-6 para la nota de cara a F-035.
8. **`routeGuards.json`: las cinco filas declaradas coinciden exactamente con las cinco rutas
   reales.** `clientes/route.ts` (GET, POST) + `clientes/[id]/route.ts` (GET, PUT, DELETE) — cinco
   pares `(ruta, verbo)`, ninguno de más ni de menos, verificado contra los cinco bloques JSON
   literales del propio contrato (§6, `.agents/specs/F-033.md:794-892`). El censo
   `routeGuardInventory.test.ts` (criterio 5) es la red que además lo hace no depender de que esta
   auditoría lo vuelva a mirar cada vez.
9. **El 500 usa una constante fija, nunca el mensaje de la excepción** (§5.1, línea 719) — correcto
   contra E-031, y ya escrito en el contrato sin que este informe tenga que pedirlo.
10. **`Cliente.reactivar` (ADR 0114) no reabre `CuentaPorCobrar`.** La reactivación solo toca
    `deletedAt` y los campos del cuerpo; ninguna cuenta histórica cambia de dueño ni de estado. El
    `id` se conserva, así que las deudas ya saldadas siguen apuntando al mismo cliente — correcto y
    consistente con la decisión de F-031.

---

## Veredicto

**No hay ninguna fuga de datos entre tenants alcanzable, ningún modelo mal formado, ninguna entrada
de `TENANT_RELATION_PATH` incorrecta y ninguna decisión de producto que reabrir.** Las cinco rutas
filtran de verdad por `negocioId` — vía columna propia o vía FK real, nunca por mención — y los
cinco códigos de respuesta siguen el mapeo normativo de ADR 0077 sin abrir un oráculo de existencia
por una vía lateral.

**Sí hay dos huecos que obligan a enmendar el contrato antes de lanzar el paso 5**, ninguno de los
dos por una fuga alcanzable hoy, los dos porque son la clase de garantía que un feature posterior
(F-034, F-035, F-037) va a asumir por lo que lea escrito, no por releer esta auditoría — el mismo
argumento que ya sostuvo los hallazgos B1/B2 de F-031 y H1/H2/H3 de F-032 en este mismo epic:

- **🔴-1**: el `arch-guardian` tiene que escribir, en §5.1, si el `saldo` sin permiso es una
  decisión aceptada a propósito (y por qué) o si debe acotarse el campo — no la ruta, que ya está
  cerrada — a un permiso.
- **🔴-2**: el `arch-guardian` tiene que decidir, en §8.1, si `clientesStore.clear()` se conecta al
  `signOut()` de `src/components/Layout.tsx:903` (recomendado) o si el riesgo residual en
  dispositivo compartido se acepta por escrito con el mismo argumento que ya usó ADR 0115 para el
  cambio de negocio.

Ninguno de los dos cambia una firma, un tipo o una decisión de producto ya cerrada del contrato:
los dos caben como texto adicional en secciones que ya existen. El resto de los hallazgos (🟠-3 a
🟠-6, 🟡-7 a 🟡-9) son instrucciones directas para el `implementer` y no requieren que el
`arch-guardian` vuelva a tocar el contrato, aunque plegarlas ahí también sería barato.

**Resumen numérico:** 2 hallazgos que obligan a enmendar el contrato antes del paso 5 (ninguno es
una fuga alcanzable hoy; los dos son decisiones de sensibilidad de datos sin escribir) · 4 de alta
severidad como instrucciones directas al `implementer`, no bloqueantes · 3 informativas · 10
confirmaciones explícitas de que el aislamiento multi-tenant, la autorización en backend y el
manejo del 404/409 ya son correctos en los puntos que el encargo pedía verificar ruta por ruta.
