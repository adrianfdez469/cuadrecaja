# ADR 0022: Ningún estado HTTP de QAB se espeja — el alta responde `502` con el código en el cuerpo

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md) ·
[E-007](../../.agents/errors/E-007-pagina-publica-que-llama-a-una-api-cerrada.md)

## Contexto

`POST /api/negocio/[id]/qab/credential` es un proxy: recibe una pulsación del superadministrador,
llama a `POST /api/provisioning/credential` de QAB y tiene que contar lo que pasó. La tentación
—y lo que hace la mitad de los proxies del mundo— es reexpedir el estado de arriba tal cual.

Aquí eso rompe **dos criterios distintos**, y solo uno de los dos está escrito en la lista.

**El 401, que sí está escrito (criterio 18).** `src/lib/axiosClient.ts` traduce **cualquier** 401 a
`signOut({ callbackUrl: "/login" })`. Si `QAB_PROVISIONING_SECRET` está mal configurada, QAB
responde `401 UNAUTHORIZED`; espejarlo expulsaría de la aplicación al superadministrador que acaba
de pulsar un botón, en vez de decirle que revise el secreto. Es E-007, encontrado en F-018, con
otro disfraz.

**El 403, que no lo está, y que hunde el criterio 8 en silencio.** El mismo interceptor hace esto:

```ts
if (status === 403) {
  const url = error.config?.url ?? "recurso desconocido";
  return Promise.reject(
    new Error(`Acceso denegado a ${url}. Por favor asigne los permisos necesarios.`),
  );
}
```

**Sustituye el error por uno nuevo y el cuerpo de la respuesta desaparece.** El criterio 8 exige
que los seis códigos de la ruta *"se distingan en la UI y ninguno se presente como error
genérico"*, y uno de los seis es `403 BUSINESS_INACTIVE` («el negocio está dado de baja en QAB, y
esta ruta no lo reactiva»). Si se espeja, la pantalla no recibe `BUSINESS_INACTIVE`: recibe
literalmente *«Acceso denegado a /api/negocio/…/qab/credential. Por favor asigne los permisos
necesarios.»* — el error genérico que el criterio prohíbe, y además **falso**: no falta ningún
permiso.

Este segundo caso no lo detecta ningún test unitario y no se ve leyendo la ruta: solo aparece
recorriendo la pantalla con un negocio dado de baja en QAB. Es la misma clase de fallo que E-007
—piezas correctas que se rompen al componerse— y la misma causa: el interceptor de Axios trata dos
códigos HTTP como si tuvieran un único significado posible en toda la aplicación.

Hay además una razón que no depende del interceptor. Espejar el estado de un sistema de arriba
**miente sobre quién falló**. Un `401` en la respuesta de cuadrecaja significa «tu sesión con
cuadrecaja no vale»; un `403`, «tu usuario de cuadrecaja no puede». Que QAB no reconozca el secreto
del integrador no es ninguna de las dos cosas.

## Decisión

**Las rutas de F-003 nunca emiten el estado HTTP que devolvió QAB. Todo fallo del lado de QAB sale
como `502 Bad Gateway`, con el código en el cuerpo:**

```jsonc
{ "error": "QAB_PROVISIONING_UPSTREAM", "qabError": "BUSINESS_INACTIVE", "retryable": false }
```

`qabError` es uno de los diez de `QAB_PROVISIONING_UPSTREAM_CODES` — los seis del criterio 8 más
`TRANSPORT`, `INVALID_RESPONSE_BODY`, `UNEXPECTED_STATUS` y `EXTERNAL_ID_MISMATCH`. `502` es el
estado honesto: *esta* ruta funciona, la de arriba no dio una respuesta utilizable.

Tres reglas que se derivan, y que valen para toda ruta de cuadrecaja que hable con un tercero:

1. **`401` es exclusivamente de la puerta del middleware.** Ningún route handler lo emite. Es la
   regla que el ADR 0019 ya fijó, escrita ahora para el caso de un fallo **de arriba** y no de
   sesión.
