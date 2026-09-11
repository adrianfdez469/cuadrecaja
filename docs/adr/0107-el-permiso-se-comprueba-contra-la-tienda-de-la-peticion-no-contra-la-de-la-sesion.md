# ADR 0107: El permiso se comprueba contra la tienda de la petición, no contra la de la sesión

**Estado:** aceptado
**Fecha:** 2026-09-08
**Feature:** F-029 (hallazgo del `security-guardian` al revisar su contrato; el arreglo es transversal)

## Contexto

`assertTiendaTenant` (`src/lib/tenantScope.ts`) es el guardián del eje de tenant cuando el
`tiendaId` llega en la petición. Resuelve **dos** cosas y las resuelve contra fuentes distintas:

- **Pertenencia:** lee `Tienda` de la base con `tiendaTenantWhere({ tiendaId, negocioId })`. Correcto:
  el `tiendaId` de la URL se valida contra el negocio de la sesión.
- **Permiso:** llama a `verificarPermisoUsuario(session.user.permisos, ...)`. Y
  `session.user.permisos` es la cadena que `authOptions` calculó **para la tienda `localActual`**
  del usuario al iniciar sesión, con `getPermisosUsuario(user.id, localActualEfectivo.id)`.

`UsuarioTienda` tiene un `rolId` **propio por tienda**: el modelo de datos dice explícitamente que
un usuario puede ser `ADMIN` en una tienda y `VENDEDOR` en otra. Como el permiso se lee de la
sesión y la pertenencia de la URL, un usuario con `operaciones.cierre.cerrar` en su tienda actual
puede ejercerlo sobre **cualquier** tienda del mismo negocio — incluida una a la que no está
asignado en absoluto. No hay fuga entre negocios (la pertenencia sí filtra por `negocioId`), pero
sí entre tiendas.

Es **preexistente y sistémico**: no lo introduce F-029, y no lo cubre el ADR 0078, que trata de
rutas que deliberadamente no piden permiso (`permisoRequerido: null`) — otro mecanismo.

F-029 lo destapa porque estrena una ruta con permiso sobre un `tiendaId` de la URL, y porque su
cierre pasa a insertar y reasignar filas.

## Decisión

**Cuando `permisoRequerido` no es `null`, el permiso se comprueba contra los permisos del usuario
en la tienda que la petición direcciona**, obtenidos con `getPermisosUsuario(usuarioId, tiendaId)`
—la misma función que ya usa `authOptions`—, no contra `session.user.permisos`.

El núcleo puro `decideTenantScope` recibe esa cadena como un parámetro más, `permisosEnTienda`, y
**falla cerrado**: si hay `permisoRequerido` y no llega `permisosEnTienda`, deniega. **No hay
respaldo a los permisos de la sesión**, porque un respaldo reabriría en silencio justo lo que este
ADR cierra. `SUPER_ADMIN` sigue pasando por su rol, sin mirar ninguna cadena, exactamente como
`verificarPermisoUsuario` ya lo resuelve.

El orden dentro de `assertTiendaTenant` pasa a ser: sesión (puro) → pertenencia → permisos de esa
tienda → decisión. Los códigos que ve un cliente legítimo no cambian: tienda ajena **404**, falta
de permiso **403**.

**El módulo tiene dos puertas, y la segunda no puede resolverse igual.** `resolveTenantAxis` es la
puerta de las rutas cuyo `tiendaId` **no viene en la petición**: la fila se direcciona por su propio
id y de qué tienda es no se sabe **hasta haberla leído**. Ahí no hay ningún `tiendaId` con el que
derivar los permisos en el momento de decidir. Por eso:

- `resolveTenantAxis` **pierde el parámetro `permisoRequerido`** y queda reducido a resolver la
  sesión y devolver el `negocioId`.
