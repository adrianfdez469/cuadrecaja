# ADR 0086: El rechazo por `usuario` sin forma de correo es un cuarto desenlace de `issueQabSsoLink`, va por detrás de `no_identity`, y sale como un `409` propio que el interceptor no destruye

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-023
**Se apoya en:** [ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) · [ADR 0067](0067-los-seis-claims-del-sso-salen-de-la-sesion-de-nextauth.md) ·
[ADR 0068](0068-el-sso-resuelve-su-entorno-por-un-lector-propio-y-un-solo-503.md) ·
[E-007](../../.agents/errors/E-007-pagina-publica-que-llama-a-una-api-cerrada.md) ·
[E-009](../../.agents/errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md)

## Contexto

F-009 firma el claim `email` con `Usuario.usuario` verbatim. El ADR 0067 descartó expresamente
validarlo con `.email()`, y la razón que dio fue doble: bloquear el SSO de las cuentas anteriores a
`EMAIL_REGEX` convertiría una deuda de datos en una pérdida de acceso, y **QAB no publica ningún
requisito de formato para ese claim**. La primera mitad sigue siendo cierta. La segunda no: el
documento no lo publica, pero el código del otro lado sí lo exige, y rechaza el canje con
`401 SSO_REJECTED reason:"malformed"` (S-003). El humano cierra S-003 sin tocar QAB.

O sea: hoy el enlace se firma bien, el navegador va a QAB, y el fallo ocurre **en un dominio que no
es el nuestro**, con el log útil en la otra organización. Eso es lo que F-023 elimina.

El camino de emisión (`issueQabSsoLink`, `src/lib/tiendaOnline/tiendaOnlineSso.ts`) evalúa cinco
pasos en orden, y su contrato **es** ese orden: entorno → `jti` → claims → firma → URL. Tiene ya una
unión cerrada de tres desenlaces, y los dos de fallo salen por vías distintas y bien diferenciadas:

| Desenlace | Respuesta | Qué dice |
|---|---|---|
| `not_configured` | `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` | el despliegue no está enlazado (ADR 0068) |
| `no_identity` | `403 FORBIDDEN` | nada, **a propósito**: `forbidden` es el único cuerpo de todo 403 del módulo y no dice cuál de las puertas rechazó |

El criterio 1 de F-023 pide justo lo contrario del segundo: un error que **sí** nombre la causa, y
que llegue a la pantalla. Y ahí hay una restricción dura que no se ve leyendo la ruta, porque no
vive en el servidor: `src/lib/axiosClient.ts` tiene dos ramas por estado HTTP y solo dos —

- **401** → `signOut({ callbackUrl: "/login" })`. Un 401 de más no muestra un error: **echa al
  usuario de la aplicación** ([E-007](../../.agents/errors/E-007-pagina-publica-que-llama-a-una-api-cerrada.md)).
- **403** → sustituye el cuerpo entero por un `Error` fabricado —«Acceso denegado a … Por favor
  asigne los permisos necesarios»— que además **manda a arreglar lo que no está roto**
  ([E-009](../../.agents/errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md)).

Un desenlace que la pantalla deba distinguir por el cuerpo no puede viajar por ninguno de esos dos
números. No es una preferencia de diseño de API: es que el cuerpo no llega.

Encima está el criterio 5, que es E-031 otra vez: el cuerpo del error no puede contener el
`SSO_JWT_SECRET` ni un fragmento suyo. Los runtimes **citan el dato que los rompió** en el mensaje,
así que la respuesta no puede nacer de un `catch` alrededor de la firma.

## Decisión

**Un cuarto miembro de la unión cerrada, evaluado entre el paso 3 y el paso 4, y un `409` propio.**

**1. El desenlace.** `ITiendaOnlineSsoOutcome` gana `{ outcome: "user_not_email"; sub: string }`.
`sub` es el id interno de cuadrecaja, y viaja en el desenlace por una sola razón: para que la ruta
escriba su línea de log sin volver a leer la sesión. **El desenlace no lleva el `usuario` rechazado
ni nada derivado de él**, así que es también la frontera por la que ese dato no sale del `lib`. La
evaluación de `issueQabSsoLink` pasa a tener un paso 3b, y el orden **es el contrato**:

