# ADR 0146: Los recursos de ámbito negocio comprueban el permiso contra el local de la sesión

**Estado:** aceptado · **Fecha:** 2026-09-11

## Contexto

Este ADR no nace de un feature: nace de **fusionar `main`** en la rama de cuentas por cobrar.

El ADR 0107 (de `main`, su F-030) cambió el modelo de autorización del backend. Antes,
`resolveTenantAxis({ session, permisoRequerido })` comprobaba el permiso contra
`session.user.permisos` — la cadena que se calcula al iniciar sesión con
`getPermisosUsuario(userId, localActual)`. Después, esa función deja de aceptar permiso y el
permiso se comprueba con `assertPermisoEnTienda({ session, tiendaId, permisoRequerido })`, contra
los permisos que el usuario tiene **en el local que la petición direcciona**.

El motivo es sólido y lo sostiene el modelo de permisos del sistema: **un usuario solo tiene
permisos a través de un Rol asignado en un local concreto** (`UsuarioTienda.rolId`), salvo
`SUPER_ADMIN`, que queda fuera. `UsuarioTienda` lleva un `rolId` por local, así que «los permisos
del usuario» no es una cosa: es una cosa **por local**.

Once rutas de esta rama —clientes y cuentas por cobrar— llamaban al gate viejo. Dos pasaban
`permisoRequerido: null` y son triviales. Las otras nueve pasaban un permiso real, y no todas
son iguales.

## Decisión

**Se parten en dos grupos, según si la operación direcciona un local o no.**

### 1. Las cuatro rutas por cuenta comprueban contra el local de la deuda

`cuentas-por-cobrar/[cuentaId]` y sus `abono`, `perdonar` y `reversion` pasan a
`assertPermisoEnTienda` con el `tiendaId` de la propia `CuentaPorCobrar`, después de la guarda de
pertenencia y no antes.

**Esto cierra un agujero real, no es cosmético.** `withTenantScope("cuentaPorCobrar", …)` acota la
fila al **negocio**, no al local. Sin este cambio, un usuario con
`operaciones.cuentasporcobrar.cobrar` en el local A podía registrar un abono sobre una deuda del
local B del mismo negocio. Bajo la regla de arriba eso es un salto entre locales que no debería
existir. El `tiendaId` que hace falta ya se leía en el `select` de esas rutas.

### 2. Los recursos de ámbito negocio siguen comprobando contra el local de la sesión

`Cliente` cuelga de `negocioId` y **no tiene columna `tiendaId`**: no hay «local que la petición
direcciona» contra el que comprobar. Lo mismo vale para los dos listados de cuentas por cobrar,
que abarcan todos los locales del negocio. Para esos cinco sitios se añade
`assertPermisoEnNegocio({ session, permisoRequerido })`, hermano del de `main`, que decide con el
mismo núcleo puro (`decideTenantScope`) pasando `session.user.permisos`.

**Y esto NO es el fallback que el ADR 0107 prohíbe.** Aquel habla de una petición que direcciona
el local B mientras la sesión lleva los permisos del local A: ahí la cadena de la sesión es la del
local equivocado y concede lo que no debe. Aquí no hay un segundo local sobre el que equivocarse.
Los permisos solo nacen de un Rol en algún local, así que el local de la sesión es una fuente
legítima, y un usuario que tenga el permiso en otro local llega al mismo sitio cambiando de local.

## Alternativas descartadas

- **Quitar `permisoRequerido` y ya.** Es lo que hacía falta para que `tsc` compilara, y habría
  borrado **nueve comprobaciones de permiso sin que nada fallara**. Es el modo de fallo que este
  ADR existe para no cometer.
- **Llamar al gate nuevo sin `permisosEnTienda`.** Falla cerrado: las nueve rutas responderían 403
  a todo el mundo. No pierde seguridad, pero rompe el producto entero.
- **Exigir el permiso en CUALQUIER local del negocio** para los recursos de ámbito negocio. Es lo
  que la regla dice literalmente y es más fiel al modelo, pero exige un helper nuevo que consulte
  los `UsuarioTienda` del negocio, y es equivalente en lo que el usuario puede lograr: puede
  cambiar de local y volver. Se descarta por ahora **por ser código nuevo dentro de una fusión**,
  no porque sea peor. Decisión del humano el 2026-09-11.

## Consecuencias

- Un usuario que hoy cobra, perdona o revierte deudas de cualquier local del negocio pasará a
  necesitar el permiso **en el local de cada deuda**. Puede aparecer un 403 donde antes no lo
  había, y es el comportamiento correcto.
- Las rutas de `Cliente` y los dos listados no cambian de comportamiento respecto a antes de la
  fusión.
- `routeGuards.json` **no se toca**: su campo `helper` documenta el gate de *tenant*, no el de
  permiso — `main` registra `resolveTenantAxis` en `locales/[id]` PUT aunque su código llame
  además a `assertPermisoEnTienda`. Se sigue su convención en vez de inventar una nueva.
- Queda pendiente, y no es de esta fusión: ninguna de las nueve rutas tiene test de autorización
  que distinga un local de otro. El agujero que se cierra aquí no lo habría cazado la suite.
