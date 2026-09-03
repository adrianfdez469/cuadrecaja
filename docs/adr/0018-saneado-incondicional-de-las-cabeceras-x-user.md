# ADR 0018: Las cabeceras `x-user-*` se borran siempre y se escriben siempre

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-018

## Contexto

`src/middleware.ts` inyecta ocho cabeceras `x-user-*` con la identidad del usuario, y
`src/utils/getUserFromRequest.ts` las decodifica de base64 **sin verificar nada**: ni firma, ni que
correspondan a una sesión real. Siete rutas dependen solo de eso para saber quién llama, y
`src/utils/permisos_back.ts` devuelve `true` sin más comprobación cuando el rol recibido es
`SUPER_ADMIN`.

Hoy hay dos formas de meter una identidad falsa por esa puerta:

1. **Sin token.** El middleware no borra nada: las `x-user-*` que mande el cliente llegan intactas
   al handler. Es el criterio 3, verificado ejecutando el 2026-09-01.
2. **Con token.** El middleware parte de `new Headers(req.headers)` —que ya contiene lo que mandó
   el cliente— y sobrescribe cada clave **dentro de un `if (token.campo)`**. `token.rol` sale de
   `getRolUsuario()` y puede ser cadena vacía; cuando lo es, el `if` no entra y **la cabecera del
   cliente sobrevive dentro de una sesión legítima**. Es el criterio 4: un VENDEDOR real que añade
   `x-user-rol: SUPER_ADMIN` a mano.

El segundo es el grave: no requiere ser anónimo, requiere tener cuenta.

La puerta del [ADR 0016](0016-la-puerta-de-api-valida-solo-la-cookie-de-nextauth.md) **no cierra
ninguno de los dos**. Cierra el primero de rebote (sin sesión no se llega al handler), pero el
segundo ocurre *con* sesión válida, del lado bueno de la puerta. Son dos defensas distintas contra
dos ataques distintos, y el feature necesita las dos.

## Decisión

**El saneado es incondicional y se ejecuta antes que cualquier otra cosa que pueda terminar la
petición.** Dos reglas, sin excepciones:

1. **Borrar.** Se elimina **toda** cabecera entrante cuyo nombre empiece por `x-user-`, sin
   consultar una lista de las ocho conocidas: el prefijo entero. Una cabecera `x-user-loquesea`
   que alguien lea el año que viene no puede venir del cliente.
2. **Escribir.** Si hay token, se escriben las ocho, **una llamada a `set` por cabecera, siempre**,
   con el valor codificado o con cadena vacía cuando el campo del token es `null`/`undefined`.
   Ningún `set` vive dentro de un `if`.

Y el alcance del saneado es **toda petición que el middleware intercepta**, no solo las gated:

- **También en las rutas de la allowlist.** `/api/app` no lee `x-user-*` —es el único bloque del
  backend donde eso es cierto sin excepciones— pero borrarlas es gratis y evita que la próxima ruta
  que se escriba ahí herede el problema.
- **También en las rutas de página.** `src/middleware/subscriptionCheck.ts` lee `x-user-negocio` y
  `x-user-rol` para decidir si redirige a `/login`; hoy, sin token, las lee del cliente. Y las
  cabeceras crudas siguen llegando al render porque `subscriptionMiddleware` devuelve un
  `NextResponse.next()` sin propagar las saneadas. Se corrige pasándole las cabeceras saneadas para
  que las adjunte a su respuesta de continuación.
- **También cuando no hay token.** Ese es el camino que hoy no borra nada. Sin token, las ocho
  quedan simplemente ausentes.

Dos precisiones que forman parte de la decisión, para que nadie las descubra depurando:

- **La seguridad la da el borrado, no la escritura.** Si el transporte descartara una cabecera de
  valor vacío, el resultado seguiría siendo "ausente", nunca "el valor del cliente". La escritura
  incondicional cumple la letra del criterio 4 y evita el `if`; el borrado es lo que cierra el
  agujero. Por eso el contrato prueba el borrado sobre un `Headers`, no sobre la red.
- **No hay regresión por la cadena vacía.** `getUserFromRequest` ya trata "cabecera ausente" y
  "cabecera vacía" igual (`decodeFromHeader(null)` devuelve `''`), y `subscriptionCheck` ya cae al
  `getToken()` de respaldo cuando `x-user-rol` es falsy. El comportamiento observable para un
  usuario legítimo no cambia.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Borrar solo las ocho cabeceras conocidas | Deja el prefijo abierto. La lista de ocho es de hoy; el borrado por prefijo protege también la novena que alguien añada sin acordarse de este ADR. |
| Construir el `Headers` desde cero en vez de clonar y borrar | Perdería todo lo demás: `content-type`, `authorization`, `cookie`, la clave de idempotencia. Clonar y borrar el prefijo es lo correcto. |
| Firmar las cabeceras `x-user-*` (HMAC) y verificar la firma en `getUserFromRequest` | Resuelve el problema real —la cabecera pasa a ser inforjable— pero añade un secreto, una verificación por petición y un formato que mantener, para transportar dentro del mismo proceso algo que el borrado ya garantiza. Es la opción correcta si algún día esas cabeceras cruzan un salto de red que no controlamos. Hoy no lo cruzan. |
| Eliminar `getUserFromRequest` y que las 7 rutas usen `getServerSession` | Es lo que habría que hacer con tiempo, y sigue siendo lo correcto a medio plazo. Es reescribir la autenticación de siete rutas dentro del feature cuya restricción número uno es no romper nada; el spec lo pone explícitamente fuera de alcance. El borrado las cierra **sin tocar su código**. |
| Confiar en que la puerta del ADR 0016 basta | No basta: el criterio 4 es un usuario **autenticado de verdad** escalando a `SUPER_ADMIN`. Pasa la puerta legítimamente. |

## Consecuencias

**A favor:**
- Las 7 rutas que solo confían en `x-user-*` quedan cerradas sin modificar ni una línea suya.
- El invariante es enunciable en una frase y comprobable con un `grep`: *ninguna cabecera
  `x-user-*` que llegue al backend viene del cliente*.
- La escalada `VENDEDOR` → `SUPER_ADMIN` deja de existir aunque `permisos_back.ts` siga confiando
  en el rol que recibe.

**En contra / coste asumido:**
- Si algún cliente interno estuviera mandando una `x-user-*` a propósito, deja de funcionar. No se
  ha encontrado ninguno: los navegadores no las mandan y la APK no las usa.
- El saneado corre en **todas** las peticiones que el middleware intercepta, incluidas las de
  página. Es un recorrido de las claves de un `Headers`: coste despreciable, pero es coste en el
  camino caliente de todo el tráfico.
- `subscriptionMiddleware` cambia de firma para recibir las cabeceras saneadas. Es un archivo que
  intercepta la navegación entera: el cambio es de una línea por cada `NextResponse.next()`, y no
  puede ir más allá.

**Impacto en seguridad y escalabilidad:**
- Corta la cadena completa que hoy permite a un anónimo enumerar negocios y leer datos de
  cualquiera de ellos, y la variante autenticada de esa misma cadena.
- Es defensa en profundidad respecto del ADR 0016: si mañana una ruta gated se allowlistea por
  error, el saneado sigue impidiendo que alguien se declare `SUPER_ADMIN` en ella.
- No añade consultas ni estado. Nada que escalar.