2. **`403` es exclusivamente para la autorización de cuadrecaja** —«hay sesión y no eres
   `SUPER_ADMIN`»— y solo aparece en un caso que la pantalla nunca provoca, porque no se le
   muestra a quien no lo es. Que el interceptor lo convierta en un mensaje de permisos ahí es
   correcto.
3. **`retryable` viaja en el cuerpo, no se deduce del estado.** El criterio 8 pide que
   `TOKEN_COLLISION` se ofrezca como reintentable; con todos los fallos bajo un mismo `502`, la
   pantalla no puede inferirlo del código HTTP, así que el servidor lo dice. Son reintentables
   `TOKEN_COLLISION`, `TRANSPORT`, `INVALID_RESPONSE_BODY` y `UNEXPECTED_STATUS`.

Y una consecuencia de diseño que hace falta escribir: **el servicio de `src/services/` normaliza
ese cuerpo a una excepción tipada** (`QabProvisioningError` con `code`, `qabError` y `retryable`),
para que la pantalla nunca tenga que leer un `error.response.status`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Espejar el estado de QAB | Rompe el criterio 18 (401 → `signOut`) y el criterio 8 (403 → mensaje genérico de permisos, con el cuerpo destruido) |
| Espejar todo menos el 401 | Arregla el criterio 18 y deja abierto el 403, que es el que nadie ve venir. Media regla es peor que ninguna: invita a espejar «los que no dan problema» hasta que uno lo dé |
| Responder `200` siempre, con el error en el cuerpo | Un fallo deja de ser un fallo para el navegador, para los reintentos de Axios y para cualquier monitorización futura. Y obliga a cada llamante a acordarse de mirar dentro |
| `400` para todos los fallos de arriba | Dice que el cliente mandó algo mal, y el cliente no mandó nada: la ruta no acepta cuerpo, el `externalId` sale del path |
| Arreglar `axiosClient` para que no toque el 403 | Es el interceptor del que dependen todas las pantallas de la aplicación; cambiarlo desde un feature de tienda online es un diff de más con alcance global. Si algún día se revisa, este ADR es el catálogo de lo que hoy depende de él |
| Un estado nuevo por cada código de QAB (`409`, `422`…) | Vuelve a mezclar dos vocabularios. El del contrato ya existe y es un string; que viaje como string |

## Consecuencias

**A favor:**
- Los seis códigos del criterio 8 llegan íntegros a la pantalla, incluido `BUSINESS_INACTIVE`, y
  ninguno pasa por el interceptor de Axios.
- El superadministrador no puede ser expulsado por un fallo de configuración del otro lado
  (criterio 18).
- La regla es de una línea y se puede auditar por `grep`: en las rutas de F-003 no aparece
  `status: 401` en ningún sitio, y `status: 403` solo tras `hasSuperAdminPrivileges()`.
- El `502` separa en los registros del servidor «esta aplicación falló» (`500`) de «la de al lado
  no respondió» (`502`), que es exactamente la distinción que se necesita para saber a quién avisar.

**En contra / coste asumido:**
- Quien lea la respuesta con `curl` ve un `502` donde arriba hubo un `403`. El cuerpo lo dice, pero
  hay un salto mental. Es el precio de no mentir sobre quién falló.
- Se depende de que `axiosClient` siga comportándose así. Si algún día deja de convertir el 403,
  esta decisión sigue siendo correcta por la razón semántica (segundo párrafo de la Decisión), no
  solo por el interceptor.

**Impacto en seguridad y escalabilidad:**
- El cuerpo del `502` **no contiene nada de QAB salvo un código de un enum cerrado**: ni el cuerpo
  de su respuesta, ni cabeceras, ni la URL, ni el secreto. Un enum cerrado no puede filtrar lo que
  no está en él.
- No se expone si el secreto es incorrecto o simplemente corto: QAB responde `401` en los dos
  casos (`despliegue.md` § 8.1) y cuadrecaja no añade información.
- Ningún cambio de coste: es la forma de la respuesta, no una consulta ni un dato persistido.
  Reversión inmediata.
