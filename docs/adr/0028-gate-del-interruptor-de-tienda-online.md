# ADR 0028: El gate del interruptor de tienda online es una comprobación aparte de los permisos, se evalúa primero y gana a `SUPER_ADMIN`

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-004
**Se apoya en:** [ADR 0016](0016-la-puerta-de-api-valida-solo-la-cookie-de-nextauth.md) ·
[ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md) ·
[ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md)

## Contexto

El módulo «Tienda Online» tiene **dos** condiciones de acceso, y no son de la misma naturaleza:

1. Un permiso del usuario (`tiendaonline.configuracion.acceder`, `tiendaonline.pedidos.acceder`,
   `tiendaonline.pedidos.gestionar`).
2. Que el negocio tenga el módulo contratado: `Negocio.tiendaOnlineHabilitada`, creado en F-001 y
   gobernado por un `SUPER_ADMIN` desde `/configuracion/negocios` en F-003.

El humano resolvió el 2026-09-03 la pregunta que el spec dejó abierta: **el interruptor gana
siempre, `SUPER_ADMIN` incluido**. Con el interruptor apagado la sección no se muestra a nadie y los
endpoints responden 403 también a un `SUPER_ADMIN`, sin excepción de rol. La razón es que con el
negocio apagado no hay nada real detrás del gate —ni token de QAB, ni pedidos, ni tienda
publicada—, así que dejar entrar al `SUPER_ADMIN` solo le enseñaría pantallas vacías.

Y ahí aparece el problema técnico. Las dos funciones que hoy deciden autorización en este
repositorio **empiezan igual**:

```ts
// src/utils/permisos_back.ts
export function verificarPermisoUsuario(permisosUsuario, permisoRequerido, userRol) {
  if (userRol === "SUPER_ADMIN") return true;   // <- bypass total
  return verificarPermiso(permisosUsuario, permisoRequerido);
}
```

`src/utils/permisos_front.ts` hace lo mismo en sus tres métodos. Es decir: **cualquier cosa que se
modele como un permiso queda automáticamente exenta para `SUPER_ADMIN`**. Modelar el interruptor
como un quinto permiso —la solución que parece más barata— produce exactamente lo contrario de la
decisión del humano, y lo produce en silencio: el código se lee bien, el test del `ADMIN` pasa, y el
`SUPER_ADMIN` entra.

Hay además una asimetría que conviene nombrar: el interruptor es del **negocio**, y los permisos son
del **usuario en un local**. `getPermisosUsuario(usuarioId, tiendaId)` devuelve los permisos del rol
que el usuario tiene *en su local actual*. Son dos ejes distintos y meter uno dentro del otro
tampoco encaja conceptualmente.

Existe ya un precedente cercano, `src/lib/negocioConfigAccess.ts`: una guarda que recibe la sesión,
comprueba pertenencia y permiso, y devuelve `NextResponse | null`. Está cubierta por
`src/__tests__/negocioConfigAccess.test.ts`, lo que demuestra que una guarda de este tipo es
testeable sin base de datos siempre que la sesión se inyecte en vez de leerse dentro.

Y hay una restricción de escala: esto no es un `if` de F-004. F-005 (pantalla de configuración) y
F-011 (bandeja de pedidos) van a colgar de la misma puerta, y cada ruta nueva del módulo tendrá que
aplicarla. Copiarla en cada handler garantiza que algún día una copia se quede corta.

## Decisión

**El interruptor se comprueba fuera del sistema de permisos, en una utilidad propia del módulo, y
se evalúa antes que cualquier rama que dependa del rol o de los permisos.**

La utilidad es `src/lib/tiendaOnline/tiendaOnlineAccess.ts`, con cuatro piezas:

```ts
export function decideTiendaOnlineAccess(params: {
  session: Session | null;
  moduleEnabled: boolean;
  permisoRequerido: string;
}): ITiendaOnlineDecision;                       // PURA y síncrona

export function isTiendaOnlineEnabled(negocioId: string): Promise<boolean>;  // la única E/S
export function tiendaOnlineForbiddenResponse(): NextResponse;               // el 403 único
export function assertTiendaOnlineAccess(                                    // lo que llama un handler
  session: Session | null,
  permisoRequerido: string,
): Promise<NextResponse | null>;
```

**El orden es el contrato**, y es lo que este ADR existe para fijar:

1. sin sesión o sin `negocio.id` → denegado (`NO_SESSION`);
2. `moduleEnabled === false` → denegado (`MODULE_DISABLED`), **sin mirar `rol` ni `permisos`**;
3. `verificarPermisoUsuario(...)` — aquí, y solo aquí, `SUPER_ADMIN` sigue teniendo su bypass;
4. permitido.

El paso 2 antes del 3 no es estilo: es lo único que hace que la decisión del humano se cumpla. Si el
paso 3 fuera primero, `SUPER_ADMIN` cortocircuitaría y el paso 2 sería código muerto para el único
rol al que hay que negárselo explícitamente.

**El valor del interruptor se lee de la base de datos en cada petición**, con `select` explícito de
una sola columna (ADR 0019), y **nunca** de la sesión ni de las cabeceras `x-user-*`. El motivo está
en el [ADR 0029](0029-el-interruptor-llega-al-cliente-por-endpoint-propio.md): la copia que ve el
cliente puede estar vieja, y una copia vieja no puede ser una frontera de seguridad.

**El gate del cliente es un gemelo, no el mismo código.** `useTiendaOnlineAccess(permiso)` devuelve
`"loading" | "allowed" | "denied"` aplicando la misma secuencia —interruptor primero— sobre el valor
cacheado en `AppContext` y sobre `usePermisos()`. Es una pista de UI: decide qué se pinta, nunca qué
se autoriza. Compartir una función entre servidor y cliente no era posible sin arrastrar Prisma al
bundle, y tampoco deseable: que sean dos deja claro cuál de las dos manda.

