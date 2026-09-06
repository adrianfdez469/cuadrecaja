# ADR 0069: El enlace SSO se emite por un `POST` que devuelve la URL en JSON, y no por un `GET` que redirige

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-009
**Se apoya en:** [ADR 0016](0016-la-puerta-de-api-valida-solo-la-cookie-de-nextauth.md) ·
[ADR 0028](0028-gate-del-interruptor-de-tienda-online.md) ·
[E-009](../../.agents/errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md)

## Contexto

El enlace SSO es, mientras vive, **una credencial**: cualquiera que tenga esa URL entra al panel de
QAB como el comerciante. Dura ~60 s y se quema al primer canje, pero durante esos 60 s es
exactamente eso.

La forma obvia de entregárselo al navegador es un `<a href="/api/tienda-online/sso">` que responda
`302` hacia QAB: un clic, cero JavaScript, y el token no pasa nunca por el cliente. Es la forma en
la que están escritos los enlaces de correo del repositorio.

Aquí no sirve, y por una razón que no se ve leyendo el código: **un `GET` puede dispararse sin que
nadie haga clic**. El `<Link>` de Next hace prefetch de lo que aparece en pantalla; los navegadores
y sus extensiones especulan sobre enlaces al pasar el cursor; un escáner de enlaces de un antivirus
o de un cliente de correo los sigue. Cualquiera de esos accesos emite un token, y —lo que de verdad
duele— si esa especulación llega hasta QAB, **consume el `jti`**. El comerciante hace clic después y
recibe un enlace ya canjeado, con un error de QAB que no habla de nada que él haya hecho.

Y hay una segunda incompatibilidad, esta con el módulo. Los seis endpoints de Tienda Online
comparten un contrato de refusal: **un solo `403` con cuerpo JSON `FORBIDDEN`, nunca un `401`**,
porque `src/lib/axiosClient.ts` convierte cualquier `401` en un `signOut()` y echa al usuario de la
aplicación (E-007). Una ruta que redirige no puede participar de ese contrato: tendría que decidir
qué hacer con un usuario sin permiso —¿redirigir a una pantalla de error?, ¿devolver JSON y romper
su propia forma?— y sería la única del módulo con dos comportamientos según el desenlace.

## Decisión

**`POST /api/tienda-online/sso`, sin cuerpo, que responde `200 { url }` con la URL completa hacia
QAB.** El cliente la abre; el servidor no redirige a ninguna parte.

**El handler no lee el cuerpo de la petición.** No llama a `request.json()` ni a `request.text()`,
y no mira la query. No es que valide y descarte lo que llegue: **no hay ninguna línea que lea nada
del llamador**. Esa es la razón de escribirlo aquí en vez de dejarlo como detalle de
implementación — el criterio 10 del spec («el endpoint no acepta un `jti`, una expiración ni un
`storeIds` propuestos por el cliente») queda satisfecho por ausencia de código, no por una guarda
que alguien podría ampliar sin darse cuenta (E-032).

La respuesta lleva `Cache-Control: no-store`, como todo el módulo, y aquí no es cosmético: el cuerpo
contiene una credencial viva.

El gate es el del módulo, en el orden que fija ADR 0028 —interruptor primero, permiso después— a
través de `assertTiendaOnlineAccess`, y su `403` es el mismo cuerpo genérico que los demás.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `GET` que responde `302` hacia QAB | Un `GET` lo dispara un prefetch, una extensión o un escáner de enlaces, sin clic humano. En el mejor caso emite tokens que nadie usa; en el peor, el escáner llega hasta QAB, consume el `jti` y el comerciante recibe un enlace muerto. Y no puede honrar el `403` con cuerpo JSON que comparten los otros seis endpoints del módulo. |
| `POST` que responde `303` hacia QAB | Resuelve el prefetch pero no el `403`, y obliga a la pantalla a navegar con un formulario en vez de con el servicio del módulo. Se pierde el manejo de errores que `tiendaOnlineService.ts` ya normaliza para las otras cinco llamadas. |
| Devolver el JWT suelto (`{ token }`) y componer la URL en el cliente | El origen de QAB pasaría a ser un dato del navegador, y componer una URL a mano en la pantalla es donde nacen las erratas de dominio que § 5 de QAB describe como el fallo más fácil de dejar mal. El servidor ya validó el origen con `resolveQabBaseUrl`; que salga compuesto de ahí. |
| Que el `POST` acepte un cuerpo con `storeIds` para «abrir el panel en un local concreto» | Sería exactamente la vulnerabilidad que el criterio 10 previene. Elegir sucursal es un asunto del panel, que ya sabe cuáles trae la sesión. |
| Registrar cada emisión en una tabla propia, para poder auditar quién pidió qué | El `jti` lo consume QAB, que es quien tiene la restricción única y quien sabe si el enlace se canjeó. Una tabla aquí guardaría intenciones, no hechos, y guardaría el `jti` de una credencial viva. Si algún día hace falta auditoría, el sitio es el mismo patrón de `TIENDA_ONLINE_SAVE_AUDIT_LOG`: una línea de log sin el token. |

## Consecuencias

**A favor:**

- Ningún prefetch, ninguna especulación del navegador y ningún escáner de enlaces puede emitir un
  token: hace falta una acción explícita del usuario.
- El endpoint entra en el contrato del módulo sin excepciones: mismo `403`, mismo `no-store`, mismo
  servicio, mismo manejo de errores en la pantalla.
- El criterio 10 es una propiedad estructural del handler, no una guarda que revisar.

**En contra / coste asumido:**

- La pantalla necesita JavaScript: el enlace no funciona con el navegador sin ejecutar scripts. En
  una aplicación que ya es enteramente cliente autenticado, no cambia nada.
- **`window.open` después de un `await` lo bloquean muchos navegadores**, porque para entonces se ha
  perdido el gesto del usuario. Es el escollo real de esta decisión, y le toca resolverlo a quien
  escriba la pantalla —abrir la ventana en el propio manejador del clic y navegarla al resolverse la
  promesa, o navegar en la misma pestaña—. Queda escrito aquí porque el síntoma («no pasa nada al
  pulsar») no se parece en nada a su causa.
- La URL con el token acaba igualmente en el historial del navegador. No lo evita ninguna de las
  formas consideradas; lo neutraliza QAB consumiendo el `jti`, que es justo para lo que existe.

**Impacto en seguridad y escalabilidad:**

- El cuerpo de la respuesta es una credencial de ~60 s. `Cache-Control: no-store` es obligatorio y
  no un adorno: una caché intermedia que la guarde la deja legible después de que el usuario cierre
  la pestaña.
- **Aislamiento multi-tenant:** el llamador no aporta ni un dato al token. `businessId` y `storeIds`
  salen de la sesión (ADR 0067), y el interruptor se lee de la base contra ese mismo `negocioId`.
- Sin límite de frecuencia de emisión: un usuario autorizado puede pedir tantos enlaces como quiera.
  No se pone tope porque cada uno caduca en 60 s, se quema al primer uso, no cuesta E/S (no hay
  consulta más allá del gate) y no concede nada que su sesión no conceda ya. Si alguna vez hiciera
  falta, el sitio es el mismo gate.