- El permiso se comprueba **después** de que la ruta resuelva su fila con `withTenantScope`, con un
  envoltorio nuevo del mismo módulo, `assertPermisoEnTienda({ session, tiendaId, permisoRequerido })`,
  que deriva los permisos de esa tienda y decide con el mismo núcleo puro.

Quitar el parámetro, en vez de dejarlo aceptado y sin efecto, es deliberado: un parámetro que sigue
ahí pero comprueba lo que no debe es exactamente la forma del fallo que este ADR corrige, y al
quitarlo las rutas que lo usan **dejan de compilar** hasta adoptar el patrón nuevo. El compilador
hace de censo.

Se corrige **el módulo compartido**, con las rutas que lo usan dentro del alcance. Decisión del
humano del 2026-09-08, que aceptó expresamente que el `qa` tenga que verificarlas.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Arreglarlo solo en la ruta nueva de F-029 | Deja el hueco abierto en las otras siete y crea dos comportamientos distintos para el mismo helper: quien lea una ruta no sabrá cuál de los dos rige |
| Documentarlo como deuda y abrir un feature aparte | El humano lo descartó: es una comprobación de autorización que dice comprobar algo que no comprueba, y la ruta que F-029 estrena la ejercita desde el primer día |
| Que `permisosEnTienda` respalde en `session.user.permisos` cuando no llega | Es el hueco otra vez, ahora con aspecto de arreglo: una ruta que olvidara pasarlo seguiría autorizando de más y nadie lo notaría |
| Expresarlo con una unión discriminada por `permisoRequerido: null` | Con `strict: false` no hay estrechamiento por `null`, y el error saldría como un `TS2339` señalando a la propiedad equivocada (E-036) |
| Recalcular los permisos en cada petición y guardarlos en la sesión | La sesión es un JWT: no se relee en vivo (E-021), y meter ahí los permisos de todas las tiendas la hincha sin resolver el caso de la tienda a la que el usuario no está asignado |
| Mantener el permiso antes de la pertenencia por el ADR 0077 | Aquel orden se justificaba en que el permiso era **puro** y la pertenencia costaba una consulta. Ahora las dos cuestan una: la razón desapareció |
| Dejar `permisoRequerido` en `resolveTenantAxis` comprobando, como hoy, los permisos de la sesión | Es el hueco intacto en la mitad de las rutas, y encima con aspecto de arreglado |
| Dejar `permisoRequerido` en `resolveTenantAxis` y que el núcleo puro falle cerrado sin más | Esas dos rutas devolverían `MISSING_PERMISSION` **siempre**: el arreglo de seguridad rompería en producción dos rutas que hoy funcionan. Es lo que habría pasado si el `dev-tester` no lo encuentra escribiendo contra el contrato |
| Que `resolveTenantAxis` reciba un `tiendaId` opcional del llamador | Sirve para `locales/[id]`, donde el id del path **es** la tienda, y no sirve para la liquidación de consignación, donde la tienda está dentro de una fila que aún no se ha leído. Media solución que parece entera |

## Cómo se cerró el censo, y qué quedó fuera

La primera versión de este ADR contó **7 rutas** buscando `permisoRequerido: "` y las atribuyó
todas a `assertTiendaTenant`. Era una coincidencia de texto tomada por una clasificación
(**E-042**) sobre un censo recorrido a medias (**E-035**): dos de esas siete son de la otra puerta,
y son justamente las que el arreglo habría roto. Lo encontró el `dev-tester` al escribir contra el
contrato, no una revisión.

El censo definitivo se hizo recorriendo **cada punto de llamada de las dos funciones**:

| Puerta | Puntos de llamada | Archivos | Con `permisoRequerido: null` | Con permiso |
|---|---|---|---|---|
| A — `assertTiendaTenant` | 39 | 25 | 34 | **5** |
| B — `resolveTenantAxis` | 8 | 6 | 6 | **2** |

Más la ruta que estrena F-029: **10** puntos de llamada con permiso en total, y **40** que no
cambian ni de comportamiento ni de consultas.

