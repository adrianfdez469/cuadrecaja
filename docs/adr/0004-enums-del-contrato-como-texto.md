# ADR 0004: Los enums del contrato se persisten como texto, sin `enum` de Postgres y sin clave foránea

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

El contrato con queandabuscando define varios conjuntos cerrados de valores que cuadrecaja tiene que
guardar: el `status` de un pedido (nueve valores), `cancelledBy` (tres), la disponibilidad publicada
(tres), la `entity` y la `operation` de un evento del outbox (cinco y tres), y el `currencyCode` de
un pedido y de cada línea.

El instinto de cualquiera que modele esto es un `enum` de Postgres —o, para la moneda, una clave
foránea a `Moneda`—. Los dos son un error, y la historia del contrato dice por qué:

- **El enum de estados ya subió de 6 a 9 valores en la v5**, sin periodo de convivencia. El
  `historial_de_roturas` del backlog registra que **tres de los cuatro saltos de versión rompieron
  compatibilidad**, y que el autor los justifica siempre igual: en cuadrecaja no había nada
  construido. Ese argumento deja de valer a partir de este feature.
- **El modo de falla es del lado de cuadrecaja y no hay ningún error HTTP que avise.** El pull
  responde `200`; el valor nuevo llega dentro de la carga. Si la columna es un `enum` de Postgres,
  el `INSERT` de ese pedido revienta y el poller se queda atascado en ese id **para siempre**, sin
  poder avanzar el cursor.
- Con una FK a `Moneda`, basta con que QAB conozca una moneda que cuadrecaja todavía no tenga dada
  de alta para que **el lote entero del pull se caiga por una fila**.

Y el mismo hecho se lee en el otro sentido: nadie quiere perder la validación. Un `status`
inventado tiene que poder guardarse, pero también tiene que poder distinguirse de uno conocido en el
momento de decidir qué hacer con el pedido.

El criterio 9 de F-001 lo pide con todas las letras: las nueve inserciones pasan, la décima con
`'FUTURO_DESCONOCIDO'` **también**, y `information_schema` tiene que decir `text`, no
`USER-DEFINED`.

## Decisión

**Todo conjunto cerrado que venga de queandabuscando se persiste como `String` (texto), y se valida
en el borde con Zod, no en la base.**

Concretamente:

- `PedidoEntrante.status`, `PedidoEntrante.cancelledBy`, `ProductoTienda.dispPublicada`,
  `OutboxEvento.entidad` y `OutboxEvento.operacion` son `String` / `String?`. **Ningún `enum` de
  Prisma ni de Postgres en toda la integración.**
- `PedidoEntrante.currencyCode` y los dos `currencyCode` de la línea son `String` **sin relación a
  `Moneda`**.
- Los valores conocidos viven en `src/constants/qab.ts` (`QAB_ORDER_STATUSES`,
  `QAB_ORDER_CANCELLED_BY`, `QAB_AVAILABILITY`, `QAB_OUTBOX_ENTITIES`, `QAB_OUTBOX_OPERATIONS`), no
  repartidos como cadenas mágicas.
- La validación se parte en dos schemas, y la distinción es la decisión de verdad:
  - `qabOrderStatusSchema` — texto no vacío. **Es lo que se persiste**, y nunca rechaza.
  - `qabOrderStatusKnownSchema` (`z.enum(QAB_ORDER_STATUSES)`) + `isKnownQabOrderStatus()` — lo que
    se consulta al **decidir**.
- La regla de comportamiento que heredan F-010 en adelante: **un estado desconocido se guarda y se
  muestra tal cual, y nunca cae por defecto en una rama que actúe.** Un `switch` sin `default`
  explícito sobre estos valores es un bug esperando la siguiente versión del contrato.

`entidad` guarda el **valor del cable en inglés** (`"PRODUCT"`), no el `"PRODUCTO"` del fragmento
ilustrativo del contrato: así ninguno de los dos lados traduce al leer, que es el principio que el
propio contrato declara.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `enum` de Postgres para `status` | Un valor nuevo revienta el `INSERT` y atasca el poller en ese id sin avanzar el cursor. Es literalmente el modo de falla que el criterio 9 existe para impedir. |
| `enum` de Postgres más una migración por cada versión del contrato | Ata un despliegue de cuadrecaja a cada publicación de queandabuscando, y el contrato ya demostró que sube de versión sin coordinarse. Entre que rompe y que se migra, el pull está caído. |
| `enum` de Prisma sobre una columna `text` | Prisma valida en el cliente, así que el `INSERT` desde el ORM falla igual, y encima la protección desaparece en cuanto alguien escribe SQL. Lo peor de las dos opciones. |
| `CHECK (status IN (…))` en la columna | Es un `enum` con otro nombre: mismo fallo, misma migración por versión. |
| FK de `currencyCode` a `Moneda` | Una moneda que QAB conoce y cuadrecaja no tumba el lote entero del pull. La integridad referencial aquí compra menos de lo que cuesta. |
| Texto libre y ninguna lista de valores conocidos | Se pierde la capacidad de distinguir lo conocido de lo desconocido justo donde importa: al decidir. Y devuelve las cadenas mágicas al código, que `AGENTS.md` prohíbe. |

## Consecuencias

**A favor:**
- Una versión nueva del contrato **no puede** tumbar el pull de pedidos: lo desconocido se guarda y
  queda visible para que una persona decida.
- Ninguna migración de esquema cuando el enum crezca otra vez: solo se amplía la constante.
- La lista de valores conocidos está en un único sitio y es tipada.

**En contra / coste asumido:**
- La base ya no garantiza la integridad de estos valores: una escritura defectuosa puede meter
  basura y nadie la para. Se acepta a cambio de que el pull no se rompa, y se compensa validando en
  el borde.
- Cada consumidor tiene que tratar explícitamente el caso «estado desconocido». Es más código, y es
  código que hay que acordarse de escribir.
- `text` ocupa algo más que un `enum`. Irrelevante al volumen de esta tabla.

**Impacto en seguridad y escalabilidad:**
- Ningún efecto sobre el aislamiento entre tenants.
- Seguridad de negocio: el riesgo real que este ADR gestiona es un pedido que se despacha o se
  cancela por haber caído en la rama equivocada de un `switch` que no conocía su estado. De ahí la
  regla de que un estado desconocido **nunca actúa por defecto**.
- Escalabilidad operativa: evita el acoplamiento de despliegue entre las dos organizaciones, que es
  lo que de verdad no escala cuando el contrato sube de versión sin avisar.
