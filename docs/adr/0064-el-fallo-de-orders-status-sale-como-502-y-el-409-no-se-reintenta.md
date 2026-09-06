# ADR 0064: El fallo de `POST /orders/status` se clasifica por el estado HTTP, sale como `502` con vocabulario cerrado, y el `409` de envío sin cotizar no se reintenta nunca

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-012
**Se apoya en:** [ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) ·
[ADR 0033](0033-la-previsualizacion-del-slug-pasa-por-una-ruta-propia-y-es-orientativa.md) ·
[ADR 0063](0063-qab-decide-primero-y-la-base-local-despues.md) ·
[E-009](../../.agents/errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md)

## Contexto

`POST /api/internal/orders/status` puede terminar de siete maneras distintas según el contrato
v10.1, y dos de ellas tienen que llegar al encargado con palabras propias:

- `404 UNKNOWN_ORDER` — QAB no conoce ese `orderId`, o es de otro negocio (§ vocabulario de errores).
- `409 ORDER_DELIVERY_NOT_QUOTED` — se intentó llevar a `READY`, `IN_TRANSIT` o `DELIVERED` un
  pedido con `deliveryFeePending: true`. **Nada se escribe del otro lado.** Es la primera guarda de
  transición del contrato (v6) y **QAB todavía no la emite**: es la única parte del contrato
  publicada antes de estar construida.

Y tres restricciones que no se pueden negociar:

1. **`axiosClient` sustituye el cuerpo de cualquier `403` por un error genérico de permisos**
   (E-009). Si un desenlace de QAB saliera con `403`, el frontend no podría distinguirlo del `403`
   de `.gestionar`, y le diría al encargado que le falta un permiso que sí tiene. Es el criterio 10
   del spec, y es literalmente el defecto que el ADR 0022 ya cerró en F-003.
2. **El cuerpo de error de QAB es datos de un tercero.** Puede traer una forma inesperada, y por
   `/orders/status` viaja un pedido cuyo `Order.code` es la credencial de una página pública. Un
   `JSON.parse` sobre él fabrica un `SyntaxError` que **cita un fragmento del cuerpo** (E-031, ya
   tres apariciones).
3. **Reintentar el `409` no lo arregla.** El propio contrato lo dice en su tabla de riesgos: hay que
   tratarlo «como “falta cotizar”, no como un fallo transitorio que se reintenta». Un pedido sin
   cotizar rechazado se queda quieto por muchas veces que se pida lo mismo; lo que lo desbloquea es
   una cotización, y eso es F-015.

## Decisión

**Todo desenlace que no sea un `200` sale de la ruta como `502` con el cuerpo
`{ error: "QAB_STATUS_UPSTREAM", qabError: <código cerrado>, retryable: <bool> }`, la clasificación
se hace por el estado HTTP sin leer el cuerpo de error, y ninguna parte de este feature reintenta la
llamada.**

### 1. El estado de QAB no se espeja: `502` siempre

Es el ADR 0022 aplicado a la octava ruta que lo necesita. Consecuencias directas:

- El `403 BUSINESS_INACTIVE` de QAB **no** sale como `403`. El único `403` de esta ruta es el de
  `.gestionar`, con cuerpo `FORBIDDEN`, y eso es el criterio 10 satisfecho por construcción: no hay
  ninguna otra rama del código que produzca un `403`.
- El `401 UNAUTHORIZED` de QAB tampoco se espeja: `axiosClient` traduce cualquier `401` a
  `signOut()`, y un token de negocio mal acuñado expulsaría de la aplicación al encargado (E-007).
- El `404 UNKNOWN_ORDER` de QAB **no** sale como `404`. Un `404` de esta ruta significa una cosa y
  solo una: el pedido está fuera del alcance de esta sesión, con el cuerpo `PEDIDO_NOT_FOUND` que
  produce `tiendaOnlineOrderNotFoundResponse()` (F-011, decisión 2). Que QAB no conozca un pedido
  que nosotros sí tenemos guardado es otra cosa, y va por el `502` con `qabError: "UNKNOWN_ORDER"`.

### 2. La clasificación se hace por el estado HTTP, y el cuerpo de error nunca se lee

En un desenlace distinto de `200`, el cliente **cancela el cuerpo de la respuesta sin leerlo** y
resuelve el código con una función pura sobre el número de estado:

