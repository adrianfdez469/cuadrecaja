# ADR 0059: El estado del envío viaja como unión discriminada, y el importe pendiente no lleva `deliveryFee` ni `total`

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

Un pedido sin cotizar y un pedido con el envío regalado traen **el mismo** `deliveryFee: "0.00"`.
La única columna que los distingue es `deliveryFeePending`. El criterio 4 lo dice con todas las
letras: la pantalla nunca deduce el estado del envío del importe.

Y hay una segunda consecuencia, el criterio 5: con `deliveryFeePending: false` se cumple
`total = subtotal - discountTotal + deliveryFee` (completo); con `true` se cumple
`total = subtotal - discountTotal` (**parcial**, todavía sin un envío que nadie cotizó). La pantalla
no puede llamar «importe final» a un total parcial.

**Comprobación previa de E-013 —una columna que nadie escribe no es una señal, es una constante—:**
`deliveryFeePending` **sí se escribe**. Se copia verbatim del cable en
`src/lib/qab/qabOrderPullPlan.ts:297` (`deliveryFeePending: order.deliveryFeePending`), parseada por
`qabDeliveryFeePendingSchema` en `src/schemas/qabOrderPull.ts:120`, y su columna existe desde F-001
con `@default(false)`. La suite de F-010 ya afirma las dos ramas discriminando con el mismo
`deliveryFee: "0.00"` (`src/__tests__/qabOrderPullPlan.test.ts:461`). La señal es real.

Lo que falta decidir es **la forma de la respuesta**. Mandar `deliveryFee`, `deliveryFeePending` y
`total` como tres campos sueltos y confiar en que la pantalla los combine bien deja el atajo a un
`if` de distancia: `deliveryFee === "0.00" ? "gratis" : …` compila, pasa los tipos, acierta hoy y
cobra de menos el primer día que alguien regale un envío.

## Decisión

**Los importes del pedido viajan como una unión discriminada por `kind`, y la rama pendiente no
tiene la clave `deliveryFee` ni la clave `total`.**

```ts
export const tiendaOnlineOrderAmountsSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal(TIENDA_ONLINE_ORDER_AMOUNT_KIND.quoted),
      subtotal: amount,
      discountTotal: amount,
      deliveryFee: amount,
      total: amount,
    })
    .strict(),
  z
    .object({
      kind: z.literal(TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote),
      subtotal: amount,
      discountTotal: amount,
      partialTotal: amount,
    })
    .strict(),
]);
```

`kind` sale de `deliveryFeePending` y de nada más, en **un** sitio:
`toTiendaOnlineOrderAmounts(row)`, la única función que construye este objeto.

Las dos consecuencias que esto tiene, y que son el motivo de elegirlo:

1. **En la rama pendiente no hay ningún importe de envío que malinterpretar.** El `"0.00"` de la
   base no llega a la pantalla, así que no hay nada que comparar con cero.
2. **En la rama pendiente el total no se llama `total`, se llama `partialTotal`.** Una pantalla que
   quiera pintar el importe final tiene que leer `amounts.total`, y esa clave no existe en esa rama:
   lo para `tsc`, no una revisión.

El rótulo de tres valores que la pantalla muestra sale de una función pura, en un `.ts` para que
sea importable desde un test (E-015):

```ts
// src/components/tiendaOnline/orderPresentation.ts
export function presentTiendaOnlineDelivery(
  amounts: ITiendaOnlineOrderAmounts,
): ITiendaOnlineDeliveryPresentation;
```

y devuelve `PENDING_QUOTE` cuando `kind` es `PENDING_QUOTE`; si no, `FREE` cuando `deliveryFee` es
cero y `CHARGED` en cualquier otro caso. El texto en español de cada uno lo fija el contrato de
diseño y vive en `TIENDA_ONLINE_LABELS`; este ADR fija los tres valores, no las palabras.

Nótese el orden: la rama del cero **solo se evalúa dentro de `QUOTED`**. Comparar con cero no está
prohibido, está puesto donde comparar con cero significa lo que parece.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Mandar `deliveryFee`, `deliveryFeePending` y `total` sueltos | Es la forma que hace fácil escribir el atajo. El criterio 4 se cumpliría o no según cómo la pantalla combinara tres campos, y eso solo se puede revisar leyendo código |
| Un solo booleano `deliveryPending` junto a los tres campos | Igual que la anterior, con un nombre mejor. El `"0.00"` sigue llegando a la pantalla y `total` sigue llamándose `total` cuando es parcial |
| Mandar los tres valores del rótulo (`FREE`/`CHARGED`/`PENDING_QUOTE`) ya resueltos por el servidor | Resuelve el criterio 4 pero no el 5: el total seguiría llamándose igual en los dos casos. Y el rótulo es presentación, que es del `ui-designer`; el estado del envío es dato |
| Dejar la distinción en la pantalla, prohibiéndola en prosa | Es lo que el criterio 4 ya prohíbe en prosa, y una prohibición en prosa no se ejecuta. El contrato tiene que hacer el atajo difícil de escribir, no solo ilegal |
| `partialTotal` como `total` con un booleano `isPartial` al lado | Vuelve a poner las dos mitades en manos de quien las lea. El nombre distinto es justamente lo que hace que un uso descuidado no compile |

## Consecuencias

**A favor:**

- El criterio 4 se verifica sembrando las dos filas del criterio 10 y mirando la **respuesta de la
  API**: una trae `kind: "PENDING_QUOTE"` sin `deliveryFee`, la otra `kind: "QUOTED"` con
  `deliveryFee: "0.00"`. No hace falta abrir el navegador para saber si el servidor las distingue.
- El criterio 5 se verifica en el mismo sitio: la rama pendiente no tiene `total`.
- `presentTiendaOnlineDelivery` es pura y vive en un `.ts`, así que sus tres ramas tienen test
  propio en `src/__tests__/` sin depender de renderizar nada.

**En contra / coste asumido:**

- La pantalla tiene que ramificar por `kind` para pintar la fila de envío y la del total. Es
  exactamente la ramificación que el criterio pide que exista; el coste es que no se puede
  escribir una plantilla única para las dos.
- `subtotal` y `discountTotal` se declaran dos veces, una por rama de la unión. Zod no comparte
  campos entre las ramas de un `discriminatedUnion` sin volver a nombrarlas; es duplicación de
  declaración, no de significado.
- Un consumidor futuro que solo quiera «el importe que sea» tiene que decidir cuál de los dos
  quiere. Es deliberado: no querer decidirlo es el bug.

**Impacto en seguridad y escalabilidad:**

- No hay impacto de aislamiento: la unión se construye a partir de una fila ya filtrada por
  `negocioId` y por el alcance de tiendas.
- El coste de facturación equivocada que este ADR evita es el que el spec llama «cobrar de menos en
  silencio»: presentar como gratis un envío que nadie ha cotizado todavía.
