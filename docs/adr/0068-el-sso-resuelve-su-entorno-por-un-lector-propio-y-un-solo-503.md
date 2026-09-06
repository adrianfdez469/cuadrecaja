# ADR 0068: El SSO resuelve su entorno con un lector propio, reutiliza `QAB_API_BASE_URL` como dominio del panel, y responde un único `503` cuyo motivo solo viaja por un log de vocabulario cerrado

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-009
**Se apoya en:** [ADR 0014](0014-qab-api-base-url-ausente.md) · [ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md)

## Contexto

`SSO_JWT_SECRET` **no existe hoy en este repositorio**: no está en `.env` ni en `.env.example`. Del
lado de QAB sí está declarada (`$QAB_DOCS_PATH/despliegue.md` § 5), con dos condiciones que la hacen
distinta de las demás: **tiene que valer lo mismo en los dos proyectos** y **se rota a la vez en
ambos**, o el administrador deja de poder entrar.

El repositorio ya tiene dos formas de leer un secreto de entorno, y son opuestas:

- `src/lib/qab/qabProvisioningEnv.ts` —el patrón bueno— es una función **pura** que recibe el
  entorno como argumento, distingue «ausente» de «mal puesto», y cuyos mensajes de excepción no
  contienen el valor ni un fragmento suyo.
- `src/lib/referrals/activationToken.ts`, `magicLink.ts` y `src/lib/userAccount/userAccountJwt.ts`
  leen `process.env` desde dentro, lanzan un `Error` genérico y no son verificables sin manipular el
  entorno del proceso.

Y falta decidir el dominio contra el que se construye `/admin/sso?token=…`. `QAB_API_BASE_URL` es
hoy el origen desnudo de QAB, validado por `resolveQabBaseUrl` (protocolo, https en producción, sin
credenciales, sin ruta). `/admin/sso` es una **página** de QAB, no una ruta de `/api/internal/*`;
§ 8.4 de su documento de despliegue la escribe como `https://<dominio>/admin/sso?token=<jwt>`, el
mismo `<dominio>` que el resto del documento.

Encima de todo esto está el criterio 9 del spec, que es una instancia directa de
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md): con la
variable ausente o vacía, la respuesta no puede ser un `500` con el mensaje crudo de
`jsonwebtoken`, porque un runtime **cita el dato que lo rompió**.

## Decisión

**Tres piezas, ninguna nueva en su forma.**

**1. Un lector propio, calcado de `qabProvisioningEnv`.** `resolveQabSsoSecret(env?)` es puro, recibe
el entorno como argumento, devuelve `null` cuando la variable está ausente o en blanco tras recortar,
y lanza `QabSsoConfigError` cuando está presente pero mide menos de 32 caracteres. **Ningún mensaje
de esa excepción contiene el valor ni un fragmento suyo**: nombra la variable y la longitud mínima, y
nada más. El mínimo de 32 es el mismo que ya exigen `NEXTAUTH_SECRET` y
`QAB_PROVISIONING_SECRET_MIN_LENGTH`; QAB no publica ninguno para esta variable.

**2. `QAB_API_BASE_URL` es también el dominio del panel. No se añade una segunda variable.** La URL
se compone con `qabSsoAdminUrl(baseUrl, token)`, que concatena la constante `QAB_SSO_ADMIN_PATH` y
mete el token con `URLSearchParams`, igual que `qabOrdersPullUrl`. Ninguna ruta se escribe inline.

**3. Un solo `503` para los cuatro estados de entorno que impiden emitir.** El cuerpo es
`{ error: "TIENDA_ONLINE_SSO_NOT_CONFIGURED" }`, idéntico en los cuatro casos:

| Estado | Respuesta |
|---|---|
| `SSO_JWT_SECRET` ausente o en blanco | `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` |
| `SSO_JWT_SECRET` presente y de menos de 32 caracteres | `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` |
| `QAB_API_BASE_URL` ausente o en blanco | `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` |
| `QAB_API_BASE_URL` presente y malformada | `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` |

El motivo **sí** se distingue, pero solo hacia el log del servidor, y como **código de un
vocabulario cerrado** de cuatro valores: `SECRET_NOT_SET`, `SECRET_INVALID`, `BASE_URL_NOT_SET`,
`BASE_URL_INVALID`. La línea es un prefijo constante más uno de esos cuatro códigos, sin
interpolación de ninguna otra cosa. No hay ninguna rama que pueda poner ahí texto libre, ni el
mensaje de una excepción, ni el valor de una variable.

La precedencia entre motivos no se escribe como cadena de `if`: es el **orden de declaración de la
constante**, que la función recorre, exactamente como `resolveAutoProvisioningAvailability`.

**4. La firma no propaga lo que `jwt.sign` lance.** `signQabSsoToken` envuelve la llamada y
sustituye cualquier valor lanzado desde dentro por un `QabSsoSigningError` cuyo mensaje es una
constante fija. El valor capturado no se lee, no se inspecciona, no se registra y **no se encadena
como `cause`**: `logRouteError` hoy solo imprime `name` y `message`, pero un logger futuro que
serialice el objeto entero encontraría el `cause` intacto.

