# ADR 0067: Los seis claims del SSO salen enteros de la sesión de NextAuth, y `storeIds` se acota a los locales de tipo `TIENDA` del propio negocio

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-009
**Se apoya en:** ADR 0005 de QAB (`$QAB_DOCS_PATH/adr/0005-dos-sistemas-de-auth.md`) ·
[E-021](../../.agents/errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md)

## Contexto

QAB fija la forma de la aserción y cuadrecaja solo la acata (`$QAB_DOCS_PATH/despliegue.md` § 8.4):
un JWT de ~60 s con `jti`, `sub`, `name`, `email`, `businessId` y `storeIds`. Lo que el documento de
QAB **no** dice es de dónde saca cuadrecaja cada uno de esos valores, y dos de los seis tienen una
procedencia que no es evidente.

**`email` no tiene columna.** El modelo `Usuario` de `prisma/schema.prisma` no declara ningún campo
`email` ni `correo`. Lo que hace de correo es `Usuario.usuario`: `POST /api/usuarios` lo valida con
`EMAIL_REGEX` antes de crear la fila, y los flujos de invitación y de restablecimiento lo pasan
literalmente como `invitadoEmail` y `creadorEmail` hacia los webhooks de n8n. Es decir, el correo
del usuario existe, pero vive en la columna que se llama `usuario`. Quien busque `Usuario.email`
para rellenar el claim no lo encuentra, y quien lo dé por perdido concluirá —mal— que hace falta una
migración.

**`storeIds` tiene dos fuentes posibles y no dan siempre lo mismo.** La lista de locales de un
usuario se calcula en `src/utils/authOptions.ts` **en el momento del login** —para `SUPER_ADMIN`,
todas las tiendas del negocio; para el resto, las de su `UsuarioTienda`— y queda embebida en el JWT
de la sesión (`session.user.locales`). No se recalcula en vivo: eso es exactamente
[E-021](../../.agents/errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md). La
alternativa es consultar `UsuarioTienda` en el instante de emitir el enlace, lo que daría una lista
más fresca que la sesión que la pide.

Y hay un tercer detalle que ninguna de las dos fuentes resuelve sola: un `ALMACEN` **nunca** llega a
ser un `Store` de QAB. `listTiendaOnlineLocales` lo devuelve con `publishable: false`,
`setTiendaOnlinePublicacion` lo rechaza con `TiendaOnlineAlmacenError`, y la fase de aprendizaje de
slug (`src/lib/qab/slugLearn.ts`) filtra por `tipo: TipoLocal.TIENDA`. Su `id` es un identificador
válido de cuadrecaja que del otro lado no corresponde a nada.

## Decisión

**Los seis claims se leen de `session.user` y de nada más. No hay ninguna consulta a la base en la
emisión del token.**

| Claim | Origen exacto |
|---|---|
| `jti` | `randomUUID()`, uno nuevo por emisión |
| `sub` | `session.user.id` |
| `name` | `session.user.nombre` |
| `email` | `session.user.usuario` — la columna que hace de correo |
| `businessId` | `session.user.negocio.id` |
| `storeIds` | `session.user.locales`, filtrada |

El filtro de `storeIds` tiene **dos condiciones unidas por Y**, y se implementa con las dos
(E-032). Entra el `id` de un local si y solo si:

1. `local.negocioId === businessId`, y
2. `local.tipo === TipoLocal.TIENDA`.

Se conserva el orden de aparición y se descartan los duplicados quedándose con la primera
aparición. Una lista resultante vacía **se emite igual**: cuadrecaja no modela las reglas de acceso
de QAB, y un `storeIds: []` es una aserción de identidad sin tiendas, no un error.

