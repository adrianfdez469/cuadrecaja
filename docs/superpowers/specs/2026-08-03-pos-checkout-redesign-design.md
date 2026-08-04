# Rediseño de la ventana de cobro del POS

**Fecha:** 2026-08-03
**Branch:** `337-mejorar-el-pos-de-venta`
**Wireframes:** https://claude.ai/code/artifact/334880bf-c6b8-42cb-a519-278987a29d59

---

## 1. Problema

Hoy el cobro vive comprimido dentro del `CartDrawer`, repartido en dos caminos con dos modelos de datos distintos:

- **Camino rápido** — la franja inferior de `cartContent.tsx`: total, descuento, `QuickPayFields` (efectivo, desglose de billetes, switch de transferencia), Falta/Cambio y `VENDER`.
- **Panel multimoneda** — `MultiCurrencyPaymentPanel.tsx`, al que se llega por un enlace de texto: secciones por moneda, desglose por moneda, agregar moneda, reparto del cambio y `Confirmar Pago`.

Los cuatro problemas confirmados con el usuario:

1. **Scroll dentro de scroll.** La franja de pago tiene `maxHeight: 60%` con `overflowY: auto` sobre una lista de productos que ya scrollea. Abrir «Desglosar billetes» o el destino de transferencia empuja el contenido y esconde el botón de vender.
2. **Sin jerarquía.** Total, descuento, efectivo, desglose, transferencia, destino y falta/cambio se apilan con pesos visuales parecidos.
3. **Multimoneda denso.** Secciones por moneda con divisores, botones de texto y campos, difícil de escanear y de operar con el pulgar.
4. **Demasiados toques.** El caso mayoritario —efectivo con un billete redondo— exige escribir el monto a mano con el teclado del sistema, que además tapa el botón de vender.

De fondo: **el cobro no tiene su propio espacio**, y la dualidad rápido/multimoneda duplica aritmética y estado.

## 2. Decisiones tomadas

| Decisión | Elegido |
|---|---|
| Alcance | Todo el cobro: camino rápido y multimoneda, como un solo flujo |
| Estructura | El cobro es un **paso 2 a pantalla completa**, no una franja |
| Entrada de efectivo | **Chips sugeridos + teclado propio** en un sheet |
| Multimoneda | **Un solo flujo progresivo**; se elimina el modo aparte |
| Vuelto | **Línea resumen en el pie + reparto bajo demanda** |
| Desglose de billetes | **Integrado como pestaña del teclado**, deja de ser una sección |
| Código de descuento | **Se muda al carrito** (paso 1) |
| Desktop / anclado | **El mismo paso 2** dentro del panel; sin layout alternativo |

## 3. Arquitectura

```
CartDrawer
└─ CartContent                      dueño de: carrito + descuento + step
   ├─ step "cart"
   │  ├─ CartItemCard[]
   │  └─ CartSummaryFooter          subtotal · descuento · total · [COBRAR]
   │     └─ DiscountField
   └─ step "checkout"
      └─ CheckoutView               dueño de: líneas de pago + vuelto
         ├─ PaymentLineCard[]
         │  ├─ AmountChips
         │  └─ AmountKeypad         sheet: teclado | billetes (BillPad)
         ├─ AddPaymentSheet
         └─ ChangeSummary           pie: estado + [VENDER]
            └─ ChangeSheet          reparto del vuelto por moneda
```

`CartContent` alterna `step` con la misma transición `Fade` que ya usa hoy para alternar entre modos. En mobile el `Drawer` ya ocupa `100vw` / `100dvh`, así que el paso 2 es full-screen sin tocar `CartDrawer.tsx`. En anclado ocupa el panel.

### Archivos nuevos — `src/app/pos/components/checkout/`

| Archivo | Responsabilidad |
|---|---|
| `CheckoutView.tsx` | Paso 2 completo: header, total, líneas, pie. Único dueño del estado de pago. |
| `usePaymentLines.ts` | Estado `PaymentLine[]` y toda la aritmética derivada. |
| `useChangeDistribution.ts` | Estado del vuelto, autocálculo, bloqueo manual y validación contra el saldo de caja. |
| `PaymentLineCard.tsx` | Una línea: tipo, moneda, monto, equivalente en base, destino, quitar. |
| `AmountChips.tsx` | Chips sugeridos + «Otro monto…». |
| `suggestedAmounts.ts` | Algoritmo puro de sugerencias. |
| `AmountKeypad.tsx` | Sheet (mobile) / `Dialog` (desktop) con teclado numérico y pestaña de billetes. |
| `BillPad.tsx` | Pestaña de billetes: tocar denominación para sumar, con tally y deshacer. |
| `AddPaymentSheet.tsx` | Opciones de forma de pago con monto ya sugerido por moneda. |
| `ChangeSummary.tsx` | Línea de estado del pie (Falta / Pago exacto / Cambio) y botón `VENDER`. |
| `ChangeSheet.tsx` | Reparto del vuelto por moneda. |

