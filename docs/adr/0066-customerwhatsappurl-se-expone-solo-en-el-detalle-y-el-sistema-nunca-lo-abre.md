# ADR 0066: `customerWhatsappUrl` se expone solo en el detalle, se vuelve a filtrar por esquema al salir, y el sistema nunca lo abre por su cuenta

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-012
**Se apoya en:** [ADR 0013](0013-lectura-del-qabtoken-con-select-explicito.md) ·
[ADR 0004](0004-enums-del-contrato-como-texto.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md)

## Contexto

`customerWhatsappUrl` **lo compone QAB** y viaja en cada pedido del pull desde la v5. Es un enlace
`wa.me` con el teléfono del comprador y un texto prellenado, y llega `null` cuando el teléfono
guardado no tiene dígitos utilizables. El contrato es tajante en dos puntos: cuadrecaja **no lo
reconstruye nunca** desde `contactPhone`, y **nadie lo envía solo** — «lo abre una persona, el
encargado, con un clic».

F-010 ya lo persiste en la columna homónima de `PedidoEntrante`, aplicando en la entrada
`safeCustomerWhatsappUrl`: un valor que no empiece por `https://` se guarda como `NULL`, nunca se
rechaza el pedido entero.

F-011 lo dejó **fuera de la respuesta a propósito**: ni `TIENDA_ONLINE_ORDER_LIST_SELECT` ni
`TIENDA_ONLINE_ORDER_DETAIL_SELECT` lo nombran, y su contrato lo dice explícitamente («No expone
`customerWhatsappUrl` … Son de F-012»). El motivo es ADR 0013: un `select` explícito vence al `omit`
global, así que una columna solo sale si alguien la escribe, y no se escriben las que no se
necesitan.

Ahora hace falta, y la pregunta es dónde y con qué garantías.

## Decisión

**`customerWhatsappUrl` se añade únicamente a `TIENDA_ONLINE_ORDER_DETAIL_SELECT` y a
`tiendaOnlineOrderSchema`. Antes de publicarlo se comprueba su HOST, no solo su esquema, y la
decisión de mostrar el botón se toma sobre ese valor y sobre ningún otro.**

### 1. Solo en el detalle

El listado no lo lleva. No es una omisión: el contrato de diseño de F-011 (§ 12) ya fijó que **no
hay acciones por fila en el listado** —«accionar un pedido exige haberlo leído»—, y el botón de
WhatsApp es una acción. Añadirlo al `select` del listado sería publicar el teléfono de cada
comprador de la página en un cuerpo que nadie usa.

En el detalle sí, y no expone una clase de dato nueva: esa misma respuesta ya lleva `contactPhone`,
`contactName`, `contactEmail` y `contactAddress` desde F-011.

### 2. Al salir se comprueba el HOST, no solo el esquema

El valor pasa por `toSafeWhatsappUrl` (`src/schemas/qabWhatsappUrl.ts`), que devuelve `null` salvo
que la cadena quepa en `QAB_ORDER_URL_MAX_LENGTH`, empiece por `QAB_ORDER_URL_REQUIRED_PREFIX`,
parsee como `URL`, y su **`hostname` sea exactamente `QAB_ORDER_WHATSAPP_HOST`** (`"wa.me"`, el
único host que el contrato v10.1 usa en sus dos ejemplos del campo; no aparece ningún otro en todo
el documento). En caso contrario devuelve `null`, nunca lanza.

**El prefijo por sí solo no defiende nada, y es el error que este apartado corrige.**
`QAB_ORDER_URL_REQUIRED_PREFIX` es literalmente `"https://"`: lo satisface cualquier dirección de
internet, `https://atacante.example/phishing` incluida. Este mismo ADR describe el dato como «un
enlace `wa.me`» y modela el valor hostil llegando a la columna; si la guarda solo mirase el esquema,
la protección prometida no sería la implementada. Lo que está en juego es un botón cuyo copy dice
«escribir al comprador por WhatsApp» llevando al encargado a cualquier sitio: ingeniería social
contra el personal de la tienda. El `rel="noopener noreferrer"` mitiga el *tabnabbing*, **no** el
destino.