```
1. resolveQabSsoAvailability(env)   -> not_configured
2. randomUUID()                     -> the jti
3. buildQabSsoClaims({session, jti}) -> null: no_identity
3b. isQabSsoIssuableEmail(claims.email) -> false: user_not_email
4. signQabSsoToken(claims, secret)
5. qabSsoAdminUrl(baseUrl, token)   -> issued
```

**2. `no_identity` va por delante, y eso tiene una consecuencia que hay que leer dos veces.** El
paso 3b se evalúa **después** de construir los claims, no sobre `session.user.usuario` en crudo. Un
`usuario` en blanco o ausente sigue devolviendo `no_identity`, exactamente como hoy: F-023 no reabre
ni un solo desenlace de F-009. La consecuencia contraintuitiva es que **la función pura devuelve
`false` para la cadena vacía —que es lo que el criterio 6 exige— y sin embargo el desenlace de una
sesión con el `usuario` vacío NO es `user_not_email`, sino `no_identity`**. Las dos afirmaciones son
verdaderas a la vez y hablan de niveles distintos. Está escrito aquí y en el contrato porque es
justo la forma de [E-030](../../.agents/errors/E-030-un-contrato-que-se-contradice-entre-su-docstring-y-su-adr.md):
implementación y tests, escritos sin verse, podrían leerlo cada uno de una manera.

**3. Lo que se juzga es `claims.email`,** es decir el mismo string ya recortado que se firmaría, y
no el valor crudo de la sesión. El sitio de la comprobación y el sitio de la firma miran el mismo
dato.

**4. La respuesta es `409` con `{ error: "TIENDA_ONLINE_SSO_USER_NOT_EMAIL" }`** y los
`NO_STORE_HEADERS` del módulo. El 409 es el estado que el módulo ya usa para «tienes permiso, la
petición está bien, y el estado actual hace esto imposible» (`PEDIDO_NOT_LANDABLE`, F-014), y aquí
el estado que lo impide es el de la propia cuenta que pregunta. Lo que lo decide no es la elegancia
semántica sino que **el 409 no tiene rama en el interceptor**: hoy `axiosClient` solo se desvía en
401 y en 403, así que el cuerpo llega intacto al servicio y de ahí a la tarjeta.

El código es **propio y nuevo**, no una copia del de QAB: la palabra `malformed` con la que rechaza
el otro lado no aparece en ningún sitio de este repositorio (ADR 0022). `forbidden` sigue siendo el
único cuerpo de todo 403 del módulo, e `internal` el único de todo 500.

**5. El log es una constante y el `sub`, y nada más:** `` `${QAB_SSO_USER_NOT_EMAIL_LOG} ${claims.sub}` ``.
El `usuario` rechazado **no se loguea** —es el dato personal del caso y es justo lo que E-031
prohíbe—; `sub` es el id interno de cuadrecaja, que es el precedente que ya siguió F-012 al loguear
el `pedidoId` y nunca el código público del pedido. Es lo que hace que la línea sirva para algo
cuando el comerciante escriba a soporte.