| Estado de QAB | `qabError` |
|---|---|
| `400` | `INVALID_BODY` |
| `401` | `UNAUTHORIZED` |
| `403` | `BUSINESS_INACTIVE` |
| `404` | `UNKNOWN_ORDER` |
| `409` | `ORDER_DELIVERY_NOT_QUOTED` |
| `503` | `SYNC_NOT_CONFIGURED` |
| cualquier otro | `UNEXPECTED_STATUS` |

Se puede hacer porque **para esta ruta cada uno de esos estados tiene un solo cuerpo documentado**:
`ORDER_NOT_PROPOSABLE` y `CURRENCY_MISMATCH` son de `/orders/proposal`, `INVALID_BATCH` y
`BUSINESS_MISMATCH` exigen un `businessId` en el cuerpo que esta petición no lleva, e
`INVALID_QUERY` es del `GET`. Leer el cuerpo no añadiría ni un bit de información y sí abriría la
vía de E-031.

Esto **no** es un absoluto sobre QAB: si mañana el contrato añadiera un segundo cuerpo bajo uno de
esos estados, esta tabla lo etiquetaría con el código de la fila. Sería una etiqueta imprecisa sin
consecuencia — ninguna de las dos lecturas sería reintentable ni saldría con un estado distinto —, y
se corrige en la tabla, que es un solo sitio.

El único cuerpo que sí se lee es el del `200`, con un tope propio, y solo para comprobar que trae
`ok: true`. Un `200` cuyo cuerpo no lo satisfaga es `INVALID_RESPONSE_BODY` y **no se escribe nada
en la base**: un proxy mal apuntado que conteste `200` con una página de error no puede hacer creer
a cuadrecaja que el comprador ya vio el cambio.

### 3. El resultado del cliente no tiene ningún campo de texto

`postQabOrderStatus` devuelve `{ kind: "ok" }` o `{ kind: "error"; code }`, y `code` es un valor de
`QAB_ORDER_STATUS_FAILURE_CODES`. **No hay ningún `string` libre donde algo del otro lado pudiera
alojarse.** Es una diferencia deliberada con `fetchQabOrdersPage`, que sí devuelve
`error: string`: aquel escribe `OutboxEvento.ultimoError` y necesita un mensaje; este no tiene dónde
ponerlo ni para qué.

### 4. `retryable`, y por qué el `409` está fuera

El cuerpo del `502` lleva `retryable`, calculado desde `QAB_ORDER_STATUS_RETRYABLE_CODES`, que tiene
exactamente tres valores: `TRANSPORT`, `INVALID_RESPONSE_BODY` y `UNEXPECTED_STATUS`. Los siete
restantes —`ORDER_DELIVERY_NOT_QUOTED` el primero— son `false`.

**`retryable: true` no significa que el servidor haya reintentado.** Significa que la pantalla puede
ofrecerle a una persona el botón de volver a intentarlo. En este feature **nada reintenta solo**, y
eso lo sostienen cuatro cosas comprobables, no una promesa:

1. `postQabOrderStatus` no tiene ningún bucle y emite exactamente un `fetch` por llamada.
2. La ruta la llama exactamente una vez y devuelve; no hay `for`, ni `while`, ni recursión.
3. En el navegador, el interceptor de `src/lib/axiosClient.ts` solo reintenta ante `ECONNABORTED` o
   `ERR_NETWORK` **y** solo si el método está en `IDEMPOTENT_METHODS` o la petición lleva cabecera
   de idempotencia. Un `PATCH` sin esa cabecera no cumple ninguna de las dos, y un `409` no es
   ninguno de esos dos códigos: son dos motivos independientes, y basta cualquiera.
4. La pantalla no re-lanza la petición por su cuenta ante un `502`; qué ofrece en cada caso lo fija
   el contrato de diseño.

**La frontera que hereda F-015** es esta y no hay que rediseñarla: cotizar es lo que desbloquea un
`ORDER_DELIVERY_NOT_QUOTED`, así que F-015 añade el camino de la cotización y **no** mueve ese
código a la lista de reintentables. Si algún día lo hiciera, estaría reintentando una llamada que el
propio contrato de QAB documenta como permanentemente rechazada mientras el envío siga sin cotizar.

### 5. Ninguna guarda local del `409`

