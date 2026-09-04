# ADR 0030: El endpoint de cambio de estado de un pedido aplica el gate y responde 501 sin escribir, hasta F-011

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-004
**Se apoya en:** [ADR 0028](0028-gate-del-interruptor-de-tienda-online.md) ·
[ADR 0007](0007-aislamiento-de-pedidoentrantelinea-con-fk-compuesta.md) ·
[ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md)

## Contexto

El criterio 5 de F-004 exige que un usuario con `tiendaonline.pedidos.acceder` y sin
`tiendaonline.pedidos.gestionar` reciba **403 al intentar cambiar el estado de un pedido**. Para que
eso sea verificable ejecutando algo, el endpoint tiene que existir hoy.

Pero la mecánica real de cambiar el estado de un pedido es de **F-011**, y no es un `UPDATE`:

- `PedidoEntrante.status` guarda uno de los nueve valores de `QAB_ORDER_STATUSES` como texto libre
  (ADR 0004). Qué transiciones son legales lo fija el contrato de queandabuscando, no el POS.
- El pedido vive en **dos sistemas**. Cambiarlo aquí sin decírselo a QAB deja al comprador viendo un
  estado y al vendedor viendo otro. El camino de vuelta —el outbox, o la llamada directa— es
  precisamente lo que F-011 tiene que diseñar, y este feature declara explícitamente que «no toca el
  cable de sync».
- El cron de pull (`src/lib/qab/orderPoll.ts`) reescribe estos pedidos desde QAB. Un `status`
  escrito localmente y no propagado sería revertido en la siguiente corrida, en silencio.

Escribir «solo por dejarlo funcionando» significa, entonces, escribir una divergencia entre dos
sistemas con un `UPDATE` de una línea. Y el spec ya acotó la frontera: el endpoint existe «solo para
aplicar el gate».

Queda la pregunta de qué contestarle a quien **sí** pasa el gate. Ese caso no aparece en ningún
criterio, y las opciones no son equivalentes: un `200` diría que se hizo algo que no se hizo, y
dejaría a `qa` sin forma de distinguir un endpoint que funciona de uno vacío.

## Decisión

**Aplica los gates, valida la forma, resuelve el pedido dentro de su negocio, y responde
`501 { "error": "NOT_IMPLEMENTED" }`. No escribe en la base ni habla con QAB.**

`PATCH /api/tienda-online/pedidos/[pedidoId]/status`, en este orden exacto:

1. `assertTiendaOnlineAccess(session, TIENDA_ONLINE_PERMISOS.pedidosGestionar)` → `403 FORBIDDEN`.
   Exige `.gestionar`, no `.acceder`. Va **antes** de leer el cuerpo y antes de tocar la base: un
   llamante sin derecho no llega a parsear nada, no provoca ninguna consulta, y recibe el mismo 403
   exista o no el pedido.
2. `request.json()` en `try/catch` → `400 INVALID_BODY`. El error no se registra: un `SyntaxError`
   arrastra un fragmento de la entrada.
3. `pedidoEntranteStatusUpdateSchema.safeParse` → `400 INVALID_BODY`. Nunca se devuelve ni se loguea
   `issues`. El schema valida **forma**: acepta los nueve estados del enum, incluidos los que no
   serían una transición legal. Eso es de F-011.
4. `prisma.pedidoEntrante.findUnique({ where: { id_negocioId: { id: pedidoId, negocioId } }, select: { id: true } })`
   → `404 PEDIDO_NOT_FOUND`. La clave compuesta `@@unique([id, negocioId])` (ADR 0007) mete la
   tenencia **dentro** de la clave: no hay una versión de esta consulta que se olvide del filtro.
5. `501 NOT_IMPLEMENTED`.

**El 501 no es un placeholder perezoso: es lo que hace observable el orden de las comprobaciones.**
Con `.acceder` y sin `.gestionar` la respuesta es 403; con `.gestionar`, sobre el mismo pedido
sembrado, es 501. Dos `curl` y el criterio 5 queda demostrado junto con su contraprueba —que el 403
venía del permiso y no de que el endpoint estuviera roto—.

