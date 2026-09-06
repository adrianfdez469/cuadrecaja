# ADR 0076: El eje de tenant se resuelve en un módulo propio, `src/lib/tenantScope.ts`, y no ampliando `assertNegocioAccess`

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

F-018 puso una puerta de **autenticación** delante de `/api/`. Autenticación no es autorización por
tenant: aplicando el método de triaje del spec, **39 verbos HTTP repartidos en 31 archivos**
identifican la fila que leen o escriben **solo por un id que llega en la URL, en la query o en el
cuerpo**, sin comprobar que esa fila pertenezca al negocio de la sesión.

> **Corrección del 2026-09-05, tras la auditoría del `security-guardian`.** La primera versión de
> este ADR decía 27 en 21 archivos, porque el triaje eximía en bloque las 49 rutas de la allowlist de
> F-018. La exención era falsa: F-018 documentó que esos endpoints «lo validan por su cuenta llamando
> a `getSessionFromRequest()`», lo que resuelve **identidad y nada más**. Al re-aplicar el método a
> los 21 verbos de `src/app/api/app/` aparecen **10 más**, con el mismo patrón. Que el error tuviera
> la misma forma que el bug de origen —`transfer-destinations` protegía el `POST` y no el `GET`; la
> allowlist protegía la identidad y no el tenant— es lo que lo hace instructivo: **una exención en
> bloque es una clasificación sin hacer**. El detalle está en `.agents/specs/F-021.md` § 0.1 y § 0.3.
>
> Nada de la decisión técnica cambia: `getSessionFromRequest` devuelve `Promise<Session | null>`
> (`src/utils/authFromRequest.ts:17`), que es la forma que estas funciones ya reciben.

El repertorio de guardas que ya existe no cubre ese caso, y conviene decir con precisión por qué —
la tentación es reutilizar la que más se le parezca:

| Helper | Qué resuelve | Por qué no sirve aquí |
|---|---|---|
| `assertNegocioAccess` (`src/lib/appNegocioAccess.ts`) | Identidad + pertenencia al negocio | Recibe el `negocioId` **ya resuelto**. En 37 de los 39 verbos el eje llega como `tiendaId`, o ni siquiera llega: la fila se direcciona por su propio id. Además nunca resuelve permiso, y su denegación sin sesión es un **401** (ver ADR 0077) |
| `assertNegocioConfigAccess` / `...ReadAccess` (`src/lib/negocioConfigAccess.ts`) | Lo anterior + `PERMISO_CONFIGURACION_NEGOCIO` | El permiso está **fijo** en el helper. Es la guarda de la configuración del negocio, no una guarda general |
| `assertTiendaOnlineAccess` / `...All` (`src/lib/tiendaOnline/tiendaOnlineAccess.ts`) | Sesión + interruptor `tiendaOnlineHabilitada` + permiso | Evalúa el interruptor del módulo de tienda online, que en estas 31 rutas no aplica y que además **debe evaluarse primero** (ADR 0028): reutilizarlo aquí obligaría a colar un `moduleEnabled: true` mentiroso |
| `resolveTiendaOnlineOrderScope` + `decideTiendaOnlineOrderManage` (`tiendaOnlineOrderAccess.ts`) | Alcance por tienda dentro del negocio, con permiso por `UsuarioTienda` | Es la guarda de la bandeja de pedidos; su permiso es `TIENDA_ONLINE_PERMISOS.pedidosGestionar`, fijo |
| `resolveReportScope` (`src/lib/reports/scope.ts`) | Sesión + permiso + tienda + **rango de fechas** | El rango es obligatorio y se lee de la query; ninguna de las 31 rutas lo tiene. Y su rama de `SUPER_ADMIN` consulta `{ id: tiendaId }` **sin filtro de negocio** (`src/lib/reports/scope.ts:57-61`), que es justo lo contrario de lo que este feature necesita |

Es decir: hay cinco guardas y **ninguna** responde a la pregunta que hacen falta 39 veces —
*«¿esta tienda, o esta fila colgada de una tienda, es del negocio de quien pregunta?»*.

Ampliar `assertNegocioAccess` para que además aceptara un `tiendaId` y un permiso opcional cambiaría
la firma de un helper con tres llamadores ya verificados, dos de ellos en `/api/app/*` (la APK), y el
spec deja fuera de alcance rediseñar los helpers existentes.

## Decisión

Se crea **`src/lib/tenantScope.ts`**, un módulo nuevo con la forma que ya usan sus vecinos —núcleo
**puro y síncrono** que decide, envoltura `async` que consulta— y que **reutiliza el vocabulario
existente en vez de reescribirlo**:

1. **El eje de tenant es siempre `session.user.negocio.id`.** Nunca un `negocioId` que venga del
   path, la query o el cuerpo. `movimiento/import` es el caso que lo obliga: hoy toma
   `data.negocioId` del cuerpo y valida el `localId` **contra ese mismo valor**, con lo que la
   comprobación no aísla nada.
2. **Dos formas de aplicación, y solo dos**, porque el schema solo ofrece dos caminos al tenant:
   - Cuando el `tiendaId` llega en la petición → la guarda `assertTiendaTenant`, que lee `Tienda` de
     la base de datos y comprueba `negocioId`.
   - Cuando la fila se direcciona por su propio id → **la cláusula de tenant se pliega dentro de la
     propia consulta** con `withTenantScope`, y «no hay fila» y «la fila es de otro» se vuelven
     indistinguibles y devuelven lo mismo (ADR 0077). Sin segunda consulta y sin ventana entre
     comprobar y usar.