Se compara `hostname` y no el texto en crudo, porque `https://wa.me@atacante.example/` empieza por
`https://wa.me` y su host es `atacante.example`. `URL` además normaliza las mayúsculas del host, así
que no hace falta hacerlo a mano.

`QAB_ORDER_URL_REQUIRED_PREFIX` **no se toca**: lo usa `safeCustomerWhatsappUrl` de F-010 en la
**entrada**, y esa constante significa lo que significa allí. Esta es una guarda **de salida**, con
su propia constante. Que el prefijo se compruebe dos veces no es una paráfrasis (E-014): la de la
entrada decide **qué se guarda**; esta decide **qué se le da al navegador para que lo siga**, sobre
una columna `String?` que la base no restringe y que una migración, un script de siembra o una
corrección a mano pueden dejar con cualquier cosa.

El `new URL(...)` va dentro de un `catch` **que no liga la excepción**. El matiz, comprobado
ejecutándolo y no supuesto: en Node 22 el `TypeError` dice exactamente `Invalid URL` y **no** cita el
valor en el mensaje —a diferencia del `BigInt` del ADR 0060 o del `JSON.parse` de F-010—, pero el
**objeto** de error sí lo lleva en `error.input`. O sea que `logRouteError(error)`, que solo escribe
`name` y `message`, sería inocuo aquí, y un `console.error(error)` o cualquier serialización del
objeto publicaría el valor en crudo. No ligar la excepción quita la pregunta en vez de dejarla a
merced de qué versión de Node y qué forma de loguear haya el día que alguien toque esa línea
(E-031).

Y una sola definición para las dos capas: el schema de la respuesta se declara con un `.refine` sobre
esa misma función, no con un segundo predicado. Por eso la función vive en `src/schemas/`: si viviera
en el mapper —que importa schemas— la arista de vuelta cerraría un ciclo de valor (E-028).

Con esa garantía, una fila rara se convierte en `null` en vez de tumbar la respuesta entera del
detalle por fallar su propio schema.

### 3. El botón se decide por `customerWhatsappUrl`, jamás por `contactPhone`

La pantalla muestra el enlace **si y solo si `customerWhatsappUrl !== null`**. No mira
`contactPhone`, no cuenta dígitos, no compone nada.

Esto importa porque el criterio 6 está redactado desde la causa —«un pedido sin dígitos utilizables
en el teléfono no muestra el botón»— y la causa vive en QAB. Del lado de cuadrecaja el observable es
el `null`, y son dos cosas distintas: el enlace también puede llegar `null` porque QAB decidiera
otra cosa, o porque el valor guardado no pasara el filtro del punto 2. El comportamiento es el mismo
en los tres casos, y la regla escrita es la del `null` — que es la que se puede comprobar.

Sembrar un pedido con `contactPhone` presente y `customerWhatsappUrl: NULL` es lo que distingue una
implementación correcta de una que se puso a mirar el teléfono.

**Y no hay otro observable, comprobado y no supuesto.** El contrato sí define un campo legible por
máquina con esa causa, `customerWhatsappReason: "NO_PHONE_DIGITS"`, pero **solo en la respuesta de
`POST /api/internal/orders/proposal`**. En el payload del pull —el único que F-012 ve— los tres
campos que la v5 añadió son `cancelledBy`, `customerWhatsappUrl` y `proposal`: la causa se explica en
prosa, en un comentario del documento, y no viaja como dato. **F-013 sí llamará a `/orders/proposal`
y sí recibirá ese campo**; será suya la decisión de persistirlo si alguna vez hace falta dar la causa
verificada en vez de inferida.

### 4. El sistema nunca envía nada

