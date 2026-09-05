# ADR 0050: `confirmed` decide qué se escribe, y el valor lo pone el lote enviado

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-007

## Contexto

La respuesta de `POST /api/internal/sync/availability` es `200 { applied, confirmed }`. Las dos
cifras se parecen y no significan lo mismo, y confundirlas rompe el criterio 4 sin ningún error
visible:

- **`applied`** es el número de filas que el otro lado **cambió**. Su `updateMany` lleva
  `NOT: { availability }`, así que un item cuyo valor ya coincidía **no cuenta**. Reenviar un lote
  idéntico da `applied: 0` con todo confirmado.
- **`confirmed`** son los items que ese lado **resolvió**: pares `[storeProductId, storeId]`, uno por
  item cuya tienda existe en el negocio autenticado. Incluye los que no cambiaron nada.

Además, `confirmed` **no devuelve el enum**. Solo dice qué items se resolvieron. El valor que hay que
guardar en `dispPublicada` no viene en la respuesta: está en el lote que acabamos de enviar.

Y hay una tercera cuestión, de frontera: la respuesta la escribe un tercero. Nada impide
—ni un fallo, ni un `QAB_API_BASE_URL` mal apuntado, ni un servidor comprometido— que devuelva pares
que no estaban en el lote.

## Decisión

**`confirmed` es lo único que autoriza una escritura, y el valor escrito sale del lote enviado.**

La función pura `planAvailabilityWrites(sent, outcome)` cruza los pares de `confirmed` contra las
filas de la página que se acaba de enviar, comparando **`storeProductId` y `storeId` a la vez**, y
para cada coincidencia toma la disponibilidad **de la fila enviada**. Un par que no corresponde a
ninguna fila enviada se **ignora**, sin error y sin log: es la misma regla que `planOutboxAck` ya
aplica en el drenaje del catálogo —QAB nunca puede hacer que esta corrida escriba una fila que no
mandó—, y aquí protege además contra un `storeProductId` de otra tienda.

`applied` **no decide ninguna escritura, y no se guarda en ninguna parte**: ni en el informe de la
fase, ni en el log, ni en una columna. Se lee al validar la respuesta y se descarta.
`applied < confirmed.length` es un resultado normal, no un fallo.

Una fila enviada que no aparece en `confirmed` **no se escribe**: sigue divergente, y la corrida
siguiente la vuelve a levantar sola. No hay contador de intentos, ni columna de «en fallo», ni
reencolado: divergente es divergente (regla de negocio 4 del spec).

La escritura se aplica **por grupos de valor**, con un `updateMany` por cada disponibilidad distinta
de la página (tres como mucho):

```ts
await qabPrisma.productoTienda.updateMany({
  where: { id: { in: productoTiendaIds }, tienda: { negocioId } },
  data: { dispPublicada: availability },
});
```

Tres detalles vinculantes de esa sentencia:

- **`tienda: { negocioId }` está en el `where` aunque los ids ya vengan de una consulta filtrada por
  ese mismo negocio.** El filtro del `id` viene de datos que pasaron por un tercero; el del tenant,
  no. Es la frontera, y no se omite porque «no haga falta».
- **`updateMany`, no `createMany`.** [E-024] documenta una escritura en lote que no falla y no
  escribe; aquí el riesgo equivalente sería creer que la escritura ocurrió sin mirar el `count`. El
  `count` de cada `updateMany` se **suma y se publica** en el informe de la fase (`written`), que es
  lo que hace verificables los criterios 1, 4, 5 y 7 sin abrir la base.
- **Sin `NOT: { dispPublicada: availability }`.** El otro lado sí filtra por valor distinto, porque
  su `updateMany` toca `syncedAt`; aquí no. Sin ese recorte, `written` es el número de filas que la
  sentencia encontró, y cualquier diferencia con los items confirmados es una señal real (una fila
  borrada entre la lectura y la escritura), no ruido.

`written` se compara contra los confirmados, pero **no se promete que sean iguales**: una fila puede
desaparecer entre la lectura y la escritura, y eso no es un fallo de nadie ([E-017]).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Escribir todo lo enviado cuando la respuesta es `200` | Rompe el criterio 4: un item que el otro lado no resolvió quedaría marcado como publicado y no se reintentaría nunca. Es precisamente la propiedad de auto-reparación que el contrato describe |
| Usar `applied` para saber qué se escribió | `applied` es un conteo, no una lista, y además excluye los items que ya coincidían. Un reenvío idéntico daría `applied: 0` y no se escribiría nada de lo que sí estaba confirmado |
| Confiar en `confirmed` sin cruzarlo con el lote enviado | Deja que un tercero elija qué filas de nuestra base se escriben. El drenaje del catálogo ya rechaza eso mismo, y aquí es más grave: el valor no lo pone la respuesta, así que un par desconocido ni siquiera tendría un valor que escribir |
| Cruzar solo por `storeProductId`, ignorando `storeId` | El par es lo que el otro lado devuelve; comparar la mitad tira gratis una comprobación de coherencia entre tienda y producto |
| Guardar un contador de intentos por fila divergente | El spec lo prohíbe explícitamente y no haría falta: la divergencia **es** la cola. Un contador añade una columna, una migración y un estado que se puede quedar desincronizado |
| Un `update` por item | Hasta 2000 viajes por página contra el pooler. Los grupos por valor son tres sentencias como mucho |

## Consecuencias

**A favor:**

- La confirmación parcial funciona sin ningún estado extra: lo no confirmado sigue divergente y sale
  solo en la corrida siguiente (criterio 4).
- Ninguna respuesta de QAB puede provocar una escritura sobre una fila que esta corrida no mandó, ni
  sobre una de otro negocio.
- El informe de la fase (`items`, `requests`, `confirmed`, `written`) permite verificar los criterios
  contando, sin leer código y sin abrir la base.

**En contra / coste asumido:**

- El cruce mantiene la página enviada en memoria hasta procesar la respuesta: hasta 2000 filas de
  cuatro campos cortos, por negocio y en serie.
- `applied` no queda registrado en ningún sitio, así que no se puede usar a posteriori para
  diagnosticar. Es deliberado: como señal de éxito es engañosa —`applied: 0` con todo confirmado es
  el resultado normal de un reenvío— y `confirmed`/`written` del informe describen mejor lo mismo.
- La escritura no es transaccional con el envío. Un fallo entre el `200` y el `updateMany` deja la
  fila divergente: se reenvía y se confirma otra vez, sin daño. La idempotencia del otro lado es lo
  que lo hace inofensivo.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant:** el `negocioId` está en el `where` de la lectura (por `Tienda`) y en el
  de la escritura. El `businessId` del cuerpo **no es una defensa**: viaja por exigencia del contrato
  y el otro lado lo comprueba contra el token; de este lado no filtra nada.
- Tres sentencias de escritura como mucho por página, no una por item.
- Nada del cuerpo de la respuesta se registra en un log ni se guarda en una columna: se lee
  `confirmed`, se cruza y se descarta. Sigue la regla de logs del contrato de F-002 —un cuerpo de
  QAB es contenido de un tercero sin verificar— y no espeja ningún estado suyo (ADR 0022).

[E-017]: ../../.agents/errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md
[E-024]: ../../.agents/errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md
