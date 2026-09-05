# ADR 0061: Las dos vías por las que el runtime podría citar `Order.code`, cortadas

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

`PedidoEntrante.code` es el `Order.code` de QAB, y es la **única credencial de la página pública del
comprador**: quien lo tiene ve nombre, teléfono y dirección. El criterio 8 pide que no aparezca en
ningún log del servidor. El criterio 13 lo extiende con la lección de **E-031**, que ocurrió en
F-010 con este mismo dato:

> El contrato prescribía `INVALID_RESPONSE_BODY:<primer issue>` para un cuerpo inválido. Pero un
> fallo de `JSON.parse` no tiene «primer issue»: es un `SyntaxError` de V8, y **V8 cita un fragmento
> del cuerpo** dentro de su mensaje. En esa ruta el cuerpo llevaba los `Order.code`. La regla estaba
> escrita, se respetaba en todos los sitios donde alguien la escribe a mano, y se incumplía por una
> vía que nadie escribe.

Lo que F-011 hace con `code` y que **no** es lo prohibido: lo devuelve en la respuesta de las dos
rutas de lectura y lo muestra en pantalla, para que el encargado reconozca el pedido. El spec lo
dice explícitamente.

Lo que hay que impedir es que un mensaje **fabricado por el runtime** —`JSON.parse`, Zod, el driver
de Prisma— acabe pasando por `logRouteError` con un `code` dentro.

## Decisión

**F-011 no escribe ninguna línea de log propia, y las dos vías por las que un mensaje de runtime
podría llevarse un `code` se cortan en el código, no en la prosa.**

### Lo que F-011 escribe en la salida del servidor

Nada, salvo el `logRouteError(error)` del `catch` que produce el `500` genérico. F-011 **no lee ni
escribe**: no tiene una línea de auditoría equivalente al `TIENDA_ONLINE_SAVE_AUDIT_LOG` de F-005 ni
al `QAB_PRODUCT_PUBLISH_AUDIT_LOG` de F-006, porque no hay ninguna escritura que auditar.
`logRouteError` registra únicamente `error.name` y `error.message`.

### Vía 1 — el `rateSnapshot`, leído sin lanzar

`rateSnapshot` es un `Json?` de terceros y es el sitio natural donde sembrar un dato corrupto
(criterio 13). Se lee con `parseQabRateSnapshot`, que usa **`safeParse`** y devuelve `null` cuando
el schema lo rechaza: sus `issues` no se devuelven ni se registran. La lectura de una tasa
individual sigue la misma disciplina: una tasa ilegible se descarta y devuelve `null` (ADR 0060).

No hay ningún `JSON.parse` sobre el `rateSnapshot`: Prisma ya entrega el valor deserializado. El
único `JSON.parse` de F-011 es el `await request.json()` del `PATCH`, sobre el **cuerpo de la
petición**, que nunca lleva un `code`; ya va dentro de su propio `try/catch` que responde `400` sin
registrar nada, tal como lo dejó F-004.

### Vía 2 — el `parse` de la respuesta, con su propio `catch`

Las respuestas del módulo se validan con un schema `.strict()` antes de salir, y ese `parse` corre
**dentro** del `try` que produce el `500` (F-004, §6). Un `ZodError` serializa sus `issues` en
`error.message`, y esos `issues` pueden arrastrar valores del objeto validado — que aquí es la
respuesta entera, `code` incluido.

Así que el `parse` de la respuesta va en su **propio** `try/catch`, que registra una constante fija
y nunca el error:

```ts
try {
  body = tiendaOnlineOrdersPageSchema.parse(payload);
} catch {
  console.error(TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG);
  return internalErrorResponse();
}
```

`TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG` vive en `src/constants/tiendaOnline.ts` y es un literal
sin interpolación: no hay ninguna rama que pueda devolver texto proveniente de la fila. Es
exactamente el remedio de E-031 (`MALFORMED_BODY_REASON`), aplicado al otro extremo del mismo
problema.