**Y lo que queda fuera, con su número, en vez de un "el resto ya está cubierto":**
`verificarPermisoUsuario` y `verificarPermisosUsuario` se llaman **77 veces en 51 archivos** de
`src/app/api` y `src/lib`, casi siempre leyendo `session.user.permisos` sin pasar por este módulo.
Este ADR cierra **las dos puertas de `tenantScope.ts`**, que es lo que el humano decidió, y deja el
resto de esa superficie con la misma forma del fallo. Es candidato a feature propio; hasta
entonces, quien escriba una ruta nueva debería entrar por una de las dos puertas.

## Consecuencias

**A favor:**

- Un permiso concedido en una tienda deja de valer en las demás. Es lo que el modelo de datos
  siempre dijo y lo que el código no cumplía.
- La regla queda en **un** sitio, el módulo que ya es el guardián del eje de tenant.
- La respuesta a "¿por qué esta ruta autoriza?" pasa a ser comprobable leyendo el helper, sin tener
  que reconstruir mentalmente de qué tienda venían los permisos de la sesión.

**En contra / coste asumido:**

- **Una consulta más** (`findUnique` sobre `UsuarioTienda`) en los puntos de llamada que piden
  permiso. Medido: de los **39** puntos de llamada en **25** archivos, **32 pasan
  `permisoRequerido: null`** y no ejecutan nada nuevo; solo **7**, más la ruta que estrena F-029,
  pagan la consulta.
- **Hay un cambio de comportamiento observable, y es el objetivo:** un usuario con roles distintos
  en dos tiendas del mismo negocio pasa de recibir 200 a recibir 403 sobre la tienda donde no tiene
  el permiso. Si alguien dependía de eso, dependía del fallo.
- **El administrador no asignado pierde acceso, y se decidió que así se queda.** `locales/[id]` PUT
  configura una tienda y sus asignaciones de usuarios; con la regla nueva hace falta el permiso **en
  esa tienda**, y `getPermisosUsuario` devuelve cadena vacía cuando no hay fila de `UsuarioTienda`,
  así que un administrador del negocio **no asignado** a una tienda deja de poder configurarla (200
  → 403). `verificarPermisoUsuario` solo exime a `SUPER_ADMIN`.

  **Decisión del humano del 2026-09-08: regla estricta, sin exención por rol para `ADMIN`.** Es el
  comportamiento esperado, no un daño colateral que haya que vigilar. Si algún día el negocio
  necesita lo contrario, la salida es **una exención por rol, escrita y explícita** en el modelo de
  permisos —como la de `SUPER_ADMIN`—, y nunca volver a leer el permiso de la sesión: eso reabriría
  el hueco entero por resolver un caso.
- La liquidación de consignación gana una lectura previa de `CierrePeriodo`. De regalo deja de
  responder **200 «Productos editados correctamente»** ante un `cierreId` ajeno que no actualizaba
  ninguna fila: ahora responde 404.
- `src/__tests__/tenantScope.test.ts` cambia de forma en los casos que pasan `permisoRequerido`.
- Siete rutas ajenas a F-029 entran en la superficie que el `qa` tiene que verificar. El humano lo
  aceptó explícitamente al decidir corregir el módulo.

**Impacto en seguridad y escalabilidad:**

- Cierra una escalada de privilegios **entre tiendas del mismo negocio**, en las rutas que pasan por
  este módulo. El aislamiento entre negocios no estaba comprometido y no cambia.
- El control negativo de la verificación es tan importante como el positivo: un usuario con el
  **mismo** rol en todas sus tiendas no debe notar nada. Sin ese caso, "arreglado" y "roto" dan la
  misma evidencia (E-008).
- La consulta añadida es un `findUnique` por clave compuesta (`usuarioId_tiendaId`): índice único,
  coste constante, y solo en los 10 puntos de llamada que piden permiso.