**Las tres razones de denegación colapsan en un único 403** `{ "error": "FORBIDDEN" }`. La razón
interna existe para los tests y para razonar, y no se serializa ni se registra. Distinguirla en el
cuerpo sería trabajo perdido: el interceptor de `src/lib/axiosClient.ts` sustituye el cuerpo de
cualquier 403 antes de que el frontend lo vea (E-009).

**403 y nunca 401**, ni siquiera cuando el handler no encuentra sesión —caso que la puerta de la API
(ADR 0016) ya debería haber cortado—. Un 401 dispara `signOut()` en el interceptor y echa al usuario
de la aplicación (E-007): el único 401 del sistema es el del middleware, y significa solo «no hay
sesión».

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un quinto permiso, `tiendaonline.habilitada`, concedido por rol | `verificarPermisoUsuario` devuelve `true` para `SUPER_ADMIN` en **cualquier** permiso: incumpliría la decisión del humano en silencio. Y un permiso es del usuario en un local; el interruptor es del negocio |
| Añadir la excepción dentro de `verificarPermisoUsuario` (`if (permiso.startsWith("tiendaonline.")) …`) | Mete una regla de un módulo en la función que autoriza **todo** el sistema, y hace que el bypass de `SUPER_ADMIN` deje de ser una regla y pase a ser una regla con asteriscos. El coste de equivocarse ahí se paga en todas las pantallas, no en una |
| Comprobar el permiso primero y el interruptor después | Mismo resultado para un `ADMIN`, resultado **opuesto** para `SUPER_ADMIN` si alguien añade un cortocircuito por rol —que es exactamente el patrón que ya existe en `getMainMenuItemsByLocalType` y en las tres funciones de `usePermisos`. El orden es la defensa |
| Un `if` con la lectura del interruptor copiado en cada handler | Tres rutas hoy, y F-005 y F-011 detrás. La primera copia que se quede corta abre el módulo entero, y no hay nada que lo detecte |
| Aplicar el gate en `src/middleware.ts`, por prefijo de ruta | El middleware corre en el Edge y no tiene Prisma; consultar la base desde ahí en cada petición de página y de API es un coste por navegación. Y mezclaría dos responsabilidades que el ADR 0016 separó a propósito: el middleware dice si **hay sesión**, el handler dice si **te toca** |
| Un `layout.tsx` de servidor en `/tienda-online` que corte el acceso a las dos páginas | Cubre las páginas y **no** cubre las rutas de API, que es donde están los criterios 3, 4 y 5. Haría falta el guardián igualmente, y entonces habría dos |
| Códigos distintos en el 403 según la causa | E-009: `axiosClient` destruye el cuerpo de cualquier 403 y el frontend recibe un `Error` fabricado. Sería un contrato que nadie puede leer. Ningún criterio lo pide |

## Consecuencias

**A favor:**

- La decisión del humano queda expresada en una función pura de siete líneas, y verificable con un
  test unitario sin base de datos: `SUPER_ADMIN` + `permisos: ""` + interruptor apagado →
  `MODULE_DISABLED`.
- F-005 y F-011 heredan la puerta escrita. Añadir una ruta al módulo son dos líneas, siempre las
  mismas, y `grep assertTiendaOnlineAccess src/app/api/tienda-online` dice de un vistazo si alguna
  se la saltó.
- El bypass de `SUPER_ADMIN` sigue intacto **dentro** del módulo habilitado. No se toca
  `permisos_back.ts` ni `permisos_front.ts`, así que ninguna otra pantalla del sistema cambia de
  comportamiento.
- El 403 único hace que el frontend no tenga nada que distinguir, que es justo lo que E-009 permite.

**En contra / coste asumido:**

- **Dos implementaciones de la misma regla**, una en el servidor y otra en el cliente. Pueden
  divergir. Se mitiga con el orden idéntico documentado en las dos y con el hecho de que la del
  cliente no autoriza nada: si diverge, se ve una entrada de menú de más o de menos, nunca un dato
  de más.
- **Una lectura extra a `Negocio` por petición** de las rutas del módulo. Es un `findUnique` por
  clave primaria con `select` de una columna. Se paga a propósito: cachearla reintroduciría el
  problema de la copia vieja que el ADR 0029 evita.
- El repositorio gana un tercer patrón de guarda, junto a `hasSuperAdminPrivileges()` y
  `assertNegocioConfigAccess`. Este ADR es lo que impide que se lea como un descuido.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** el `negocioId` sale siempre de `session.user.negocio.id` y ninguna
  ruta del módulo lo acepta por body, query o path — por eso ninguna necesita comparar con un
  negocio del path. La resolución de un pedido usa la clave compuesta
  `@@unique([id, negocioId])` (ADR 0007), de modo que un pedido de otro negocio y un pedido
  inexistente son indistinguibles ya en la consulta: mismo 404, sin oráculo de existencia.
- **Autorización en el backend:** el gate del menú no protege nada; los cinco criterios se verifican
  con `curl` contra los endpoints precisamente porque la comprobación que cuenta es la del servidor.
- **Escalabilidad:** una lectura indexada por clave primaria por petición, sin `JOIN` y sin
  recorrer `PedidoEntrante`. Ninguna ruta de F-004 devuelve una colección.
- **Reversión:** todo el gate vive en un archivo nuevo y en cuatro rutas nuevas. Quitarlo no deshace
  ninguna migración ni toca ningún dato.