### Archivos nuevos — `src/components/cartDrawer/components/`

| Archivo | Responsabilidad |
|---|---|
| `CartItemCard.tsx` | Extraído de `cartContent.tsx`, donde hoy vive inline. |
| `CartSummaryFooter.tsx` | Subtotal, línea de descuento, total y `COBRAR`. |
| `DiscountField.tsx` | Campo de código colapsable y llamada a `/api/discounts/preview`. |

### Archivos eliminados

- `src/app/pos/components/QuickPayFields.tsx`
- `src/app/pos/components/MultiCurrencyPaymentPanel.tsx`

`cartContent.tsx` pasa de ~870 líneas a un orquestador de ~150.

### Se reutiliza sin cambios

`MultiCurrencyAmount`, `MoneyField`, `SelectableTextField`, `convertToBase` / `convertFromBase` de `@/lib/currency`, `ceilCash` y `reduceCashForTransfer` de `@/app/pos/utils/cashPayment`, y `DENOMINACIONES` como fallback de CUP.

`BillBreakdownInput` y `BillBreakdownDynamic` **no** se usan en el nuevo cobro: su interacción es `+/−` por fila, y el diseño elegido es tocar-para-sumar. Siguen en uso en otras pantallas y no se tocan.

## 4. Modelo de estado

```ts
type PaymentLine = {
  id: string;
  kind: "cash" | "transfer";
  currency: string;
  amount: number;
  transferDestinationId?: string;
};
```

Reemplaza el `Record<moneda, { cash, transfer, transferDestId }>` de `MultiCurrencyPaymentPanel` y el `QuickPayValues` de `QuickPayFields`. Consecuencia deseada: **dos transferencias a destinos distintos pasan a ser posibles**, algo que el `Record` por moneda impedía.

Estado inicial de `CheckoutView`:

```ts
[{ id, kind: "cash", currency: monedaBase, amount: suggestedAmounts(finalTotal, denoms).exact }]
```

Derivados en `usePaymentLines`:

```
paidBase   = Σ convertToBase(amount, currency, tasasVigentes, monedaBase)
missing    = round(paidBase * 100) < round(finalTotal * 100)
changeBase = max(0, paidBase - finalTotal)
```

`dirty` se marca en cuanto el usuario toca cualquier línea (chip, teclado, agregar o quitar).

**El contrato con el backend no cambia.** Al confirmar, las líneas con `amount > 0` se mapean 1:1 a `IPagoLinea[]` y el reparto a `IVueltoLinea[]`, y se llama a `makePay` con la misma firma de hoy, incluyendo `tasaSnapshot: tasasVigentes` y `discountTotal` cuando corresponde.

## 5. Comportamiento

### 5.1 Chips sugeridos

```ts
suggestedAmounts(pending: number, denominations: number[]): {
  exact: number;
  suggestions: number[];   // hasta 3, ascendente
}
```

**El exacto.** `minDenom = min(denominations)`; `exact = ceilToStep(pending, minDenom)`, donde `ceilToStep(v, s) = ceil(round2(v) / s) * s`. Para CUP (`minDenom = 1`) equivale al `ceilCash` actual: 1.249,50 → 1.250. Sin denominaciones cargadas, `exact = round2(pending)`.

**Las sugerencias** se derivan de la magnitud del monto, no de las denominaciones:

```
mag   = 10 ^ floor(log10(max(exact, minDenom * 10)))
steps = [mag/10, mag/2, mag, mag*2, mag*5].filter(s => s >= minDenom * 5)
cand  = steps.map(s => (floor(exact / s) + 1) * s)   // múltiplo estrictamente mayor
```

Dedupe, orden ascendente, primeros 3.

Si `exact <= 0` —línea ya cubierta por otras, o venta con total 0— no se calcula magnitud y `suggestions` queda vacío: la línea muestra solo «Otro monto…».

| Pendiente | `exact` | Chips |
|---|---|---|
| 1.250 CUP | 1.250 | 1.300 · 1.500 · 2.000 |
| 1.000 CUP | 1.000 | 1.100 · 1.500 · 2.000 |
| 35 CUP | 35 | 40 · 50 |
| 3,57 USD | 4 | 5 · 10 · 20 |