Cuadrecaja **no** mira `deliveryFeePending` antes de llamar para adelantarse al `409`. La guarda es
de QAB, y reimplementarla aquí sería la misma regla escrita en dos sistemas: la copia local se
quedaría vieja el día que el contrato la ajuste, y una guarda más ancha que la del contrato pasa
todas sus propias pruebas (E-032). El `409` se provoca, se recibe y se explica.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Espejar el estado de QAB (`404` como `404`, `409` como `409`) | El `403 BUSINESS_INACTIVE` llegaría al navegador como «Acceso denegado… asigne los permisos necesarios» (E-009) y hundiría el criterio 10; el `401` provocaría un `signOut()`. Y un `404` de esta ruta ya significa otra cosa: el pedido está fuera del alcance de la sesión |
| Leer el cuerpo de error y usar su campo `error` para clasificar | Añade un `JSON.parse` sobre datos de un tercero en el camino de una ruta cuyo pedido lleva un `Order.code`, para obtener información que el estado HTTP ya da entera (E-031) |
| Un código propio distinto por cada desenlace (`QAB_UNKNOWN_ORDER`, `QAB_DELIVERY_NOT_QUOTED`, …) en vez de `qabError` | Dispersa en `TIENDA_ONLINE_API_ERRORS` un vocabulario que ya está cerrado en `@/constants/qab`, y se aparta del precedente del pronóstico de slug, que es la misma situación resuelta en este mismo módulo |
| No publicar `qabError` y responder un `502` genérico | Deja a la pantalla una sola frase para siete situaciones, una de las cuales (`NOT_CONFIGURED` / `SYNC_NOT_CONFIGURED`) el propio comerciante puede arreglar, y otra (`ORDER_DELIVERY_NOT_QUOTED`) es literalmente lo que el criterio 4 exige distinguir |
| No leer el cuerpo del `200` y dar por bueno cualquier `200` | Un `QAB_API_BASE_URL` mal apuntado a algo que responda `200` haría que cuadrecaja escribiera el estado nuevo creyendo que el comprador ya lo ve — que es exactamente la mentira que el ADR 0063 existe para evitar |
| Adelantar el `409` mirando `deliveryFeePending` antes de llamar | Duplica una regla que vive en QAB y que hoy ni siquiera está construida allí; la copia local envejece sola y nadie prueba la rama que sobra (E-032) |
| Un `retryable` calculado por el llamante en vez de una constante | La misma pregunta contestada en dos sitios diverge la primera vez que alguien afine uno (E-014) |

## Consecuencias

**A favor:**

- El criterio 10 no depende de disciplina: **no existe** ninguna rama del código que produzca un
  `403` que no sea el de `.gestionar`.
- El cuerpo de error de QAB no entra en un `JSON.parse`, en un log, en una excepción ni en la
  respuesta. No es una regla que cumplir: no hay código que lo lea.
- El criterio 4 se recorre entero con un servidor HTTP de captura que devuelva el `409` exacto, sin
  necesitar la v6 de QAB, y sin ningún gancho de test en el código.
- F-015 hereda una frontera escrita: cotizar, no reintentar.

**En contra / coste asumido:**

- El estado HTTP de la respuesta de cuadrecaja ya no dice qué falló: hay que leer `qabError`. Es el
  coste que el ADR 0022 ya aceptó, y el motivo por el que ese campo existe.
- Un cuerpo de error que QAB añadiera bajo un estado ya usado se etiquetaría con el código de la
  fila. Es impreciso y no es peligroso; se corrige en la tabla.
- Se pierde el detalle del cuerpo para diagnosticar. A cambio, no hay ninguna vía por la que un
  `Order.code` de un cuerpo con forma inesperada llegue a un log.

**Impacto en seguridad y escalabilidad:**

- El tope de la respuesta del `200` (`QAB_ORDER_STATUS_MAX_RESPONSE_BYTES`) es el único que este
  cliente aplica, y acota un cuerpo documentado de un solo campo booleano: no hay ninguna página, ni
  ningún lote, cuyo tamaño pueda no caber (E-029). Los cuerpos de error no se leen, así que ningún
  tope los gobierna: el flujo se cancela.
- Un servidor que no responda queda acotado por `QAB_HTTP_TIMEOUT_MS` (10 s), sin transacción
  abierta detrás (ADR 0063).
- Ningún reintento significa que un QAB caído cuesta exactamente una petición por pulsación humana,
  no una tormenta.