**6. El criterio 5 se cumple estructuralmente, no filtrando.** La rama devuelve **antes** de que
`signQabSsoToken` se llame, así que `availability.secret` no entra en ella por ninguna vía: no hay
excepción que capturar, no hay mensaje de runtime que propagar, y no hay ninguna rama de este
desenlace que pueda poner texto libre ni en el cuerpo ni en el log.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un `403` con un código propio en el cuerpo | El interceptor lo destruye antes de que ningún `.catch()` lo vea (E-009). La pantalla no podría distinguirlo de los otros cuatro 403 del módulo, y el mensaje que el usuario acabaría leyendo le mandaría a pedir permisos que ya tiene |
| Un `401` | `axiosClient` lo convierte en `signOut()`: el comerciante no vería un mensaje, se encontraría en `/login` sin saber por qué (E-007) |
| Un `422` o un `400` | La ruta **no lee nada del llamador**: no llama a `request.json()`, ni a `request.text()`, ni mira la query. Nada de lo que envió está mal, porque no envió nada |
| Un `500` con un código nuevo | `internal` (`TIENDA_ONLINE_UNAVAILABLE`) es el único cuerpo de todo 500 del módulo y está escrito así en `src/constants/tiendaOnline.ts`. Y no es un fallo del servidor: el servidor funciona y ha decidido correctamente |
| Reutilizar el `503 TIENDA_ONLINE_SSO_NOT_CONFIGURED` | Dice «el panel todavía no está enlazado con Cuadre de Caja» y culpa al despliegue de algo que es un dato de la cuenta. Como el cuerpo sería idéntico, la tarjeta mostraría el copy de soporte de F-009 y el comerciante escribiría al equipo por algo que puede resolver él |
| Validar dentro de `buildQabSsoClaims` devolviendo `null` | Colapsa el caso nuevo dentro de `no_identity`, que es exactamente el `FORBIDDEN` sin motivo que el criterio 1 rechaza. Además cambiaría el significado de una función que F-009 ya cerró y testeó |
| Endurecer `qabSsoClaimsSchema` con `.email()` | El spec lo excluye del alcance de forma explícita, y con razón: un fallo de schema es una excepción cuyo `message` **serializa los issues, y los issues arrastran el valor validado** (E-031). El rechazo tiene que ser una rama, no una excepción |
| Capturar el `401 malformed` de QAB y traducirlo en cuadrecaja | Ningún estado de QAB se espeja (ADR 0022), y sobre todo: para capturarlo hay que haber firmado y haber mandado al comerciante al otro dominio, que es precisamente el recorrido que este feature existe para evitar |
| Emitir igual y avisar «puede que no funcione» | Un aviso que no impide nada deja el fallo real donde está y añade ruido. El criterio 1 exige que **no se emita ningún enlace** |

## Consecuencias

**A favor:**

- El fallo pasa a ocurrir en cuadrecaja, con un código propio, un log propio y un mensaje que
  nombra la causa. Deja de vivir en la otra organización.
- El criterio 5 no depende de que nadie recuerde filtrar nada: la firma no se ejecuta.
- `not_configured` y `no_identity` se comportan exactamente igual que antes de F-023, con el mismo
  cuerpo y el mismo estado. La regresión del criterio 3 es sobre código que no cambia.
- La unión sigue **cerrada** y sigue siendo el sitio donde se lee, de una ojeada, todo lo que puede
  pasar al pedir un enlace.

**En contra / coste asumido:**

- Un cuarto estado que la ruta, el servicio y la tarjeta tienen que enumerar. Es el coste de la
  unión cerrada, y es el mismo que F-009 ya pagó tres veces.
- **La corrección no surte efecto hasta el siguiente inicio de sesión.** `session.user.usuario` sale
  de `token.usuario`, que se fija en el login (`src/utils/authOptions.ts`) y no se relee en vivo:
  es [E-021](../../.agents/errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md) otra vez.
  Un usuario que cambie su `usuario` a un correo y vuelva a pulsar **seguirá viendo el mismo error**
  hasta cerrar y volver a abrir sesión. No se cierra aquí —recalcular la sesión en vivo afecta a
  toda la aplicación— pero el copy que fije el `ui-designer` tiene que decirlo, o la acción que el
  criterio 2 exige explicar no funciona.
- El 409 lleva la carga de significado en el cuerpo, no en el número. Quien lea solo el estado en un
  registro de accesos no distingue este 409 del de `PEDIDO_NOT_LANDABLE`.

**Impacto en seguridad y escalabilidad:**

- **Ni una consulta nueva.** El paso 3b es una comparación contra una expresión regular sobre un
  string que ya estaba en memoria. La petición cuesta lo que ya costaba: el gate del módulo que la
  ruta hacía antes de F-023 y sigue haciendo igual.
- **El aislamiento multi-tenant no se toca**: no se lee ningún dato nuevo, ni de la sesión ni de la
  base, y `businessId` y `storeIds` se siguen derivando exactamente como fijó el ADR 0067.
- La superficie de firma se **estrecha**: hay un conjunto de sesiones que antes producían un JWT
  válido y ahora no producen ninguno. Ningún caso que antes fuera rechazado pasa a emitirse.