**Por qué la magnitud y no las denominaciones:** CUP tiene billete de 3. Usar las denominaciones como escalón de redondeo produce sugerencias como 1.002. La magnitud da siempre montos que un cliente entrega de verdad. `minDenom` sigue participando en el exacto y como piso de los steps.

**Por qué el piso `minDenom * 10` dentro de la magnitud:** las sugerencias no pueden ser más finas que los billetes que circulan. Sin ese piso, un total de 4 USD (billete mínimo 1) deriva magnitud 1, y el filtro `>= minDenom * 5` descarta todos sus steps salvo uno — quedaría un único chip en vez de 5 · 10 · 20.

**Sobre qué monto se calculan:** sobre el pendiente de **esa línea**, no sobre el total.

```
pending = max(0, finalTotal - Σ otras líneas en base)
```

convertido a la moneda de la línea con `convertFromBase`. Es la lógica que hoy tiene `suggestCash`. Con una sola línea, `pending` es el total.

El chip activo es el que coincide con el monto actual de la línea; si ninguno coincide (monto tecleado), ninguno queda activo.

### 5.2 Teclado y billetes

- El campo de monto es un `<input inputMode="none" readOnly>`: acepta teclado físico en desktop, **no levanta el teclado virtual** en mobile, y al tocarlo abre `AmountKeypad`. Un solo comportamiento en todos los tamaños.
- **Pestaña Teclado:** el valor entra preseleccionado — el primer dígito lo reemplaza, no concatena. `⌫` borra dígito a dígito. La tecla de separador decimal se ofrece solo cuando `minDenom < 1`; con la denominación mínima en 1 (CUP hoy) los decimales no son alcanzables en efectivo y la tecla se omite.
- **Pestaña Billetes:** tocar una denominación suma su valor y agrega una ficha a la tally; deshacer quita la última.
- **Al cambiar de pestaña** se intenta representar el monto actual con el *greedy* de denominaciones (1.550 → `1×1000 1×500 1×50`) y esa es la tally inicial. Si el monto no es representable exacto, la tally arranca vacía y el monto en 0.
- La pestaña Billetes no aparece si la moneda no tiene denominaciones activas.
- En `≥ md` el mismo componente se monta en un `Dialog` centrado en vez de un sheet inferior.

### 5.3 Agregar formas de pago

`AddPaymentSheet` lista las combinaciones disponibles de moneda × tipo, excluyendo las ya presentes cuando el tipo es efectivo:

- Efectivo en una moneda con `admiteEfectivo`
- Transferencia en una moneda con `admiteTransferencia`

Cada opción muestra el **monto que falta** ya convertido a esa moneda (`suggestedAmounts(pending, …).exact`) y lo precarga al agregarse, de modo que agregar una forma de pago sea un solo toque.

La moneda base siempre admite efectivo y transferencia, igual que hoy.

### 5.4 Sincronización con el total

Hoy `QuickPayFields` resincroniza el efectivo cada vez que cambia `finalTotal`, pisando lo que el cajero haya escrito.

Nueva regla: mientras `dirty === false`, la línea única en moneda base se resincroniza a `suggestedAmounts(finalTotal, denoms).exact`. Una vez `dirty`, los montos no se tocan aunque el total cambie — el pie pasará a mostrar Falta o Cambio, que es la señal correcta.

### 5.5 Vuelto

Lógica idéntica a la actual, solo cambia dónde se muestra:

- Se calcula solo en la **moneda de efectivo principal** (la de mayor equivalente en base) por la diferencia exacta, sin redondear a denominación.
- Se congela (`locked`) en cuanto el usuario edita el reparto, y se reinicia si vuelve a faltar dinero.
- Validación contra `GET /api/cierre/[tiendaId]/[cierreId]/cash-balance`: disponible por moneda = saldo del período + efectivo recibido en esa moneda en esta venta.
- El error de saldo se muestra **inline en el pie**, junto al botón deshabilitado, y dice qué hacer: «En caja hay 400,00 CUP. Repartí el cambio en otra moneda.» Hoy vive dentro del reparto, que puede estar cerrado.

### 5.6 Estados del pie

Ocupan el mismo lugar con el mismo peso visual; el color acompaña al texto.

| Condición | Pie | `VENDER` |
|---|---|---|
| `missing` | «Falta N» sobre fondo de error | deshabilitado |
| `changeBase === 0` | «Pago exacto», neutro | habilitado |
| `changeBase > 0` | «Cambio N ›», acento | habilitado |
| Error de saldo en caja | «Cambio N ›» en error + mensaje | deshabilitado |