`.env.example` gana la variable, en el bloque de QAB, junto a `QAB_PROVISIONING_SECRET`, con el
aviso de que **se comparte y se rota con el otro equipo**, que es lo que la distingue de todas las
demás de ese bloque.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `USER_ACCOUNT_JWT_SECRET` o `ACTIVATION_JWT_SECRET` | Son secretos **de esta aplicación**: nadie más los conoce y se rotan cuando aquí se quiera. `SSO_JWT_SECRET` es compartido con otro equipo y se rota de forma coordinada. Meterlos en el mismo valor significa que rotar un enlace de invitación tumba el acceso al panel de QAB, y al revés. |
| Copiar el estilo de `userAccountJwt.ts` (`process.env` leído dentro, `Error` genérico) | Es el patrón que este repositorio está dejando atrás: no es verificable sin manipular el entorno del proceso, y su `Error` genérico no se distingue en un `catch` del error de firma. |
| Una variable nueva, `QAB_PANEL_BASE_URL`, para el dominio del panel | Dos variables que hoy valen lo mismo se separan el día que alguien ponga una y olvide la otra, y el síntoma sería un enlace hacia un dominio equivocado —el fallo que § 5 de QAB describe como el más fácil de dejar mal. Si algún día el panel vive en otro dominio, añadirla entonces es un cambio pequeño y con motivo; añadirla ahora es adivinar. |
| Tratar la variable ausente como un no-op silencioso, al estilo de ADR 0014 | ADR 0014 habla de un **cron** que corre solo: ahí «no configurado» es un estado normal y responder `200` sin hacer nada es honesto. Aquí hay una persona que acaba de pulsar un botón. Un `200` sin enlace es una pantalla que no hace nada y no dice por qué. |
| Distinguir «ausente» de «mal puesta» en el cuerpo de la respuesta, con dos códigos | El comerciante no puede arreglar ninguna de las dos, así que la distinción no le sirve; y le informa de si alguien puso algo, que es un bit sobre la configuración del despliegue. Quien sí necesita el motivo —el operador— lo tiene en el log. |
| Devolver `500 TIENDA_ONLINE_UNAVAILABLE`, el código genérico del módulo | Un despliegue sin cablear no es un fallo del servidor, y colapsarlo con el `500` genérico borra la única señal que dice qué falta. `503` es además lo que QAB usa del otro lado para «no configurado» (`PROVISIONING_NOT_CONFIGURED`, `REALTIME_NOT_CONFIGURED`), sin que esto sea espejar su estado (ADR 0022): es nuestro código, por nuestra propia condición. |

## Consecuencias

**A favor:**

- El criterio 9 queda cerrado **estructuralmente**, no por disciplina: no existe ninguna rama del
  código que pueda poner el valor de un secreto en una respuesta o en un log, porque las dos vías
  posibles —el mensaje de `QabSsoConfigError` y el de `jwt.sign`— están cortadas en origen.
- La resolución del entorno es **pura y verificable sin tocar `process.env`**: el `dev-tester` le
  pasa un objeto y comprueba los cuatro estados.
- Un despliegue al que le falte la variable lo dice con un código propio en el log, en vez de con un
  `500` mudo.

**En contra / coste asumido:**

- Cuatro estados de entorno colapsan en una sola respuesta HTTP. Diagnosticar «por qué no me sale el
  enlace» exige mirar el log del servidor, no la respuesta.
- El mínimo de 32 caracteres es **nuestro**, no de QAB. Un secreto acordado más corto —que del otro
  lado funcionaría— aquí se rechaza. Es deliberado: 32 es lo que ya exige el resto del repositorio, y
  un HS256 con menos entropía que eso es el eslabón débil de toda la cadena. Queda escrito porque, si
  alguien ve `503` con la variable puesta en los dos lados, esta es la primera cosa que medir.
- `SSO_JWT_SECRET` y `QAB_API_BASE_URL` quedan acopladas: cambiar el origen de QAB mueve también el
  destino del SSO. Es lo que se quiere, pero conviene saberlo al apuntar a un mock local.

**Impacto en seguridad y escalabilidad:**

- El secreto lo **lee** un solo módulo (`src/lib/qab/qabSsoEnv.ts`) y lo **consume** un solo módulo
  (`src/lib/qab/qabSsoToken.ts`, que se lo pasa a `jwt.sign` y lo olvida). En medio atraviesa
  `src/lib/tiendaOnline/tiendaOnlineSso.ts` como valor local de una llamada: ese módulo no lo
  devuelve, no lo registra y no lo mete en ninguna estructura que se serialice. Son tres módulos, y
  ninguno de ellos lee además el `qabToken` por negocio ni el secreto de aprovisionamiento — la
  misma separación que imponen ADR 0006 y ADR 0026.
- La validación de `resolveQabBaseUrl` se hereda entera: en producción el enlace no puede salir por
  `http`, y un origen con credenciales embebidas o con ruta se rechaza antes de firmar nada.
- Reversión inmediata y sin desplegar código: quitar la variable devuelve el endpoint al `503`.