La condición 1 es defensa en profundidad, no una expectativa: `authOptions` ya construye `locales`
acotada al negocio del usuario, así que hoy no descarta nada. Se escribe porque `businessId` y
`storeIds` son literalmente la frontera entre tenants dentro del token, y porque el filtro está a
una línea del sitio donde se decide qué cruza esa frontera.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Consultar `UsuarioTienda` al emitir, para que la lista sea más fresca que la sesión | Obliga a reproducir aquí la bifurcación de `authOptions`: un `SUPER_ADMIN` no tiene por qué tener filas en `UsuarioTienda`, y una consulta ingenua le devolvería cero tiendas. Eso crea una **segunda fuente de verdad** de «qué locales gestiona este usuario», que es justo lo que se puede desincronizar sin que nada falle. Y no cierra ningún hueco real: mientras la sesión de cuadrecaja siga viva, el usuario **ya** puede operar sobre ese local dentro del propio POS. Un token SSO más estrecho que la sesión que lo pide no le quita nada a nadie; solo hace que el panel y el POS discrepen. |
| Añadir una columna `email` a `Usuario` y migrar los datos | Una migración de esquema para copiar una columna a otra, en un feature cuyo alcance es firmar un enlace. `Usuario.usuario` ya es el correo por validación en el alta y ya se usa como tal en los tres flujos de correo del repositorio. |
| Validar el claim `email` con `z.string().email()` antes de firmar | Las cuentas anteriores a la validación de `EMAIL_REGEX` en el alta pueden tener un `usuario` que no lo sea. Bloquear el SSO de esas cuentas convierte una deuda de datos en una pérdida de acceso, y QAB no publica ningún requisito de formato para ese claim. Se envía verbatim. |
| Mandar todos los locales, `ALMACEN` incluido | El comportamiento de QAB ante un `storeId` que no corresponde a ningún `Store` suyo no está documentado. Mandar ids que **por construcción** no pueden existir del otro lado es apostar a una rama que nadie especificó. |
| Filtrar además por «local ya publicado en QAB» (`slugQab` no nulo, o `tiendaOnlinePublicado`) | Exige leer la base, que es lo que esta decisión evita, y no elimina el caso de un `storeId` desconocido: una `TIENDA` publicada hoy puede no existir todavía del lado de QAB si el outbox no ha drenado. La incertidumbre no se puede cerrar desde aquí, así que no se paga una consulta por reducirla a medias. |

## Consecuencias

**A favor:**

- Cero consultas en la emisión: el endpoint solo lee la base para el interruptor del módulo, que es
  la del gate y ya existía.
- El criterio 6 del backlog —«quitar el acceso a un local en CC lo quita del panel en el siguiente
  inicio de sesión»— se cumple **en su forma literal**, y por la misma razón por la que QAB lo
  escribió así: QAB re-deriva `AdminStoreAccess` en cada canje, y cuadrecaja emite lo que su sesión
  dice. Las dos mitades del sistema comparten el mismo reloj.
- Una sola fuente de verdad de «qué locales gestiona este usuario»: `authOptions`.

**En contra / coste asumido:**

- **Una revocación no surte efecto mientras la sesión de cuadrecaja siga abierta.** Quitado el
  `UsuarioTienda`, ese usuario puede seguir emitiendo enlaces que incluyan el local retirado hasta
  que su sesión caduque (`expCustom`, las 6:00 del día siguiente) o cierre sesión; y la cookie que
  QAB acuñe con ese token vive 12 h más. La ventana máxima es la suma de las dos.

  Se asume porque **no es un hueco que abra este feature**: durante esa misma ventana el usuario
  sigue viendo y operando ese local dentro del POS. Cerrarlo es recalcular los permisos y los
  locales en vivo, lo que afecta a toda la aplicación (E-021) y no cabe en F-009.
- Verificar el criterio 6 exige el orden que E-021 documenta: cambiar la fila **primero** y hacer
  login **después**. Cambiar la fila con la sesión abierta y recargar no enseña nada.
- El `qa` que siembre el caso del criterio 4 («1 de 3 locales») tiene que sembrar **tres locales de
  tipo `TIENDA`**. Con un `ALMACEN` entre los tres, el `SUPER_ADMIN` recibe dos `storeIds` y no
  tres, y eso es lo correcto, no un fallo.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** `businessId` sale de `session.user.negocio.id`, que es la única
  fuente de `negocioId` en todo el módulo, y `storeIds` se filtra contra ese mismo valor. Un local
  de otro negocio no tiene ninguna vía hacia el token: ni el llamador propone `storeIds` (ADR 0069)
  ni la lista sale de ningún sitio que el llamador controle.
- El token **nunca es más ancho que la sesión que lo pide**. Esa es la propiedad que sostiene la
  decisión: cualquier abuso que permita el enlace SSO ya era posible dentro del POS.
- Escalabilidad: la emisión es O(número de locales del usuario) en memoria, sin E/S. No hay consulta
  que pueda degradarse con el crecimiento del negocio.