`aria-live="polite"` sobre la línea para que la transición Falta → Cambio se anuncie.

### 5.7 `canSell`

```
cart.length > 0
&& (finalTotal === 0 ? lines.length > 0 : !missing)
&& toda línea kind="transfer" con amount > 0 tiene transferDestinationId
&& sin errores de saldo en el reparto de cambio
```

Las líneas con `amount <= 0` se ignoran al construir `IPagoLinea[]`; no bloquean la venta. Se conserva el caso de venta con total 0.

### 5.8 Reset tras la venta

`CheckoutView` dispara `onSaleComplete` en el momento en que la venta se envía. `CartContent` vuelve a `step: "cart"`, limpia líneas, vuelto, descuento y código, y refresca el saldo de caja.

Se mantiene el disparo **explícito** en el punto de envío —nunca inferido del largo del carrito—, que es el fix del commit `3d64856` y evita el falso positivo al cambiar de cuenta o carrito con el carrito anclado.

### 5.9 Descuento en el carrito

`DiscountField` vive en `CartSummaryFooter`. Colapsado por defecto; con un código aplicado se muestra la línea «Descuento · CÓDIGO −N» y el enlace pasa a «Cambiar código». Se conserva el `preview` sobre `cartSignature` que ya existe: al cambiar el contenido del carrito se revalida el descuento.

`CheckoutView` recibe `finalTotal`, `discountTotal` y `promoCode` ya resueltos y no los modifica.

## 6. Casos borde

| Caso | Comportamiento |
|---|---|
| Moneda sin denominaciones activas | Sin chips ni pestaña Billetes; solo teclado. |
| Moneda con `admiteEfectivo: false` | No aparece como opción de efectivo. |
| Moneda con `admiteTransferencia: false` | No aparece como opción de transferencia. |
| Sin destinos de transferencia configurados | La línea no pide destino y no bloquea la venta. |
| Un solo destino | Se autoselecciona; el selector no se muestra. |
| Varios destinos | Se preselecciona el marcado `default`, o el primero. |
| Total 0 | Se puede vender con una línea en 0. |
| Negocio sin monedas extra | «Agregar forma de pago» ofrece solo Transferencia en moneda base. |
| Carrito vacío | `CartDrawer` ya cierra el drawer; `step` vuelve a `"cart"`. |
| Fallo de `cash-balance` | El saldo queda en `{}`; la validación de vuelto no bloquea (comportamiento actual). |

## 7. Táctil y accesibilidad

- Chips, teclas del keypad, denominaciones y controles de cantidad a **≥ 44 px**.
- El pie respeta `env(safe-area-inset-bottom)`; el header, `env(safe-area-inset-top)` cuando el drawer no está anclado.
- Estado de foco visible en todo lo interactivo.
- Los sheets cierran con `Esc` y con toque en el scrim.
- `aria-live` en la línea de estado del pie.
- Los montos usan `font-variant-numeric: tabular-nums`.

## 8. Convenciones

Según `CLAUDE.md`: identificadores, comentarios y JSDoc en **inglés**; los textos de interfaz en español. `@/` para todos los imports de `src/`. Sin `any`. Sin Prisma fuera de `src/lib/` y las API routes. Los tipos compartidos siguen viniendo de `src/schemas/` (`IPagoLinea`, `IVueltoLinea`, `IMultimonedaExtras`, `ITransferDestination`) — `PaymentLine` es estado local de UI y vive junto a su hook.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Regresión en el cálculo de pagos al unificar dos modelos de datos | `usePaymentLines` y `suggestedAmounts` son unidades aisladas y verificables por separado; el mapeo a `IPagoLinea[]` se revisa contra el actual línea por línea. |
| La heurística de chips da sugerencias raras en alguna moneda | `suggestedAmounts` es una función pura sin React: se puede tabular su salida para todas las monedas configuradas antes de integrarla. |
| `inputMode="none"` con comportamiento distinto entre navegadores | Verificación manual en iOS Safari y Chrome Android; el campo sigue siendo un `input`, así que el peor caso es que aparezca el teclado del sistema encima del sheet. |
| Pérdida de una capacidad del panel multimoneda actual | La tabla de casos borde de §6 enumera cada comportamiento actual que debe sobrevivir. |

## 10. Fuera de alcance

- El backend de ventas, pagos y movimientos de stock.
- El cálculo y la API de descuentos.
- La cuadrícula de productos del POS, la búsqueda y los carritos múltiples.
- `BillBreakdownInput` / `BillBreakdownDynamic` y sus usos fuera del cobro.
- El widget de caja y los drawers de ventas del POS.
