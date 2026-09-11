# ADR 0119: Vender a crédito no estrena permiso, y el POS puede dar de alta un cliente sin `configuracion.clientes.acceder`

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-034 (vender a crédito en el POS)

> Fija la puerta de las dos rutas de venta ahora que una de ellas puede **escribir en `Cliente`**.
> Es la decisión menos evidente del feature, porque el cambio no está en lo que la ruta devuelve
> sino en lo que puede crear.

## Contexto

Las dos rutas de venta —`POST /api/venta/[tiendaId]/[cierreId]` y su espejo
`POST /api/app/venta/[tiendaId]/[periodoId]`— corren hoy con `permisoRequerido: null`. Sus filas de
`src/constants/routeGuards/routeGuards.json` lo declaran como `"permisoAusenteMotivo":
"deuda-f021"`, con el motivo escrito: «la venta nunca exigió uno» (ADR 0078). La guarda que sí
tienen es de tenant: `assertTiendaTenant` comprueba que la tienda del path pertenece al negocio de
la sesión antes de leer o escribir nada.

F-034 les añade dos capacidades:

1. Persistir `Venta.creditoBase` y `Venta.clienteId`, y crear una `CuentaPorCobrar`.
2. **Crear o reactivar una fila de `Cliente`** cuando una venta offline llega nombrando a un cliente
   que no existe (decisión de producto 6 del dosier).

La segunda es la que abre la pregunta. Dar de alta un cliente por la puerta de la pantalla
—`POST /api/clientes`— exige `configuracion.clientes.acceder` (F-033, § 5.2). Si la ruta de venta
puede hacerlo sin ese permiso, hay dos caminos con dos puertas distintas para el mismo efecto.

Los datos que acotan la decisión:

- El **ADR 0116** reparte `configuracion.clientes.acceder` a `vendedor` y a `administrador`, y **no**
  a `almacenero`. El almacenero no usa el POS.
- Pero un permiso se asigna **por usuario y por tienda**, no por plantilla: las plantillas son el
  punto de partida, no una garantía. Hay usuarios que operan el POS hoy y cuya cadena de permisos se
  fijó a mano antes de que `configuracion.clientes.acceder` existiera, así que **no la tienen y
  nunca la van a tener sin que alguien los edite uno a uno**.
- La venta es la operación más caliente del producto y la que tiene una cola offline detrás. Un 403
  nuevo en esa ruta no se manifiesta como un mensaje: se manifiesta como una venta que el cajero ya
  cobró y que la cola no consigue sincronizar. Y **`isPermanentSyncError` clasifica un 403 como
  permanente**, así que la venta se aparcaría sin reintento.
- Peor: `src/lib/axiosClient.ts` **sustituye el cuerpo de cualquier 403** por un error genérico de
  permisos (**E-009**), así que el POS ni siquiera podría decir cuál de los dos permisos falta.
- El alta desde el POS es **mucho más estrecha** que la de la pantalla: escribe `nombre` y
  `negocioId`, nada más, y solo puede ocurrir como efecto de una venta a crédito que ya pasó la
  guarda de tenant, la de período abierto y la invariante de crédito.
- Y F-033, § 5.1, ya dejó escrito —tras la auditoría del `security-guardian`— que **el saldo por
  cliente no es un dato protegido**: los dos GET de `/api/clientes` lo devuelven sin permiso, a
  propósito, porque quien va a fiar necesita saber cuánto debe ya esa persona. Que el selector del
  checkout muestre ese saldo no estrena exposición ninguna.

## Decisión

**Las dos rutas de venta conservan `permisoRequerido: null`. Vender a crédito no exige ningún
permiso nuevo, y el alta de cliente que provoca una venta offline tampoco exige
`configuracion.clientes.acceder`.**

Lo que sí se hace, y es la contrapartida:

- Se reescribe el `motivo` de las **dos filas `POST`** de `routeGuards.json` para que diga que el
  cliente de una venta a crédito se resuelve con `withTenantScope` y que la `CuentaPorCobrar` hereda
  el `tiendaId` ya validado de la `Venta`. El censo de `src/__tests__/routeGuardInventory.test.ts`
  compara los pares (ruta, verbo) y no cambia: F-034 **no añade ninguna fila**.
- Los demás campos de esas dos filas —`permiso`, `permisoAusenteMotivo`, `tenantModel`,
  `tenantParam`, `corregidaPor`— no se tocan.
- No se añade ninguna clave a `permisos.json` ni a `permisos.templates.ts`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Exigir `configuracion.clientes.acceder` en las dos rutas de venta | Cierra **la venta entera**, no solo el crédito, para todo usuario que no lo tenga. Y no falla de forma legible: `isPermanentSyncError` aparca la venta con un 403, y el interceptor de `axiosClient` borra el cuerpo del 403 (E-009), así que el cajero ve «no tienes permisos» sobre una venta que ya cobró y nadie puede decir cuál falta |
| Exigirlo **solo cuando `creditoBase > 0`** | Una guarda condicional sobre el contenido del cuerpo en la ruta más caliente del producto, para un caso que ningún criterio de aceptación ejercita: es **E-032**, una rama más ancha de lo que el contrato pide y que nadie va a probar. Y el modo de fallo sigue siendo el mismo: una venta ya cobrada que no sincroniza |
| Exigirlo solo para el alta por nombre (`action: "CREATE"`) | La condición sería aún más profunda —dentro de la resolución del cliente, después de dos consultas— y el efecto para el cajero, idéntico: la venta a crédito que hizo sin conexión no entra, y no puede hacer nada al respecto desde el POS |
| Estrenar un permiso propio, `pos.vender.credito` | Nace en `false` para todos los usuarios existentes: el día del despliegue nadie puede vender a crédito hasta que un administrador edite las plantillas y las cadenas por usuario. Es una puerta que no protege de nada nuevo —la venta a crédito ya está detrás de la guarda de tenant y de la del período— a cambio de un despliegue que rompe la funcionalidad que acaba de entregarse |
| Dejar el `motivo` de las dos filas como está | El campo describe **qué se acota y con qué**, y a partir de este feature se acota una cosa más. Un `motivo` que no menciona la resolución del cliente hace que la próxima auditoría de tenant tenga que releer la ruta entera para saberlo — y peor, invita a marcarla como protegida por haber encontrado la palabra `negocioId` en otro sitio (**E-042**) |

