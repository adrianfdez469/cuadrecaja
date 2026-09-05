# ADR 0062: La bandeja reenvía los importes del pedido verbatim y no recalcula ninguno

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

`toTiendaOnlineOrderAmounts` proyecta cinco columnas de `PedidoEntrante` —`subtotal`,
`discountTotal`, `deliveryFee`, `total` y `deliveryFeePending`— en la unión discriminada del
ADR 0059. En la rama `PENDING_QUOTE` el importe se llama `partialTotal`, y el contrato **no decía**
de dónde sale ese número: si es `total` reproyectado, o si se calcula como
`subtotal - discountTotal`.

Las dos lecturas son defendibles, porque el spec fija las dos igualdades del contrato de QAB:

```
deliveryFeePending false -> total = subtotal - discountTotal + deliveryFee
deliveryFeePending true  -> total = subtotal - discountTotal   (PARCIAL)
```

Si esas igualdades se cumplieran siempre, la pregunta no tendría consecuencia. **No se cumplen
siempre, y por decisión explícita.** F-010 evalúa `qabOrderTotalsAreConsistent` sobre cada pedido y,
cuando falla, **lo escribe igual**: solo incrementa `inconsistentTotals` del informe de la corrida
(`src/lib/qab/orderPoll.ts:230`, ADR 0053). Es decir, un pedido cuyo `total` no cuadra con sus
componentes es un estado real y persistido de la base, no una hipótesis.

Cómo apareció la pregunta merece decirse, porque es el pipeline funcionando: `implementer` y
`dev-tester` escribieron sin verse, los dos vieron el hueco, **ninguno lo resolvió por su cuenta**, y
el tester dejó el caso que separa las dos lecturas como un `it.todo` con un `total` deliberadamente
inconsistente. Hasta ese momento **ningún test las distinguía**, porque los fixtures hacían coincidir
las dos — que es E-008 con otra ropa: la prueba pasaba y habría pasado igual con la otra lectura.

Y la pregunta de fondo no es de mapper: es **si este POS se cree el importe que la tienda online le
mandó, o lo recalcula por su cuenta**.

## Decisión

**Los cinco importes se reenvían verbatim. La bandeja no hace aritmética con el dinero de un
pedido.**

`partialTotal` es `total` reproyectado a cadena de escala fija, igual que `total` en la rama
`QUOTED`. Ninguno de los dos se calcula a partir de `subtotal` y `discountTotal`.

Respuesta al `it.todo` de `src/__tests__/tiendaOnlineOrderMapping.test.ts`: con un `total`
inconsistente de `"999.99"`, **`partialTotal` es `"999.99"`** — la lectura A.

Lo único que `toTiendaOnlineOrderAmounts` decide es **qué rama** de la unión se construye, y eso
sale de `deliveryFeePending` y de nada más (ADR 0059). Qué números lleva dentro no lo decide: los
copia.

**Es la misma regla que el ADR 0060 ya fijó para `unitPrice`**, y esa coherencia es la mitad del
motivo. Allí el valor almacenado es el que el comprador aceptó y el recomputado es una señal de
verificación que **nunca lo sustituye**. Un POS que reenvía el precio unitario tal cual y a la vez
recalcula el total tendría dos reglas para la misma pregunta, a cuarenta líneas de distancia en el
mismo módulo — que es exactamente la forma del defecto de E-014.

**No se añade ninguna señal de consistencia a la respuesta.** F-010 ya observa este hecho donde
corresponde: en el pull, con `inconsistentTotals`, contado por corrida y volcado en la línea de log
del cron (`inconsistent=N`, sin citar ningún pedido). Publicar un segundo indicador aquí sería una
segunda definición del mismo hecho, calculada en otro sitio y con otra oportunidad de divergir.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Recalcular `partialTotal` como `subtotal - discountTotal` (lectura B) | Garantiza que lo que se ve cuadre consigo mismo, y a cambio inventa un número que no existe en ningún otro sitio: ni en la página del comprador, ni en QAB, ni en nuestra propia base. El encargado y el comprador leerían totales distintos del mismo pedido, y el que estaría mal sería el nuestro |
| Recalcular también `total` en la rama `QUOTED` | Lo mismo, y además codifica en la pantalla una igualdad cuyo dueño es el contrato de QAB. El día que la v-siguiente meta un concepto nuevo en el total, nuestra cuenta diverge en silencio; reenviarlo sobrevive al cambio |
| Reenviar verbatim y **además** publicar un `totalsConsistent` | Es la simetría aparente con `matchesStored` del ADR 0060, y no es el mismo caso: allí la comprobación **solo existe si la hace F-011**, porque nadie más recompone el `unitPrice`; aquí ya la hace F-010 en el pull. Duplicarla es E-014 |
| Rechazar o esconder un pedido con importes inconsistentes | Un pedido real, con dinero dentro, dejaría de poder atenderse por una discrepancia aritmética. ADR 0053 ya decidió lo contrario en el pull, y la bandeja no es el sitio para revocarlo |

## Consecuencias

**A favor:**

- El importe que ve el encargado es, byte a byte, el que la tienda online le mandó y el que el
  comprador vio. Cuando llame por teléfono, los dos están mirando el mismo número.
- Una regla, no dos: en esta pantalla **ningún** importe se recalcula. Se puede comprobar con un
  `grep` de operadores aritméticos sobre `tiendaOnlineOrderMapping.ts`, y es más fácil de auditar
  que cualquier explicación.
- El mapper se mantiene trivial y total: no puede fallar por aritmética porque no hace aritmética.

**En contra / coste asumido:**

- **Un pedido con importes inconsistentes muestra un total que no cuadra con sus componentes**, y la
  pantalla no lo señala. Es un caso raro —F-010 lo cuenta y hasta hoy no se ha visto— y es la verdad
  de la fila: preferimos enseñar el dato de la tienda online con su inconsistencia a enseñar un
  número nuestro que la tape. Quien quiera detectarlo tiene el `inconsistent=N` de la línea de log
  del cron.
- La rama `PENDING_QUOTE` llama `partialTotal` a un número que, si el pedido es inconsistente,
  podría no ser `subtotal - discountTotal`. El nombre describe **qué le falta** —un envío que nadie
  ha cotizado— no una fórmula, y así está escrito en el § 4.1 del contrato.

**Impacto en seguridad y escalabilidad:**

- Ninguno de aislamiento: la fila ya viene filtrada por `negocioId` y por el alcance de tiendas.
- Reenviar en vez de calcular quita una clase entera de fallo del camino que produce el cuerpo de la
  respuesta, que es un camino donde una excepción degrada a un `500` cuyo log no puede citar lo que
  la causó (ADR 0061).