3. **El camino de cada modelo hasta `Tienda` se declara una sola vez**, en la constante
   `TENANT_RELATION_PATH`, derivada de `prisma/schema.prisma`. Es la pieza que hace que el criterio
   6 se pueda comprobar sin base de datos (ADR 0080).
4. **`session.user.locales` no se usa jamás** como fuente del alcance: viaja horneado en el JWT desde
   el login y no sigue una asignación ni una revocación posterior (E-021). La autoridad es la fila de
   `Tienda`, exactamente como ya razona `resolveTiendaOnlineOrderScope`.
5. **SUPER_ADMIN no es una excepción al eje**: se compara contra `session.user.negocio.id` igual que
   todos, que es lo que ya hace `assertNegocioAccess` y lo que su test fija explícitamente
   (`src/__tests__/negocioConfigAccess.test.ts`: 403 al SUPER_ADMIN de otro negocio). El
   SUPER_ADMIN cambia de negocio cambiando el de su sesión, no saltándose el filtro.

   > **Y hay un contraejemplo vivo, que este ADR no puede tapar.** `resolveReportScope`
   > (`src/lib/reports/scope.ts:57-61`) resuelve la tienda de un `SUPER_ADMIN` con `{ id: tiendaId }`,
   > **sin filtro de negocio**: es exactamente la excepción que este principio niega. Queda fuera de
   > F-021 porque el spec excluye rediseñar helpers existentes, pero **no se deja como nota al pie**:
   > un principio y su contraejemplo conviviendo sin fecha de caducidad es la forma en que un
   > principio deja de creerse. Va como **feature de seguimiento redactado** en
   > `.agents/specs/F-021.md` § 11, para que el humano lo lleve al backlog. Si ese feature no se
   > abre, lo honesto es quitar este principio 5, no dejar los dos.

La firma exacta vive en `.agents/specs/F-021.md` § *Contrato de interfaces*.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ampliar `assertNegocioAccess` con `tiendaId` y permiso opcionales | Cambia la firma de un helper con tres llamadores ya verificados, dos en la superficie de la APK. El spec excluye rediseñar helpers existentes, y un cambio así obliga a re-verificar `/api/app/*` sin que este feature lo pida |
| Reutilizar `resolveReportScope` para todo | Exige un rango de fechas que estas rutas no tienen; devuelve **401** cuando falta el permiso (E-007: `axiosClient` desloguea); y su rama de `SUPER_ADMIN` no filtra por negocio. Adoptarlo propagaría los tres defectos a 39 verbos |
| Resolver el tenant en el middleware, extendiendo la puerta de F-018 | El middleware solo ve la ruta; no sabe qué modelo consulta el handler ni por qué campo. Tendría que replicar el mapa de rutas a modelos, un segundo sitio que se desincroniza. Y F-018 está cerrado |
| Una comprobación previa (`findFirst` de la tienda) también para las filas direccionadas por su id | Dos viajes a la base por petición y una ventana entre comprobar y usar. Plegar la cláusula en la consulta es más barato y no tiene ventana |
| Un `Prisma.$extends` global que inyecte `negocioId` en todo `where` | El cliente es un singleton compartido por crons, webhooks de QAB, seeds y la APK, que legítimamente operan sin sesión. Un filtro implícito y global rompe esos usos y, peor, hace **invisible** en el código de cada ruta si el aislamiento se aplicó — justo lo que este feature quiere volver auditable |
| Restringir además a las tiendas **asignadas** al usuario (`usuario: { some: { id } }`), como hace `resolveReportScope` | Es más estricto que aislar tenants y por tanto **puede quitar funcionalidad**: un traspaso nombra una tienda destino del negocio a la que el usuario no está asignado. El criterio 5 existe precisamente para eso. Se deja como endurecimiento posterior, no como parte de este feature |

## Consecuencias

**A favor:**
- Una sola definición de «pertenece a mi negocio», citable desde el inventario y desde los tests.
- El camino de cada modelo hasta `Tienda` deja de estar escrito a mano en cada `where` y pasa a estar
  en una constante — la lección de E-014 aplicada al aislamiento.
- El núcleo es puro: se comprueba sin Postgres, que es lo único que la suite de este repo sabe hacer.
- No toca ninguno de los cinco helpers existentes, así que nada ya verificado se re-verifica.

**En contra / coste asumido:**
- Un sexto helper de autorización en un repo que ya tiene cinco. Se mitiga escribiendo en el
  docstring de `tenantScope.ts` la tabla de arriba: cuándo usar este y cuándo cada uno de los otros.
- `withTenantScope` obliga a que cada consulta corregida diga a qué modelo pertenece. Es
  deliberado: un modelo no declarado en `TENANT_RELATION_PATH` no compila, en vez de aislar mal en
  silencio.

**Impacto en seguridad y escalabilidad:**
- Cierra 39 vías de fuga entre negocios, 15 de ellas de **escritura** (ventas ajenas, stock ajeno,
  costos históricos ajenos, asignaciones de usuario ajenas).
- Coste de consulta: `assertTiendaTenant` añade **un** `findFirst` sobre `Tienda` por petición,
  con `select: { id: true, negocioId: true }`, por la clave primaria. La vía plegada añade **cero**
  consultas: solo un `where` más específico, que estrecha el plan en vez de ensancharlo.
- Se deja escrito un límite conocido que este feature **no** cierra: la rama de `SUPER_ADMIN` de
  `resolveReportScope` sigue alcanzando la tienda de cualquier negocio. Está fuera del alcance del
  spec y queda anotado en el inventario como desviación conocida, no como ruta protegida sin más.
