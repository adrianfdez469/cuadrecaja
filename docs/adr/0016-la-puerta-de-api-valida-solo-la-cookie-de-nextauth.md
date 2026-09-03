# ADR 0016: La puerta de `/api/` valida solo la cookie de NextAuth con `getToken()`

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-018

## Contexto

F-018 pone una puerta de autenticación por defecto en `/api/`. Hoy no hay ninguna: una ruta nueva
que alguien olvide proteger queda abierta, y 29 de las 114 rutas que quedarán bajo la puerta no
comprueban absolutamente nada.

Hay dos mecanismos de cliente vivos contra este backend y **ninguno se puede romper** (es la
condición que puso el humano al autorizar el feature, y son sus criterios 8, 9 y 10):

- **Web:** cookie de NextAuth, un JWE de 5 partes que `getToken()` (`next-auth/jwt`) decodifica.
- **APK Flutter:** un Bearer propio, un JWS de 3 partes minteado con `jsonwebtoken` en
  `POST /api/app/auth/login`. Verificado ejecutando: `getToken()` devuelve `null` ante ese token —
  es otro formato, no un fallo de configuración.

El spec dejó abiertas dos opciones para la puerta, porque ambas cumplen los 10 criterios:

1. Validar solo `getToken()` (cookie).
2. Reutilizar `getSessionFromRequest()` de `src/utils/authFromRequest.ts`, que acepta cookie **o**
   Bearer JWS.

La segunda parece la más generosa —acepta a los dos clientes— y es la que sugería el propio spec al
listar las "piezas a reutilizar". Es la que hay que descartar, y por un motivo que no es de gusto.

**`getSessionFromRequest()` no puede ejecutarse en el middleware.** Su primer paso es
`getServerSession(authOptions)`, y `authOptions` arrastra el cliente de Prisma y `bcrypt` por su
provider de credenciales. El middleware de Next corre en el runtime Edge: no hay `bcrypt`, no hay
driver de Postgres, y `getServerSession` depende de `next/headers`, que no está disponible ahí.
Reutilizar esa función en `src/middleware.ts` no es una decisión de diseño discutible: no arranca.

Queda la variante de reimplementar en el middleware solo la mitad `jose` de esa función —verificar
el JWS con `jwtVerify`, que sí corre en Edge—. Eso sería exactamente lo que el spec descarta en su
"No incluye": duplicar la verificación de sesión en dos sitios que habría que mantener
sincronizados.

Y hay un hallazgo del repositorio que sube el coste de equivocarse: el interceptor de
`src/lib/axiosClient.ts` reacciona a **cualquier** 401 con `signOut({ callbackUrl: "/login" })`. Un
401 de más no devuelve un error a una pantalla: **echa al usuario de la aplicación**.

## Decisión

**La puerta valida únicamente `getToken()`.** Si no hay token de NextAuth y la ruta no está en la
allowlist, la respuesta es 401 y la petición no llega al route handler.

La APK no se ve afectada porque `/api/app` entero está en la allowlist (criterio 5) y sus 15
endpoints ya se autentican uno a uno con `getSessionFromRequest()`, que sigue corriendo donde sí
puede correr: dentro del route handler, en runtime Node.

Tres consecuencias que forman parte de la decisión:

- **La puerta solo puede responder 401 por ausencia de sesión, nunca por falta de permisos.** Un
  fallo de autorización es 403. El interceptor de axios convierte cualquier 401 en un cierre de
  sesión, así que 401 significa "vuelve a entrar" y nada más.
- **La respuesta del 401 lleva `Cache-Control: no-store`** y las cabeceras CORS que ya aplica el
  middleware. Sin `no-store`, un intermediario puede cachear el 401 de `/api/negocio` y dejar la
  pantalla de superadmin muerta para una sesión válida. Sin CORS, el navegador convierte el 401 en
  un error opaco y el diagnóstico se vuelve imposible.
- **No se añade `WWW-Authenticate`.** No aporta nada a ninguno de los dos clientes y abre la puerta
  a diálogos nativos del navegador.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `getSessionFromRequest()` en el middleware | No arranca: `getServerSession(authOptions)` arrastra Prisma y `bcrypt` al runtime Edge y depende de `next/headers`. No es una preferencia, es una incompatibilidad. |
| Reimplementar solo el `jwtVerify` de `jose` en el middleware | Corre en Edge, sí, pero duplica la verificación de sesión en dos archivos que hay que mantener sincronizados; el spec lo descarta explícitamente. Y no compra nada: el único cliente Bearer consume solo `/api/app`, que ya está en la allowlist. |
| Aceptar la petición si trae **cualquier** cabecera `Authorization: Bearer` | Es un agujero, no una puerta: cualquiera manda una cabecera. Descartada sin más. |
| Mover el middleware al runtime Node (`export const runtime = 'nodejs'`) para poder usar `getServerSession` | Cambia el runtime de la pieza que intercepta **todo** el tráfico, en el feature cuya restricción número uno es no romper nada. Un coste de latencia y de despliegue desproporcionado para unificar una puerta que la allowlist ya resuelve. |

## Consecuencias

**A favor:**
- La puerta usa la misma llamada que el middleware ya hace hoy (`getToken()`): no añade ninguna
  dependencia ni ningún camino de código nuevo al runtime Edge.
- Un solo sitio verifica la cookie y un solo sitio verifica el Bearer. No hay nada que sincronizar.
- La APK queda intacta por construcción, no por una comprobación que pueda fallar: pasa por
  allowlist.

**En contra / coste asumido:**
- **Seis rutas gated fuera de `/api/app` aceptan hoy el Bearer JWS** vía `getSessionFromRequest()`:
  `tasas-referencia`, `negocio/[id]/monedas`, `negocio/[id]/monedas/[code]`,
  `negocio/[id]/cambiar-moneda-base`, `negocio/[id]/tasas-cambio` y `categorias`. Con esta puerta,
  un cliente que solo tenga Bearer y no cookie pasa a recibir 401 en ellas. El spec afirma que la
  APK no las consume —consume las versiones `/api/app/monedas/[negocioId]` y
  `/api/app/tasas-cambio/[negocioId]`—, pero **esa afirmación está construida desde este
  repositorio, donde el código de la APK no vive**: es una inferencia, no una prueba. El criterio 9
  (recorrido manual completo de la APK contra un backend local) es la red que la convierte en
  prueba.
- **Coste de reversión: una línea.** Si el criterio 9 descubre que la APK sí llama a alguna de esas
  seis, la corrección es añadir esa ruta a `API_AUTH_ALLOWLIST` —ya se autentica sola con
  `getSessionFromRequest()`, así que allowlistarla no la deja abierta—. No hay que rediseñar nada.
- La puerta no protege lo que hay dentro de `/api/app`: depende de que esos 15 handlers sigan
  llamando a `getSessionFromRequest()`. Es el estado actual y hay que mantenerlo.

**Impacto en seguridad y escalabilidad:**
- Pasa de "abierto salvo que alguien se acordara de cerrar" a "cerrado salvo que esté en una lista
  escrita a mano". Una ruta nueva olvidada nace protegida.
- Coste por petición: el `getToken()` que el middleware ya hacía. Cero consultas a base de datos
  añadidas, cero latencia nueva.
- No sustituye a ninguna comprobación de permisos ni al filtrado por `negocioId` dentro de los
  handlers: es una capa previa. Que una petición pase la puerta no dice **nada** sobre a qué tenant
  pertenece quien la manda.
