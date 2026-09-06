# ADR 0088: La tarjeta del panel no se adelanta al servidor: el botón sigue pulsable y el estado nuevo se alcanza al recibir el `409`

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-023
**Se apoya en:** [ADR 0086](0086-el-rechazo-por-usuario-sin-forma-de-correo-es-un-cuarto-desenlace-y-sale-como-un-409-propio.md) ·
[E-021](../../.agents/errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md) ·
[E-018](../../.agents/errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md) ·
[E-016](../../.agents/errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md)

## Contexto

El dato que decide el rechazo —`session.user.usuario`— **ya está en el navegador**. La tarjeta
podría comprobarlo sola y no mandar nunca una petición condenada.

Y no es una idea traída de fuera: `PanelAccessCard` **ya hace exactamente eso** para otra cosa.
Calcula `withoutStores` llamando a `selectQabSsoStoreIds`, la propia función del servidor, sobre los
locales de la sesión, y con eso pinta un aviso antes de que nadie pulse nada. El precedente del
mismo archivo empuja a resolver F-023 igual: importar `isQabSsoIssuableEmail`, y si devuelve
`false`, sustituir el botón por el aviso.

El criterio 4 exige que la validación viva en el servidor «no solo ocultando el botón». Eso no
prohíbe por sí mismo hacer las dos cosas. Lo que sí decide es el criterio 1, que está escrito así:

> «**pulsar la accion del panel** NO emite ningun enlace y muestra un mensaje que nombra la causa»

Un criterio se ejecuta con su redacción, no con su intención
([E-018](../../.agents/errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md)). Si la
tarjeta se adelanta y retira el botón, no hay acción que pulsar y el criterio 1 no se puede
recorrer tal como está escrito. Y un criterio ya escrito no se modifica (regla del backlog): se
implementa de forma que se pueda ejecutar.

Hay además una razón que no depende de cómo esté redactado nada. `session.user.usuario` sale de
`token.usuario`, que se fija **en el login** y no se relee en vivo
([E-021](../../.agents/errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md)). Es un dato
que puede estar viejo. Una comprobación de cliente sobre él es una segunda autoridad que puede
discrepar del servidor, y discrepar en las dos direcciones.

## Decisión

**En F-023 la tarjeta no comprueba el `usuario` de la sesión. El botón se queda donde está, la
petición sale, y el estado nuevo se alcanza al recibir el `409`.**

- `IPanelAccessState` gana un octavo miembro, `"userNotEmail"`, alcanzable **solo** desde el `catch`
  del `mint()`, al lado de `denied` y `notConfigured`. No hay ninguna otra vía de entrada.
- El estado `idle` no cambia: mismo botón, mismo sitio, mismo `label`. La tarjeta se comporta igual
  para todos los usuarios hasta que el servidor responde.
- `withoutStores` **se queda como está**. No se toca, no se le añade una condición y no se convierte
  en el sitio donde vive esta decisión: son dos avisos distintos sobre dos cosas distintas.
- El copy y el aspecto del estado nuevo son del `ui-designer` (`.agents/designs/F-023.md`). Esta
  decisión fija **cuándo** aparece, no qué dice.

Y una restricción que el copy tiene que respetar, porque sale de E-021 y no de una preferencia:
cambiar el `usuario` a un correo **no surte efecto hasta el siguiente inicio de sesión**. El mensaje
tiene que decirlo, o la acción que el criterio 2 exige explicar deja al comerciante pulsando el
mismo botón y viendo el mismo error después de haber hecho lo que se le pidió.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ocultar o deshabilitar el botón cuando la sesión no es emitible | Deja el criterio 1 sin acción que pulsar, y crea una segunda autoridad sobre un dato que puede estar viejo: la sesión sigue llevando el `usuario` del login (E-021). Un usuario que ya lo corrigió vería el botón bloqueado; uno cuyo `usuario` se editó a peor lo vería habilitado. Las dos direcciones fallan |
| Pintar el aviso **además** del botón, antes de pulsar | El criterio 2 compara el `textContent` del mensaje contra el copy del contrato de diseño. Dos apariciones del mismo texto —una preventiva y otra tras el `409`— multiplican la superficie de [E-016](../../.agents/errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) sin añadirle nada al comerciante, que va a pulsar igual |
| Comprobar en el cliente y **no** en el servidor | El criterio 4 lo prohíbe con todas las letras: `curl` autenticado contra el endpoint tiene que devolver el error. Ocultar un botón no es una validación |
| Refrescar la sesión antes de decidir, para que el dato no esté viejo | Recalcular la sesión en vivo es E-021 entero y afecta a toda la aplicación: permisos, locales y `localActualId`. No cabe en un feature cuyo alcance es no firmar un JWT |
| Un `useEffect` que pida el enlace al montar, para enterarse antes | Emitir un JWT de SSO sin que nadie lo pida es exactamente lo que la ruta evita siendo `POST` y no `GET` (ADR 0069): un token que se acuña solo es un token que un prefetch consume |

## Consecuencias

**A favor:**

- **Una sola autoridad.** Lo que la pantalla muestra es siempre lo que el servidor decidió, con el
  dato con el que el servidor lo decidió. No hay forma de que las dos mitades discrepen.
- El criterio 1 se puede recorrer literalmente: hay un botón, se pulsa, y aparece el mensaje.
- La tarjeta no importa la función pura, así que la lógica de emisión no se filtra al cliente. El
  precedente de `selectQabSsoStoreIds` sigue siendo el único, y sigue siendo para otra cosa.

**En contra / coste asumido:**

- **Un usuario no emitible gasta una petición para enterarse, cada vez que pulsa.** Es el coste
  aceptado. La petición cuesta lo que ya costaba cualquier otro desenlace de esta ruta —el gate del
  módulo, que ya existía— y `issueQabSsoLink` no consulta la base (ADR 0067).
- El aviso llega después de un viaje de ida y vuelta, con el botón en su estado de carga por el
  medio. Para este caso es lo mismo que ya pasa con `denied` y con `notConfigured`.
- Si en el futuro se quiere el aviso preventivo, hay que reabrir el criterio 1 en un feature nuevo:
  no se puede añadir sin invalidar la forma en que este se verificó.

**Impacto en seguridad y escalabilidad:**

- La decisión de quién puede emitir un JWT no se toma nunca en el navegador, que es la propiedad que
  el criterio 4 pide y la única que importa aquí.
- Ni una consulta nueva por petición, ni un dato nuevo leído de la sesión.
- El caso no emitible es, por construcción, poco frecuente y decreciente: son las cuentas anteriores
  a que `EMAIL_REGEX` llegara al alta, más las del seed. No es un camino que crezca con el negocio.