No hay ninguna llamada, ni ningún `fetch`, ni ninguna redirección automática hacia ese enlace. Es un
enlace que abre una persona. Es regla del contrato de QAB, no una preferencia de este proyecto, y no
tiene excepción: tampoco al confirmar, ni al marcar entregado, ni al cancelar.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reconstruir el enlace desde `contactPhone` cuando llega `null` | El contrato lo prohíbe explícitamente. Y el texto prellenado lo compone QAB con datos del pedido que este lado no tiene; un `wa.me` fabricado aquí abriría un chat vacío hacia un número que quizá no es de WhatsApp |
| Exponerlo también en el listado, para un botón por fila | El diseño de F-011 ya decidió que no hay acciones por fila; publicaría el teléfono de todos los compradores de la página sin que nadie lo use |
| Confiar en el filtro de F-010 y no volver a comprobar al salir | La columna no tiene restricción en la base y el valor acaba siendo un enlace que alguien pulsa. Es la única salida de esta respuesta que ejecuta una navegación |
| Comprobar solo el esquema `https://` al salir, sin el host | Es lo que decía la primera versión de este ADR, y lo tumbó la auditoría de seguridad: `https://` lo cumple cualquier dirección, así que la guarda no defendía de nada de lo que el propio ADR decía defender |
| Ampliar `QAB_ORDER_URL_REQUIRED_PREFIX` a `https://wa.me/` en vez de añadir una constante de host | Esa constante gobierna lo que el pull **guarda**, y endurecerla cambiaría el comportamiento de F-010 —un enlace de otro host pasaría de guardarse a descartarse— sin que ningún criterio de F-012 lo pida. Y no cubre `https://wa.me?x=1`, que no lleva la barra y sí es del host correcto |
| Validar el host solo en el schema Zod de la respuesta, sin la función | El `parse` de toda la respuesta fallaría por un enlace raro y devolvería un `500`: se perdería la pantalla entera del pedido. Y el schema y el mapper acabarían con dos redacciones de la misma regla (E-014) |
| Normalizar y devolver `url.href` en vez de la cadena original | Reescribiría el `?text=` prellenado que compuso QAB. No es nuestro |
| Decidir el botón mirando `contactPhone` | Es la trampa del criterio 6: se comporta bien en el caso normal y falla en el único que el criterio existe para probar |
| Enviar el mensaje desde cuadrecaja | Prohibido por el contrato, y sería el proyecto mandando mensajes en nombre del comerciante a un comprador |

## Consecuencias

**A favor:**

- El criterio 5 se recorre pulsando el enlace, y el 6 sembrando `customerWhatsappUrl: NULL` con
  `contactPhone` presente — que además discrimina de verdad entre las dos implementaciones posibles
  (E-008).
- El listado sigue sin llevar el teléfono compuesto de nadie.
- Un valor corrupto en la columna no rompe la pantalla: se convierte en «sin enlace», que es un
  estado que la pantalla ya sabe pintar.

**En contra / coste asumido:**

- Un pedido cuyo enlace se filtró por el punto 2 se ve igual que uno que nunca lo tuvo, y la pantalla
  no puede decir cuál de las dos cosas pasó. Es deliberado: la diferencia no le sirve de nada al
  encargado, y distinguirla obligaría a publicar el valor rechazado.
- La comprobación del prefijo está escrita en dos sitios. Está justificado arriba, y la constante que
  define **qué** prefijo es sigue siendo una sola.
- **El host queda fijado a `wa.me` en una constante.** Si QAB empezara algún día a componer enlaces
  con otro host —`api.whatsapp.com`, por ejemplo, que hoy no aparece en el contrato—, todos esos
  enlaces se verían como «sin enlace» hasta que alguien añada el host aquí. Es el fallo en la
  dirección correcta: se pierde un botón, no se gana un destino.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** el campo sale por el `select` del detalle, cuya consulta ya resuelve
  por la clave compuesta `id_negocioId` y filtra por `tiendaId: { in: tiendaIds }` (F-011 § 9.2). No
  hay ninguna vía nueva.
- **Superficie de datos personales:** el detalle gana un campo derivado de un teléfono que esa misma
  respuesta ya publicaba. El listado no gana ninguno.
- El filtro de salida cierra la vía de un enlace hacia un **destino** arbitrario ofrecido desde
  nuestra propia pantalla con el copy de «escribir al comprador»: es una defensa contra ingeniería
  social hacia el personal de la tienda, no solo contra un esquema raro. Un `target="_blank"` hacia
  un tercero exige además `rel="noopener noreferrer"` — eso mitiga el *tabnabbing*, que es otra cosa;
  es del contrato de diseño y del implementer, y aquí queda anotado para que no se olvide.
- El `catch` sin ligar del `new URL(...)` es la tercera vez que este proyecto aplica la misma
  respuesta a E-031: no dejar que el runtime fabrique el mensaje.
- Coste nulo: una columna más en un `select` que ya lee la fila entera del pedido.