El 501 es además seguro de cara al frontend: no es 401 (no dispara `signOut()`, E-007) y no es 403
(el interceptor de `axiosClient` no le toca el cuerpo, E-009), así que llega íntegro. Y no espeja
ningún estado de QAB, porque no se habla con QAB (ADR 0022).

Cuando F-011 implemente la transición real, **sustituye el paso 5**. Los pasos 1 a 4 y la ruta se
quedan como están.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Escribir el `status` de verdad | Desincroniza cuadrecaja y QAB con un `UPDATE` de una línea, sin validación de transiciones y sin aviso al otro sistema. El cron de pull lo revertiría después, en silencio. Es exactamente el trabajo que F-011 tiene que diseñar |
| Escribirlo «solo si la transición es obvia» | Decidir qué transición es obvia **es** la regla de negocio de F-011. Media regla escrita hoy es la que nadie recuerda revisar mañana |
| Responder `200` sin hacer nada | Miente. Y borra la diferencia entre «el gate pasó» y «el endpoint hace algo», que es justo lo que `qa` tiene que poder ver |
| Responder `204 No Content` | Igual de mentiroso y además sin cuerpo: no queda dónde decir por qué no pasó nada |
| No crear el endpoint y verificar el criterio 5 en F-011 | El criterio 5 es de F-004 y `features.json` no se toca. Sin endpoint, el feature no se puede cerrar ejecutando nada |
| `405 Method Not Allowed` | Falso: el método es correcto y la ruta lo acepta. Un 405 mandaría a quien lo reciba a buscar el verbo bueno |
| `503 Service Unavailable` | Sugiere una indisponibilidad temporal de infraestructura e invita a reintentar. Esto no está caído: no está construido |
| Validar el `status` contra la máquina de transiciones ya en F-004 | Inventarle reglas de negocio a un feature de andamiaje. El spec lo excluye por escrito |

## Consecuencias

**A favor:**

- El criterio 5 se verifica hoy, ejecutando, sin esperar a F-011 y sin escribir nada en la base.
- El par 403/501 hace **demostrable** que el gate corrió primero, que es la propiedad que este
  feature existe para instalar.
- F-011 hereda la ruta, el gate, la validación de forma y la resolución del pedido ya aislada por
  negocio. Solo tiene que sustituir el desenlace.
- No se escribe un `status` que el cron tendría que revertir, ni queda un `UPDATE` sin propagar como
  precedente para copiar.

**En contra / coste asumido:**

- Queda en `main` un endpoint que **no hace su trabajo**. Si F-011 se retrasara, alguien puede
  encontrarlo y creer que está roto. El cuerpo `NOT_IMPLEMENTED` y este ADR son toda la señalización
  que tiene.
- `501` es un estado poco frecuente en el repositorio. Ningún interceptor lo trata de forma especial
  —lo cual es la razón de elegirlo—, pero es un número que hay que reconocer al leer un log.
- El endpoint consume una consulta a `PedidoEntrante` para no hacer nada con ella. Es el precio de
  que el 404 por pedido ajeno o inexistente ya esté probado antes de que F-011 lo necesite.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** el `negocioId` sale de la sesión y entra en la clave compuesta de la
  consulta. Un pedido de otro negocio y uno inexistente devuelven el mismo 404: no hay oráculo de
  existencia, y no hay ninguna ruta por la que un `pedidoId` ajeno llegue a una escritura.
- **Superficie:** el endpoint no devuelve ningún dato del pedido, ni siquiera al llamante
  autorizado. `select: { id: true }` y un cuerpo de error.
- **Escalabilidad:** una lectura por clave única y ninguna escritura. Sin transacción, sin bloqueos
  y sin interacción con el drenaje del outbox (ADR 0010, ADR 0015).
- **Reversión:** el paso 5 es una línea. Sustituirla por la implementación real de F-011 no deshace
  nada de lo escrito aquí.