## Consecuencias

**A favor:**

- El despliegue no rompe a nadie: todo usuario que hoy puede vender puede seguir vendiendo, y a
  crédito.
- No hay dos puertas para el mismo efecto por accidente: hay dos puertas **a propósito**, con
  alcances distintos y escrito por qué. La de la pantalla crea un cliente completo —descripción,
  dirección, teléfono— y exige permiso; la de la venta crea un cliente con **solo su nombre** como
  efecto de una operación que ya pasó tres guardas.
- La superficie que se abre es acotada y verificable: la ruta escribe `nombre` y `negocioId`, en su
  propio negocio, y nada más. Una reactivación desde aquí conserva los campos que la fila ya tenía.

**En contra / coste asumido:**

- **Un usuario sin `configuracion.clientes.acceder` puede hacer que nazca una fila de `Cliente`.**
  Es el coste real de la decisión y se acepta a ojos abiertos. Lo que puede provocar es que aparezca
  un cliente con un nombre mal escrito en el catálogo del negocio — el mismo riesgo que el dosier ya
  asume al decir que dos nombres parecidos siguen creando dos clientes y que fusionarlos es deuda de
  F-033.

  > **Enmienda del 2026-09-09** (hallazgo H1 de `.agents/F-034-seguridad.md`). Esa frase evaluaba
  > la consecuencia **de menos**. En la misma operación en que F-034 abre este escritor sin permiso,
  > lleva el campo a un puerto con acceso a la impresora física, y la cadena que se escribe no era
  > texto inofensivo: era **una cadena que puede controlar hardware de caja**. La consecuencia no
  > es «un nombre mal escrito en el catálogo», es eso **más** la posibilidad de abrir el cajón
  > portamonedas o dejar la impresora en otro estado, con una secuencia ESC/POS embebida en el
  > nombre. **La decisión de este ADR no cambia** —la ruta sigue sin permiso, y las razones de
  > abajo se sostienen enteras—, pero deja de sostenerse sola: el riesgo lo cierra el **ADR 0120**,
  > que rechaza esas cadenas en la puerta y las retira del ticket. Los dos ADR se leen juntos.
- **No hay ninguna cota al número de clientes que un cajero puede crear vendiendo.** Cada alta
  requiere una venta a crédito completa —con productos, con existencia y dentro del período
  abierto—, así que el abuso cuesta tanto como falsear ventas, que es un problema mayor y anterior.
  No se añade un límite artificial que ningún criterio pide (E-032).
- **La decisión queda anclada al ADR 0078.** Si algún día se decide que la venta sí exige permiso,
  este ADR hay que revisarlo con él: el argumento de aquí no es «el crédito es inocuo», es «la venta
  no tiene puerta de permiso y el crédito no es el sitio para estrenarla».

**Impacto en seguridad y escalabilidad:**

- **El aislamiento multi-tenant no se relaja en ningún punto**, y es lo que sostiene toda la
  decisión: `assertTiendaTenant` ya comprobó que la tienda es del negocio de la sesión, y las cuatro
  operaciones sobre `Cliente` —las dos lecturas y las dos escrituras— van acotadas con
  `withTenantScope("cliente", …, negocioId)` sobre ese mismo `negocioId`, que nunca sale del cuerpo
  de la petición. Un `clienteId` de otro negocio no resuelve y la venta se rechaza con 409. Lo que
  este ADR acepta es una **capacidad dentro del propio negocio**, no un cruce entre negocios.
- La `CuentaPorCobrar` hereda su `tiendaId` de la misma variable ya persistida como `Venta.tiendaId`
  (ADR 0117): es la única vía por la que `TENANT_RELATION_PATH.cuentaPorCobrar` llega a `negocioId`.
- **Este ADR tuvo su segunda lectura del `security-guardian`** (`.agents/F-034-seguridad.md`,
  2026-09-09), y valió la pena: la auditoría confirmó que el aislamiento entre negocios se sostiene
  y que ningún 409 filtra existencia, y encontró **lo que este ADR no había evaluado** — que el
  campo que esta ruta permite escribir sin permiso acaba en la impresora sin ningún escape. Es la
  demostración de por qué el punto donde una ruta sin permiso gana capacidad de escritura sobre una
  entidad nueva tiene que verse escrito y no deducirse del diff. Ver **ADR 0120**.
- Escalabilidad: sin efecto. La decisión no añade ni quita consultas.
- Reversión: barata. Volver atrás es poner un `permisoRequerido` en dos rutas y una fila en dos
  archivos de permisos; no hay dato que migrar.
