# ADR 0077: Fuera de tenant es 404, sin permiso es 403, y el 401 sigue siendo solo del middleware

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

Cerrar una ruta es elegir un código de respuesta, y en este repositorio esa elección **no es
cosmética**: el interceptor de `src/lib/axiosClient.ts` reacciona al código antes de que la pantalla
vea nada.

Lo que hace hoy, leído del archivo:

- `axiosClient.ts:81-84` — ante **cualquier 401**, `await signOut({ callbackUrl: "/login" })`. El
  usuario sale de la aplicación (E-007). Ya expulsó una vez a un visitante que solo había pedido el
  recurso equivocado.
- `axiosClient.ts:86-93` — ante **cualquier 403**, descarta el cuerpo de la respuesta y lo sustituye
  por `Acceso denegado a <url>. Por favor asigne los permisos necesarios.` (E-009). Lo que el
  backend hubiera querido explicar no llega nunca.
- El reintento de `axiosClient.ts:57-77` solo dispara con `ECONNABORTED` o `ERR_NETWORK`: **ningún
  código 4xx se reintenta**, así que ni el 403 ni el 404 generan tráfico extra.

El criterio 5 de F-021 —«ninguna pantalla del POS pierde funcionalidad»— existe por esto. Y los
criterios 2 y 3 admiten «403 o 404» sin decidir cuál: la decisión es de este ADR.

## Decisión

Tres códigos, con un significado fijo cada uno, y ninguna ruta corregida inventa un cuarto.

**1. Fuera de tenant → `404`.**
Cuando el recurso existe pero pertenece a otro negocio, la respuesta es **idéntica** a la de un
recurso que no existe: `404` con el cuerpo del módulo. Dos razones, y las dos importan:

- **No hay oráculo de existencia.** Un 403 y un 404 distinguibles convierten la ruta en un
  comprobador de ids: «este UUID existe en algún negocio». Con 404 para ambos casos, un usuario del
  negocio A no puede diferenciar «no existe» de «no es tuyo».
- **El cuerpo sobrevive.** Un 403 llegaría a la pantalla como *«asigne los permisos necesarios»*
  (E-009), que es sencillamente falso: no falta ningún permiso. El 404 pasa intacto por el
  interceptor y la pantalla puede decir la verdad.

Es además la forma que este repositorio ya eligió: `tiendaOnlineOrderNotFoundResponse()`
(`src/lib/tiendaOnline/tiendaOnlineOrderAccess.ts`) devuelve 404 para `OUT_OF_SCOPE` y reserva el 403
para `FORBIDDEN`. Este ADR no inventa un criterio: extiende el que ya está escrito ahí.

**2. Falta el permiso → `403`.**
Ahí el mensaje genérico del interceptor **es correcto**, que es exactamente el caso para el que se
escribió. Un solo cuerpo, un solo estado, y nunca dice *qué* permiso falta —igual que
`tiendaOnlineForbiddenResponse()`.

**3. Sin sesión dentro de un handler → `403`, nunca `401` y nunca `404`.**
Detrás de la puerta de F-018 no debería ocurrir; se codifica igualmente y **falla cerrado**, por la
misma razón por la que `decideTiendaOnlineAccess` codifica `NO_SESSION`. El **único 401 del sistema
es el del middleware**, que es el que sí debe mandar al login (ADR 0016, E-007).

Y **403, no 404**, aunque el 404 sea la respuesta de la denegación por tenant: «no hay sesión» no es
«el recurso no existe», y el argumento del oráculo de existencia no aplica aquí porque **sin sesión
no hay tenant desde el que sondear**. Es además lo que ya hace `assertTiendaOnlineAccess` con su
propio `NO_SESSION`.

> **Precisión añadida el 2026-09-05.** La primera versión de este ADR fijaba los tres códigos pero
> **no el mapeo completo de las cuatro decisiones**, y el hueco quedó como acuerdo tácito entre el
> `implementer` y el `dev-tester`, que trabajan sin verse — exactamente lo que E-030 castiga.
> Acertaron los dos, por el precedente; acertar contra un contrato que calla es suerte, no diseño.
> El mapeo, ahora normativo y escrito en el docstring de `tenantScopeDenial`:
>
> | Decisión | Respuesta |
> |---|---|
> | `ALLOWED` | `null` |
> | `OUT_OF_TENANT` | **404** — la única |
> | `MISSING_PERMISSION` | 403 |
> | `NO_SESSION` | 403 |

**4. Un solo sitio escribe cada cuerpo.** `tenantForbiddenResponse()` y `tenantNotFoundResponse()`
son las dos únicas funciones que construyen estas respuestas; ninguna ruta corregida escribe un
`NextResponse.json({ error: ... }, { status: 403 })` a mano. Dos cuerpos escritos por separado
divergen en cuanto alguien toca uno (E-014).

**Orden de evaluación, que es contrato:** sesión → permiso → pertenencia. El permiso es puro y la
pertenencia cuesta una consulta; comprobar primero lo barato evita ir a la base por una petición que
ya está denegada. Consecuencia observable y buscada: quien no tiene el permiso recibe **403** aunque
el recurso fuera de otro negocio — la respuesta más restrictiva de las dos, y la que menos revela.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `403` para fuera de tenant | Convierte la ruta en oráculo de existencia de ids ajenos, y el interceptor sustituye el cuerpo por un mensaje de permisos que miente (E-009) |
| `401` para fuera de tenant | Desloguea al usuario legítimo que pidió el recurso equivocado (E-007). Es literalmente el fallo que ya ocurrió una vez en este repositorio |
| `404` también para «falta el permiso» | Esconde un problema de configuración de roles que el administrador **necesita** ver. El mensaje genérico del interceptor es el correcto ahí |
| Distinguir en el cuerpo del 404 «no existe» de «no es tuyo» | Reintroduce el oráculo de existencia por la puerta de atrás |
| Arreglar de paso el 401 de `assertNegocioAccess` (`appNegocioAccess.ts:14`) | Fuera del alcance del spec, y detrás de la puerta de F-018 esa rama es inalcanzable en la web. Queda anotado, no corregido |

## Consecuencias

**A favor:**
- Ninguna ruta corregida puede expulsar de la aplicación a un usuario legítimo.
- Las pantallas reciben el cuerpo real cuando el recurso no está a su alcance, y pueden decir algo
  cierto.
- Un usuario del negocio A no puede enumerar ids del negocio B midiendo códigos de respuesta.

**En contra / coste asumido:**
- Depurar es algo más incómodo: un 404 no dice si el id no existe o si es de otro tenant. Se
  compensa con el log del servidor, que sí distingue —el motivo se registra ahí y **nunca viaja en
  la respuesta**, igual que `ITiendaOnlineDenialReason`.
- Los servicios de `src/services/` que hoy tratan un 404 como «lista vacía» pueden necesitar
  distinguirlo de «no autorizado». Se acepta: es preferible a la alternativa.

**Impacto en seguridad y escalabilidad:**
- Elimina el canal lateral por código de respuesta entre negocios.
- Sin coste de rendimiento: ningún 4xx se reintenta, y el orden sesión → permiso → pertenencia ahorra
  una consulta en toda petición denegada por permiso.