### Vía 3 — Prisma, cerrada por construcción

Un error de Prisma puede nombrar los argumentos de la consulta. **Ninguna consulta de F-011 pone
`code` en un `where`, en un `orderBy` ni en un `cursor`**: se filtra por `id`, por `negocioId`, por
`tiendaId` y por `status`, y se ordena por `createdAt` e `id` (ADR 0057). El índice
`@@index([negocioId, code])` existe desde F-001 y este feature no lo usa.

### Lo que este ADR NO afirma

- No dice nada sobre logs escritos **fuera** de F-011: el pull de F-010, el registro de consultas de
  Prisma si alguien lo activa, o el log de peticiones de la plataforma.
- No dice que `code` no salga del servidor. Sale, en el cuerpo de las dos respuestas de lectura, y
  se muestra en pantalla. Eso es deliberado.
- No dice que ninguna excepción pueda llegar nunca a `logRouteError` con contenido de fila dentro.
  Dice que las tres vías conocidas por las que eso podría pasar en este feature están cortadas, y
  cuáles son.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Confiar en que `logRouteError` solo registra `name` y `message` | Es exactamente la confianza que falló en E-031: el `message` **es** el sitio donde el runtime cita el dato |
| Redactar el `code` de los mensajes con una expresión regular antes de registrarlos | Hay que acertar con la forma del `code` —una cadena de hasta 64 caracteres sin formato fijo— y un filtro que se le escape uno no avisa. Cortar la vía es verificable; filtrar la salida es esperanza |
| No devolver `code` en la respuesta | Dejaría al encargado sin la referencia con la que identifica el pedido, y el spec dice explícitamente que mostrarlo no es lo que el criterio prohíbe |
| Quitar el `parse` de la respuesta para que no pueda lanzar | El `parse` es lo que sostiene el canario `z.literal(true)` de `tiendaOnlineScaffoldSchema` (F-004, §6): si el gate dejara pasar un negocio apagado, ese `parse` lanza. Se conserva; lo que cambia es qué se registra cuando falla |
| Registrar el `error.name` del `ZodError` y no el `message` | `ZodError` es un solo nombre para todos los fallos, así que no aporta nada sobre la constante fija, y deja la puerta abierta a que alguien «mejore» el log añadiendo el `message` |

## Consecuencias

**A favor:**

- El criterio 13 se verifica sembrando un `rateSnapshot` corrupto y un `code` mal formado y
  mirando la salida del servidor: la respuesta degrada (`conversion: null`, o un `500` con la
  constante fija) y ninguna línea cita el `code` de ningún pedido de la respuesta.
- El criterio 8 se verifica provocando un pedido real y revisando la salida: F-011 no añade ninguna
  línea propia a la salida del servidor.
- La regla queda atada a estructuras que un `grep` encuentra —`safeParse`, la constante del log, la
  ausencia de `code` en cualquier `where`— y no a la disciplina de quien escriba el siguiente
  `console.error`.

**En contra / coste asumido:**

- **El diagnóstico de un fallo de serialización se pierde.** Cuando la respuesta no valide, en el
  log solo habrá `TIENDA_ONLINE_ORDER_RESPONSE_INVALID` y habrá que reproducirlo en desarrollo para
  saber qué campo falló. Es el mismo intercambio que F-010 aceptó con `MALFORMED_JSON`, y es el
  correcto: un dato personal en un log es permanente y un diagnóstico se puede volver a obtener.
- El `try/catch` extra alrededor del `parse` es ruido en tres handlers. Se acepta por lo que compra.
- `conversion: null` no distingue «no había snapshot» de «el snapshot estaba corrupto», precisamente
  porque el motivo no se propaga (ADR 0060).

**Impacto en seguridad y escalabilidad:**

- Es el aspecto de seguridad central de este feature junto con el aislamiento: `code` da acceso a
  los datos personales del comprador sin ninguna otra credencial.
- Ningún coste de rendimiento: un `try/catch` y un `safeParse` que ya había que hacer.
