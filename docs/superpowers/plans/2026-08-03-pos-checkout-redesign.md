# Rediseño de la ventana de cobro del POS — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el cobro del POS en un paso propio a pantalla completa con un único flujo progresivo de pago, reemplazando la franja comprimida del carrito y el modo multimoneda separado.

**Architecture:** Toda la aritmética de pago sale a módulos puros bajo `src/app/pos/utils/` (testeables con Vitest), los componentes de UI viven en `src/app/pos/components/checkout/`, y `CartContent` queda como orquestador de dos pasos (`"cart"` / `"checkout"`). El contrato con `makePay` y el backend no cambia: las líneas de pago se mapean 1:1 a `IPagoLinea[]`.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · MUI v6 · Vitest 4 · Zod

**Spec:** `docs/superpowers/specs/2026-08-03-pos-checkout-redesign-design.md`
**Wireframes:** https://claude.ai/code/artifact/334880bf-c6b8-42cb-a519-278987a29d59

## Global Constraints

- **Idioma del código:** identificadores, comentarios y JSDoc en **inglés**. Los textos de interfaz, en español. Nunca introducir identificadores nuevos en español.
- **Imports:** alias `@/` para todo lo que viva bajo `src/`.
- **TypeScript:** prohibido `any` sin un comentario que lo justifique. `strict` está desactivado, no asumir narrowing automático.
- **Tipos compartidos:** vienen de `src/schemas/` (`IPagoLinea`, `IVueltoLinea`, `IMultimonedaExtras`, `ITransferDestination`, `INegocioMoneda`). No duplicar interfaces entre capas.
- **Sin Prisma** fuera de `src/lib/` y las API routes.
- **`"use client"`** solo en archivos que usen hooks de navegador o interactividad. Los módulos puros de `utils/` **no** lo llevan.
- **Sin magic numbers/strings**: constantes a `src/constants/`.
- **Táctil:** todo control interactivo del cobro a **≥ 44 px**.
- **Comandos de verificación:**
  - Tests: `npm test`
  - Typecheck: `npx tsc --noEmit` (debe salir con código 0 y sin output)
  - Lint: `npm run lint`
- **Testing:** el repo tiene Vitest con 104 tests en `src/__tests__/`, pero **no** tiene `@testing-library/react`. Por eso: TDD estricto para lógica pura, y verificación por typecheck + lint + QA manual para componentes. **No instalar dependencias de testing nuevas** — no está en alcance.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). Terminar el mensaje con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Estructura de archivos

### Se crean

| Archivo | Responsabilidad |
|---|---|
| `src/app/pos/utils/suggestedAmounts.ts` | Monto exacto y chips sugeridos. Puro. |
| `src/app/pos/utils/paymentMath.ts` | Tipo `PaymentLine` y aritmética de pago. Puro. |
| `src/app/pos/utils/billMath.ts` | Greedy de billetes y suma de tally. Puro. |
| `src/app/pos/utils/changeMath.ts` | Autodistribución y validación del vuelto. Puro. |
| `src/app/pos/components/checkout/AmountKeypad.tsx` | Sheet/diálogo con teclado numérico y pestaña de billetes. |
| `src/app/pos/components/checkout/BillPad.tsx` | Pestaña de billetes: tocar para sumar, tally, deshacer. |
| `src/app/pos/components/checkout/AmountChips.tsx` | Chips sugeridos + «Otro monto…». |
| `src/app/pos/components/checkout/PaymentLineCard.tsx` | Una línea de pago. |
| `src/app/pos/components/checkout/AddPaymentSheet.tsx` | Opciones de forma de pago con monto sugerido. |
| `src/app/pos/components/checkout/ChangeSheet.tsx` | Reparto del vuelto por moneda. |
| `src/app/pos/components/checkout/ChangeSummary.tsx` | Pie: estado de la operación + `VENDER`. |
| `src/app/pos/components/checkout/usePaymentLines.ts` | Hook de estado de líneas sobre `paymentMath`. |
| `src/app/pos/components/checkout/useChangeDistribution.ts` | Hook de vuelto sobre `changeMath` + fetch del saldo de caja. |
| `src/app/pos/components/checkout/CheckoutView.tsx` | Paso 2 completo. |
| `src/components/cartDrawer/components/CartItemCard.tsx` | Extraído de `cartContent.tsx`. |
| `src/components/cartDrawer/components/DiscountField.tsx` | Código de descuento colapsable. |
| `src/components/cartDrawer/components/CartSummaryFooter.tsx` | Subtotal, descuento, total, `COBRAR`. |
| `src/__tests__/suggestedAmounts.test.ts` | Tests de Task 1. |
| `src/__tests__/paymentMath.test.ts` | Tests de Task 2. |
| `src/__tests__/billMath.test.ts` | Tests de Task 3. |
| `src/__tests__/changeMath.test.ts` | Tests de Task 4. |

### Se modifican

| Archivo | Cambio |
|---|---|
| `src/components/cartDrawer/components/cartContent.tsx` | Reescrito como orquestador de dos pasos (~870 → ~150 líneas). |
| `src/app/pos/page.tsx` | Solo si el wiring de props lo requiere (Task 11). |
| `CLAUDE.md` | Corregir la afirmación «No automated tests exist in this project». |

### Se eliminan

| Archivo | Motivo |
|---|---|
| `src/app/pos/components/QuickPayFields.tsx` | Reemplazado por el flujo progresivo único. |
| `src/app/pos/components/MultiCurrencyPaymentPanel.tsx` | Ídem. |

**Nota de diseño:** el spec ponía la aritmética dentro de `usePaymentLines`. Se extrae a `paymentMath.ts` puro para poder testearla sin `@testing-library/react`; el hook queda como cascarón de estado sobre ese módulo. Mismo comportamiento, mejor frontera.

---

## Task 1: `suggestedAmounts` — monto exacto y chips

**Files:**
- Create: `src/app/pos/utils/suggestedAmounts.ts`
- Test: `src/__tests__/suggestedAmounts.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ceilToStep(value: number, step: number): number`
  - `suggestedAmounts(pending: number, denominations: number[]): { exact: number; suggestions: number[] }`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/suggestedAmounts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ceilToStep, suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";

const CUP = [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1];
const USD = [100, 50, 20, 10, 5, 1];

describe("ceilToStep", () => {
  it("rounds up to the next multiple of the step", () => {
    expect(ceilToStep(1249.5, 1)).toBe(1250);
    expect(ceilToStep(1250, 1)).toBe(1250);
    expect(ceilToStep(3.57, 1)).toBe(4);
  });

  it("does not overshoot whole amounts because of float noise", () => {
    expect(ceilToStep(0.1 + 0.2, 0.01)).toBe(0.3);
    expect(ceilToStep(63.64, 1)).toBe(64);
  });

  it("supports sub-unit steps", () => {
    expect(ceilToStep(1.234, 0.05)).toBe(1.25);
  });
});

describe("suggestedAmounts", () => {
  it("returns the exact amount rounded up to the smallest denomination", () => {
    expect(suggestedAmounts(1249.5, CUP).exact).toBe(1250);
    expect(suggestedAmounts(3.57, USD).exact).toBe(4);
  });

  it("suggests the round amounts above a mid-magnitude total", () => {
    expect(suggestedAmounts(1250, CUP).suggestions).toEqual([1300, 1500, 2000]);
  });

  it("suggests strictly greater amounts when the total is already round", () => {
    expect(suggestedAmounts(1000, CUP).suggestions).toEqual([1100, 1500, 2000]);
  });

  it("never suggests amounts built on the odd 3-unit denomination", () => {
    const { suggestions } = suggestedAmounts(1000, CUP);
    expect(suggestions).not.toContain(1002);
    expect(suggestions.every((s) => s % 50 === 0)).toBe(true);
  });

  it("handles small totals without suggesting near-exact noise", () => {
    expect(suggestedAmounts(35, CUP).suggestions).toEqual([40, 50]);
  });

  it("works for a currency whose smallest denomination is 1 unit", () => {
    expect(suggestedAmounts(3.57, USD).suggestions).toEqual([5, 10, 20]);
  });

  it("returns no suggestions when nothing is pending", () => {
    expect(suggestedAmounts(0, CUP)).toEqual({ exact: 0, suggestions: [] });
    expect(suggestedAmounts(-10, CUP)).toEqual({ exact: 0, suggestions: [] });
  });

  it("falls back to a 2-decimal exact when there are no denominations", () => {
    expect(suggestedAmounts(12.345, [])).toEqual({
      exact: 12.35,
      suggestions: [],
    });
  });

  it("caps the suggestion list at three entries", () => {
    expect(suggestedAmounts(1250, CUP).suggestions.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/__tests__/suggestedAmounts.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/pos/utils/suggestedAmounts"`

- [ ] **Step 3: Escribir la implementación**

Crear `src/app/pos/utils/suggestedAmounts.ts`:

```ts
/**
 * Suggested cash amounts for a payment line.
 *
 * The exact amount is derived from the currency's smallest denomination —
 * a cashier cannot receive less than one bill. The suggestions, however,
 * are derived from the *magnitude* of the amount rather than from the
 * denominations: CUP circulates a 3-unit bill, and rounding up to a
 * multiple of 3 yields absurd suggestions such as 1002. Magnitude steps
 * always produce amounts a customer actually hands over.
 */

const MAX_SUGGESTIONS = 3;

/** Smallest step that is worth suggesting, relative to the smallest bill. */
const STEP_FLOOR_FACTOR = 5;

/**
 * Suggestions can never be finer-grained than the bills in circulation, so
 * below this many minimum bills the scale comes from the denominations
 * rather than from the amount. Without it, a 4 USD total (minimum bill 1)
 * derives a magnitude of 1, whose steps are all filtered out by
 * STEP_FLOOR_FACTOR, leaving a single suggestion instead of 5 · 10 · 20.
 */
const MAGNITUDE_FLOOR_FACTOR = 10;

/** Rounds up to the next multiple of `step`, immune to float noise. */
export function ceilToStep(value: number, step: number): number {
  if (step <= 0) return round2(value);
  const scaled = Number((value / step).toFixed(6));
  return round2(Math.ceil(scaled) * step);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SuggestedAmounts {
  /** Smallest payable amount that covers `pending`. */
  exact: number;
  /** Round amounts strictly above `exact`, ascending, at most three. */
  suggestions: number[];
}

export function suggestedAmounts(
  pending: number,
  denominations: number[],
): SuggestedAmounts {
  if (!(pending > 0)) return { exact: 0, suggestions: [] };

  const positive = denominations.filter((d) => d > 0);
  if (positive.length === 0) {
    return { exact: round2(pending), suggestions: [] };
  }

  const minDenom = Math.min(...positive);
  const exact = ceilToStep(pending, minDenom);

  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(Math.max(exact, minDenom * MAGNITUDE_FLOOR_FACTOR))),
  );
  const steps = [
    magnitude / 10,
    magnitude / 2,
    magnitude,
    magnitude * 2,
    magnitude * 5,
  ].filter((step) => step >= minDenom * STEP_FLOOR_FACTOR);

  const candidates = steps.map(
    (step) => round2((Math.floor(round2(exact) / step) + 1) * step),
  );

  const suggestions = Array.from(new Set(candidates))
    .filter((amount) => amount > exact)
    .sort((a, b) => a - b)
    .slice(0, MAX_SUGGESTIONS);

  return { exact, suggestions };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/__tests__/suggestedAmounts.test.ts`
Expected: PASS — 10 tests.

Si el caso de 35 CUP no devuelve `[40, 50]`, revisar el filtro `STEP_FLOOR_FACTOR`: con `minDenom = 1` el piso es 5, así que `magnitude/10 = 1` queda fuera y no aparece el 36.

- [ ] **Step 5: Correr la suite completa y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 114 tests pasando, typecheck sin output.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/utils/suggestedAmounts.ts src/__tests__/suggestedAmounts.test.ts
git commit -m "feat(pos): add suggested cash amounts for checkout chips

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `paymentMath` — modelo y aritmética de las líneas de pago

**Files:**
- Create: `src/app/pos/utils/paymentMath.ts`
- Test: `src/__tests__/paymentMath.test.ts`

**Interfaces:**
- Consumes: `convertToBase`, `convertFromBase` de `@/lib/currency`; `IPagoLinea` de `@/schemas/pago`; `ITasaSnapshot` de `@/schemas/tasaCambio`.
- Produces:
  - `type PaymentLineKind = "cash" | "transfer"`
  - `interface PaymentLine { id: string; kind: PaymentLineKind; currency: string; amount: number; transferDestinationId?: string }`
  - `paidBase(lines, rates, base): number`
  - `pendingInCurrency(lines, finalTotal, currency, rates, base, excludeId?): number`
  - `isMissing(paid, finalTotal): boolean`
  - `changeBase(paid, finalTotal): number`
  - `hasMissingTransferDestination(lines): boolean`
  - `toPagoLineas(lines, rates, base): IPagoLinea[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/paymentMath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  paidBase,
  pendingInCurrency,
  isMissing,
  changeBase,
  hasMissingTransferDestination,
  toPagoLineas,
  type PaymentLine,
} from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

// 1 USD = 350 CUP; base is CUP.
const RATES: ITasaSnapshot = { USD: 350 };
const BASE = "CUP";

const cash = (currency: string, amount: number, id = currency): PaymentLine => ({
  id,
  kind: "cash",
  currency,
  amount,
});

describe("paidBase", () => {
  it("sums a single base-currency line", () => {
    expect(paidBase([cash("CUP", 1500)], RATES, BASE)).toBe(1500);
  });

  it("converts foreign currency lines to base", () => {
    const lines = [cash("CUP", 500), cash("USD", 2, "usd")];
    expect(paidBase(lines, RATES, BASE)).toBe(1200);
  });

  it("returns zero for an empty list", () => {
    expect(paidBase([], RATES, BASE)).toBe(0);
  });
});

describe("pendingInCurrency", () => {
  it("returns the full total when there are no lines", () => {
    expect(pendingInCurrency([], 1250, "CUP", RATES, BASE)).toBe(1250);
  });

  it("subtracts what other lines already cover", () => {
    const lines = [cash("CUP", 500)];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE)).toBe(750);
  });

  it("expresses the pending amount in the requested currency", () => {
    const lines = [cash("CUP", 550)];
    expect(pendingInCurrency(lines, 1250, "USD", RATES, BASE)).toBe(2);
  });

  it("excludes the line being edited so it does not cancel itself", () => {
    const lines = [cash("CUP", 500, "a"), cash("CUP", 300, "b")];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE, "b")).toBe(750);
  });

  it("never goes negative when the payment overshoots", () => {
    const lines = [cash("CUP", 5000)];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE)).toBe(0);
  });
});

describe("isMissing", () => {
  it("is true when the paid amount falls short", () => {
    expect(isMissing(1000, 1250)).toBe(true);
  });

  it("is false on an exact payment", () => {
    expect(isMissing(1250, 1250)).toBe(false);
  });

  it("ignores sub-cent float noise", () => {
    expect(isMissing(0.1 + 0.2, 0.3)).toBe(false);
  });
});

describe("changeBase", () => {
  it("returns the overshoot", () => {
    expect(changeBase(1500, 1250)).toBe(250);
  });

  it("returns zero when the payment falls short", () => {
    expect(changeBase(1000, 1250)).toBe(0);
  });
});

describe("hasMissingTransferDestination", () => {
  it("flags a transfer line with an amount but no destination", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 100 },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(true);
  });

  it("accepts a transfer line with a destination", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 100,
        transferDestinationId: "dest-1",
      },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(false);
  });

  it("ignores empty transfer lines", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 0 },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(false);
  });

  it("ignores cash lines", () => {
    expect(hasMissingTransferDestination([cash("CUP", 500)])).toBe(false);
  });
});

describe("toPagoLineas", () => {
  it("maps a cash line with its base equivalent", () => {
    expect(toPagoLineas([cash("CUP", 1500)], RATES, BASE)).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 1500, equivalenteBase: 1500 },
    ]);
  });

  it("converts foreign currency amounts to the base equivalent", () => {
    expect(toPagoLineas([cash("USD", 2, "usd")], RATES, BASE)).toEqual([
      { tipo: "cash", moneda: "USD", monto: 2, equivalenteBase: 700 },
    ]);
  });

  it("carries the destination on transfer lines", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 100,
        transferDestinationId: "dest-1",
      },
    ];
    expect(toPagoLineas(lines, RATES, BASE)).toEqual([
      {
        tipo: "transfer",
        moneda: "CUP",
        monto: 100,
        equivalenteBase: 100,
        transferDestinationId: "dest-1",
      },
    ]);
  });

  it("drops lines with no amount, which the schema would reject", () => {
    const lines = [cash("CUP", 1500), cash("USD", 0, "usd")];
    expect(toPagoLineas(lines, RATES, BASE)).toHaveLength(1);
  });

  it("omits transferDestinationId when it is empty rather than sending an empty string", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 100, transferDestinationId: "" },
    ];
    expect(toPagoLineas(lines, RATES, BASE)[0]).not.toHaveProperty(
      "transferDestinationId",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/__tests__/paymentMath.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/pos/utils/paymentMath"`

- [ ] **Step 3: Escribir la implementación**

Crear `src/app/pos/utils/paymentMath.ts`:

```ts
import { convertToBase, convertFromBase } from "@/lib/currency";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export type PaymentLineKind = "cash" | "transfer";

/**
 * A single payment the customer hands over. Replaces the previous
 * per-currency record, which could not represent two transfers going to
 * different destinations in the same currency.
 */
export interface PaymentLine {
  id: string;
  kind: PaymentLineKind;
  currency: string;
  amount: number;
  transferDestinationId?: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Compares money in cents so float noise never decides a sale. */
function cents(value: number): number {
  return Math.round(value * 100);
}

export function paidBase(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): number {
  return round2(
    lines.reduce(
      (sum, line) =>
        sum + convertToBase(line.amount, line.currency, rates, base),
      0,
    ),
  );
}

/**
 * How much is still owed, expressed in `currency`. `excludeId` leaves the
 * line being edited out of the sum so it does not cancel its own suggestion.
 */
export function pendingInCurrency(
  lines: PaymentLine[],
  finalTotal: number,
  currency: string,
  rates: ITasaSnapshot,
  base: string,
  excludeId?: string,
): number {
  const covered = paidBase(
    lines.filter((line) => line.id !== excludeId),
    rates,
    base,
  );
  const remaining = Math.max(0, finalTotal - covered);
  if (remaining === 0) return 0;
  return round2(convertFromBase(remaining, currency, rates, base));
}

export function isMissing(paid: number, finalTotal: number): boolean {
  return cents(paid) < cents(finalTotal);
}

export function changeBase(paid: number, finalTotal: number): number {
  return Math.max(0, round2(paid - finalTotal));
}

export function hasMissingTransferDestination(lines: PaymentLine[]): boolean {
  return lines.some(
    (line) =>
      line.kind === "transfer" &&
      line.amount > 0 &&
      !line.transferDestinationId,
  );
}

/**
 * Maps to the wire format the sales API already expects. Lines with no
 * amount are dropped: `pagoLineaSchema` requires a positive `monto`.
 */
export function toPagoLineas(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): IPagoLinea[] {
  return lines
    .filter((line) => line.amount > 0)
    .map((line) => ({
      tipo: line.kind,
      moneda: line.currency,
      monto: line.amount,
      equivalenteBase: convertToBase(line.amount, line.currency, rates, base),
      ...(line.kind === "transfer" && line.transferDestinationId
        ? { transferDestinationId: line.transferDestinationId }
        : {}),
    }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/__tests__/paymentMath.test.ts`
Expected: PASS — 20 tests.

- [ ] **Step 5: Correr la suite completa y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 134 tests pasando, typecheck sin output.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/utils/paymentMath.ts src/__tests__/paymentMath.test.ts
git commit -m "feat(pos): add payment line model and checkout arithmetic

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `billMath` — greedy de billetes

**Files:**
- Create: `src/app/pos/utils/billMath.ts`
- Test: `src/__tests__/billMath.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `sumBills(bills: number[]): number`
  - `breakdownGreedy(amount: number, denominations: number[]): number[] | null`
  - `tallyBills(bills: number[]): Array<{ denomination: number; count: number }>`

La tally se modela como **lista plana de billetes** en el orden en que se tocaron, para que «deshacer» sea un `pop()`. `tallyBills` la agrupa solo para mostrarla.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/billMath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sumBills, breakdownGreedy, tallyBills } from "@/app/pos/utils/billMath";

const CUP = [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1];

describe("sumBills", () => {
  it("adds the bills up", () => {
    expect(sumBills([1000, 500, 50])).toBe(1550);
  });

  it("is zero for an empty tally", () => {
    expect(sumBills([])).toBe(0);
  });

  it("keeps two-decimal precision", () => {
    expect(sumBills([0.1, 0.2])).toBe(0.3);
  });
});

describe("breakdownGreedy", () => {
  it("represents an amount with the fewest large bills first", () => {
    expect(breakdownGreedy(1550, CUP)).toEqual([1000, 500, 50]);
  });

  it("repeats a denomination when needed", () => {
    expect(breakdownGreedy(2000, CUP)).toEqual([1000, 1000]);
  });

  it("returns an empty tally for zero", () => {
    expect(breakdownGreedy(0, CUP)).toEqual([]);
  });

  it("returns null when the amount is not representable", () => {
    expect(breakdownGreedy(1550.5, CUP)).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(breakdownGreedy(-100, CUP)).toBeNull();
  });

  it("returns null when there are no denominations", () => {
    expect(breakdownGreedy(100, [])).toBeNull();
  });

  it("ignores denominations too small to step by a whole cent", () => {
    // 0.001 is positive but rounds to a zero-cent step; without filtering it
    // out the greedy loop would never terminate.
    expect(breakdownGreedy(100, [0.001])).toBeNull();
    expect(breakdownGreedy(1550, [...CUP, 0.001])).toEqual([1000, 500, 50]);
  });

  it("tolerates unsorted denominations", () => {
    expect(breakdownGreedy(1550, [50, 1000, 500, 1])).toEqual([1000, 500, 50]);
  });
});

describe("tallyBills", () => {
  it("groups bills by denomination, largest first", () => {
    expect(tallyBills([500, 1000, 500])).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 500, count: 2 },
    ]);
  });

  it("is empty for an empty tally", () => {
    expect(tallyBills([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/__tests__/billMath.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/pos/utils/billMath"`

- [ ] **Step 3: Escribir la implementación**

Crear `src/app/pos/utils/billMath.ts`:

```ts
/**
 * Bill tallies are kept as a flat list in the order the cashier tapped
 * them, so undo is a single pop. Grouping happens only for display.
 */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumBills(bills: number[]): number {
  return round2(bills.reduce((sum, bill) => sum + bill, 0));
}

/**
 * Represents `amount` with the largest denominations first. Returns null
 * when the amount cannot be built exactly — the keypad falls back to an
 * empty tally in that case rather than showing a wrong breakdown.
 */
export function breakdownGreedy(
  amount: number,
  denominations: number[],
): number[] | null {
  if (amount < 0) return null;
  if (amount === 0) return [];

  // Filter on the cents step, not on the raw value: a denomination between
  // 0 and half a cent is positive but steps by zero, and the loop below
  // would never terminate.
  const sorted = denominations
    .filter((d) => Math.round(d * 100) > 0)
    .sort((a, b) => b - a);
  if (sorted.length === 0) return null;

  const bills: number[] = [];
  let remaining = Math.round(amount * 100);

  for (const denomination of sorted) {
    const step = Math.round(denomination * 100);
    while (remaining >= step) {
      bills.push(denomination);
      remaining -= step;
    }
  }

  return remaining === 0 ? bills : null;
}

export function tallyBills(
  bills: number[],
): Array<{ denomination: number; count: number }> {
  const counts = new Map<number, number>();
  for (const bill of bills) {
    counts.set(bill, (counts.get(bill) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => b - a)
    .map(([denomination, count]) => ({ denomination, count }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/__tests__/billMath.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Correr la suite completa y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 146 tests pasando, typecheck sin output.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/utils/billMath.ts src/__tests__/billMath.test.ts
git commit -m "feat(pos): add bill breakdown helpers for the checkout keypad

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `changeMath` — autodistribución y validación del vuelto

**Files:**
- Create: `src/app/pos/utils/changeMath.ts`
- Test: `src/__tests__/changeMath.test.ts`

**Interfaces:**
- Consumes: `convertToBase`, `convertFromBase` de `@/lib/currency`; `PaymentLine` de `@/app/pos/utils/paymentMath`.
- Produces:
  - `type ChangeDistribution = Record<string, number>`
  - `autoChangeDistribution(lines, changeAmountBase, rates, base): ChangeDistribution`
  - `changeAvailability(lines, drawerBalance): Record<string, number>`
  - `changeErrors(distribution, lines, drawerBalance): Record<string, string | null>`
  - `hasChangeErrors(errors): boolean`
  - `distributedBase(distribution, rates, base): number`
  - `toVueltoLineas(distribution): IVueltoLinea[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/changeMath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  autoChangeDistribution,
  changeAvailability,
  changeErrors,
  hasChangeErrors,
  distributedBase,
  toVueltoLineas,
} from "@/app/pos/utils/changeMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

const RATES: ITasaSnapshot = { USD: 350 };
const BASE = "CUP";

const cash = (currency: string, amount: number, id = currency): PaymentLine => ({
  id,
  kind: "cash",
  currency,
  amount,
});

describe("autoChangeDistribution", () => {
  it("gives the change in the main cash currency", () => {
    const lines = [cash("CUP", 1500)];
    expect(autoChangeDistribution(lines, 250, RATES, BASE)).toEqual({ CUP: 250 });
  });

  it("picks the cash currency with the largest base equivalent", () => {
    const lines = [cash("CUP", 100), cash("USD", 5, "usd")];
    expect(autoChangeDistribution(lines, 350, RATES, BASE)).toEqual({ USD: 1 });
  });

  it("sums cash lines that share a currency before choosing", () => {
    // CUP totals 200 across two lines, beating the USD line's 175 base
    // equivalent. Comparing individual lines (100, 100, 175) would wrongly
    // pick USD.
    const lines = [
      cash("CUP", 100, "a"),
      cash("CUP", 100, "b"),
      cash("USD", 0.5, "usd"),
    ];
    expect(autoChangeDistribution(lines, 50, RATES, BASE)).toEqual({ CUP: 50 });
  });

  it("ignores transfer lines when choosing the currency", () => {
    const lines: PaymentLine[] = [
      cash("CUP", 100),
      { id: "t", kind: "transfer", currency: "USD", amount: 10 },
    ];
    expect(autoChangeDistribution(lines, 50, RATES, BASE)).toEqual({ CUP: 50 });
  });

  it("is empty when there is no change to give", () => {
    expect(autoChangeDistribution([cash("CUP", 1250)], 0, RATES, BASE)).toEqual({});
  });

  it("is empty when no cash was received", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 1500, transferDestinationId: "d" },
    ];
    expect(autoChangeDistribution(lines, 250, RATES, BASE)).toEqual({});
  });
});

describe("changeAvailability", () => {
  it("adds the cash taken in this sale to the drawer balance", () => {
    const lines = [cash("CUP", 1500)];
    expect(changeAvailability(lines, { CUP: 400 })).toEqual({ CUP: 1900 });
  });

  it("counts only cash, not transfers", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 1000, transferDestinationId: "d" },
    ];
    expect(changeAvailability(lines, { CUP: 400 })).toEqual({ CUP: 400 });
  });

  it("reports currencies present only in the drawer", () => {
    expect(changeAvailability([], { USD: 12 })).toEqual({ USD: 12 });
  });
});

describe("changeErrors", () => {
  it("has no error when the drawer covers the change", () => {
    const lines = [cash("CUP", 1500)];
    expect(changeErrors({ CUP: 250 }, lines, { CUP: 400 })).toEqual({ CUP: null });
  });

  it("reports how much is actually available when it falls short", () => {
    const lines: PaymentLine[] = [];
    expect(changeErrors({ CUP: 750 }, lines, { CUP: 400 })).toEqual({
      CUP: "En caja hay 400.00 CUP",
    });
  });

  it("treats a missing drawer entry as zero", () => {
    expect(changeErrors({ USD: 1 }, [], {})).toEqual({
      USD: "En caja hay 0.00 USD",
    });
  });
});

describe("hasChangeErrors", () => {
  it("is false when every entry is null", () => {
    expect(hasChangeErrors({ CUP: null, USD: null })).toBe(false);
  });

  it("is true when any entry has a message", () => {
    expect(hasChangeErrors({ CUP: null, USD: "En caja hay 0.00 USD" })).toBe(true);
  });
});

describe("distributedBase", () => {
  it("sums the distribution in base currency", () => {
    expect(distributedBase({ CUP: 400, USD: 1 }, RATES, BASE)).toBe(750);
  });

  it("is zero for an empty distribution", () => {
    expect(distributedBase({}, RATES, BASE)).toBe(0);
  });
});

describe("toVueltoLineas", () => {
  it("maps the distribution to the wire format", () => {
    expect(toVueltoLineas({ CUP: 250 })).toEqual([{ moneda: "CUP", monto: 250 }]);
  });

  it("drops zero amounts", () => {
    expect(toVueltoLineas({ CUP: 250, USD: 0 })).toEqual([
      { moneda: "CUP", monto: 250 },
    ]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/__tests__/changeMath.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/pos/utils/changeMath"`

- [ ] **Step 3: Escribir la implementación**

Crear `src/app/pos/utils/changeMath.ts`:

```ts
import { convertToBase, convertFromBase } from "@/lib/currency";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/** Change to give, per currency code. */
export type ChangeDistribution = Record<string, number>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Tolerance for float noise when comparing against the drawer balance. */
const BALANCE_EPSILON = 0.001;

/**
 * Change goes to the cash currency with the largest base equivalent, for
 * the exact difference — cash received is rounded up, so the change is
 * that surplus and the net in the drawer matches the real total.
 */
export function autoChangeDistribution(
  lines: PaymentLine[],
  changeAmountBase: number,
  rates: ITasaSnapshot,
  base: string,
): ChangeDistribution {
  if (changeAmountBase <= 0) return {};

  // Aggregate per currency before comparing: nothing stops two cash lines
  // from sharing a currency, and picking the largest single line would
  // then choose the wrong one.
  const baseByCurrency = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "cash" || line.amount <= 0) continue;
    const lineBase = convertToBase(line.amount, line.currency, rates, base);
    baseByCurrency.set(
      line.currency,
      (baseByCurrency.get(line.currency) ?? 0) + lineBase,
    );
  }

  const mainCurrency = Array.from(baseByCurrency.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (!mainCurrency) return {};

  const amount = round2(
    convertFromBase(changeAmountBase, mainCurrency, rates, base),
  );
  return amount > 0 ? { [mainCurrency]: amount } : {};
}

/**
 * Cash available to give change: what the period accumulated plus the cash
 * taken in this very sale.
 */
export function changeAvailability(
  lines: PaymentLine[],
  drawerBalance: Record<string, number>,
): Record<string, number> {
  const available: Record<string, number> = { ...drawerBalance };
  for (const line of lines) {
    if (line.kind !== "cash") continue;
    available[line.currency] = round2(
      (available[line.currency] ?? 0) + line.amount,
    );
  }
  return available;
}

export function changeErrors(
  distribution: ChangeDistribution,
  lines: PaymentLine[],
  drawerBalance: Record<string, number>,
): Record<string, string | null> {
  const available = changeAvailability(lines, drawerBalance);
  return Object.fromEntries(
    Object.entries(distribution).map(([currency, amount]) => {
      const cap = available[currency] ?? 0;
      return [
        currency,
        amount > cap + BALANCE_EPSILON
          ? `En caja hay ${cap.toFixed(2)} ${currency}`
          : null,
      ];
    }),
  );
}

export function hasChangeErrors(
  errors: Record<string, string | null>,
): boolean {
  return Object.values(errors).some((error) => error !== null);
}

export function distributedBase(
  distribution: ChangeDistribution,
  rates: ITasaSnapshot,
  base: string,
): number {
  return round2(
    Object.entries(distribution).reduce(
      (sum, [currency, amount]) =>
        sum + convertToBase(amount, currency, rates, base),
      0,
    ),
  );
}

export function toVueltoLineas(
  distribution: ChangeDistribution,
): IVueltoLinea[] {
  return Object.entries(distribution)
    .filter(([, amount]) => amount > 0)
    .map(([moneda, monto]) => ({ moneda, monto }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/__tests__/changeMath.test.ts`
Expected: PASS — 18 tests.

- [ ] **Step 5: Correr la suite completa y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 164 tests pasando, typecheck sin output.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/utils/changeMath.ts src/__tests__/changeMath.test.ts
git commit -m "feat(pos): add change distribution and drawer balance validation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `BillPad` y `AmountKeypad`

**Files:**
- Create: `src/app/pos/components/checkout/BillPad.tsx`
- Create: `src/app/pos/components/checkout/AmountKeypad.tsx`

**Interfaces:**
- Consumes: `sumBills`, `breakdownGreedy`, `tallyBills` de `@/app/pos/utils/billMath`.
- Produces:
  - `<BillPad denominations={number[]} bills={number[]} onChange={(bills: number[]) => void} />`
  - `<AmountKeypad open currency denominations value label pendingLabel onClose onConfirm />` con `onConfirm: (amount: number) => void`

- [ ] **Step 1: Escribir `BillPad`**

Crear `src/app/pos/components/checkout/BillPad.tsx`:

```tsx
"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import { tallyBills } from "@/app/pos/utils/billMath";

interface BillPadProps {
  denominations: number[];
  bills: number[];
  onChange: (bills: number[]) => void;
}

/** Tap a denomination to add it; undo pops the last one tapped. */
export function BillPad({ denominations, bills, onChange }: BillPadProps) {
  const grouped = tallyBills(bills);

  return (
    <Stack gap={1}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0.75,
        }}
      >
        {denominations.map((denomination) => (
          <Button
            key={denomination}
            variant="outlined"
            onClick={() => onChange([...bills, denomination])}
            sx={{ minHeight: 44, fontWeight: 600 }}
          >
            {denomination}
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.5,
          minHeight: 44,
          p: 1,
          borderRadius: 2,
          bgcolor: "action.hover",
        }}
      >
        {grouped.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Tocá los billetes que recibís
          </Typography>
        ) : (
          grouped.map(({ denomination, count }) => (
            <Chip
              key={denomination}
              size="small"
              label={`${count}×${denomination}`}
              variant="outlined"
            />
          ))
        )}
        <Box flex={1} />
        <Button
          size="small"
          startIcon={<UndoIcon />}
          disabled={bills.length === 0}
          onClick={() => onChange(bills.slice(0, -1))}
          sx={{ textTransform: "none", minHeight: 44 }}
        >
          Deshacer
        </Button>
      </Box>
    </Stack>
  );
}
```

- [ ] **Step 2: Escribir `AmountKeypad`**

Crear `src/app/pos/components/checkout/AmountKeypad.tsx`. Es un `Drawer` inferior en mobile y un `Dialog` centrado en `≥ md`; el contenido es el mismo en ambos.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Drawer,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { BillPad } from "@/app/pos/components/checkout/BillPad";
import { breakdownGreedy, sumBills } from "@/app/pos/utils/billMath";

interface AmountKeypadProps {
  open: boolean;
  /** Currency code shown next to the amount. */
  currency: string;
  /** Active denominations for this currency; empty hides the bills tab. */
  denominations: number[];
  /** Amount the field currently holds. */
  value: number;
  /** e.g. "Efectivo CUP" */
  label: string;
  /** e.g. "Total 1.250,00" */
  pendingLabel: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

type KeypadTab = "keys" | "bills";

export function AmountKeypad({
  open,
  currency,
  denominations,
  value,
  label,
  pendingLabel,
  onClose,
  onConfirm,
}: AmountKeypadProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const minDenomination = useMemo(
    () => (denominations.length > 0 ? Math.min(...denominations) : 0.01),
    [denominations],
  );
  const allowsDecimals = minDenomination < 1;
  const hasBillsTab = denominations.length > 0;

  const [tab, setTab] = useState<KeypadTab>("keys");
  const [draft, setDraft] = useState("");
  const [bills, setBills] = useState<number[]>([]);
  // A fresh entry replaces the preloaded value instead of appending to it.
  const [pristine, setPristine] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTab("keys");
    setDraft(value > 0 ? String(value) : "");
    setBills([]);
    setPristine(true);
  }, [open, value]);

  // The typed draft is never destroyed. An empty tally falls back to it, so
  // switching to Billetes with an amount the denominations cannot build
  // leaves the cashier's value intact instead of silently zeroing it.
  const usingBills = tab === "bills" && bills.length > 0;
  const amount = usingBills ? sumBills(bills) : Number(draft || 0);

  const handleTab = (next: KeypadTab) => {
    if (next === tab) return;
    if (next === "bills") {
      // Carry the typed amount over as a tally when it is representable.
      setBills(breakdownGreedy(Number(draft || 0), denominations) ?? []);
    } else if (bills.length > 0) {
      setDraft(String(sumBills(bills)));
      setPristine(true);
    }
    setTab(next);
  };

  const press = (key: string) => {
    setDraft((prev) => {
      const base = pristine ? "" : prev;
      if (key === "," ) {
        return base.includes(".") ? base : `${base || "0"}.`;
      }
      return `${base}${key}`;
    });
    setPristine(false);
  };

  const backspace = () => {
    setDraft((prev) => (pristine ? "" : prev.slice(0, -1)));
    setPristine(false);
  };

  const keys = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    allowsDecimals ? "," : "",
    "0",
    "backspace",
  ];

  const content = (
    <Stack
      gap={1.25}
      sx={{
        p: 2,
        pb: isDesktop ? 2 : "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {pendingLabel}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ borderBottom: "2px solid", borderColor: "primary.main", pb: 0.5 }}
      >
        <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {usingBills ? sumBills(bills) : draft || "0"}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {currency}
        </Typography>
      </Stack>

      {hasBillsTab && (
        <Tabs
          value={tab}
          onChange={(_, next: KeypadTab) => handleTab(next)}
          variant="fullWidth"
        >
          <Tab value="keys" label="Teclado" sx={{ minHeight: 44 }} />
          <Tab value="bills" label="Billetes" sx={{ minHeight: 44 }} />
        </Tabs>
      )}

      {tab === "keys" ? (
        <Box
          sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}
        >
          {keys.map((key, index) =>
            key === "" ? (
              <Box key={`empty-${index}`} />
            ) : (
              <Button
                key={key}
                variant="outlined"
                onClick={() => (key === "backspace" ? backspace() : press(key))}
                sx={{ minHeight: 48, fontSize: "1.1rem", fontWeight: 600 }}
              >
                {key === "backspace" ? <BackspaceOutlinedIcon /> : key}
              </Button>
            ),
          )}
        </Box>
      ) : (
        <BillPad
          denominations={denominations}
          bills={bills}
          onChange={setBills}
        />
      )}

      <Button
        variant="contained"
        color="success"
        onClick={() => onConfirm(amount)}
        sx={{ minHeight: 48, fontWeight: 700 }}
      >
        Listo
      </Button>
    </Stack>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        {content}
      </Dialog>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      {content}
    </Drawer>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Los componentes aún no se usan en ningún lado; eso es esperado.

- [ ] **Step 4: Correr la suite de tests**

Run: `npm test`
Expected: 164 tests pasando (los componentes no agregan tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/pos/components/checkout/BillPad.tsx src/app/pos/components/checkout/AmountKeypad.tsx
git commit -m "feat(pos): add checkout amount keypad with bill tally tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: `AmountChips` y `PaymentLineCard`

**Files:**
- Create: `src/app/pos/components/checkout/AmountChips.tsx`
- Create: `src/app/pos/components/checkout/PaymentLineCard.tsx`

**Interfaces:**
- Consumes: `suggestedAmounts` (Task 1); `PaymentLine` (Task 2); `AmountKeypad` (Task 5); `convertToBase` de `@/lib/currency`; `ITransferDestination` de `@/schemas/transferDestination`.
- Produces:
  - `<AmountChips exact suggestions value onSelect onOther />`
  - `<PaymentLineCard line pending denominations isBase transferDestinations rates base onChange onRemove />` con `onChange: (patch: Partial<PaymentLine>) => void` y `onRemove?: () => void`

- [ ] **Step 1: Escribir `AmountChips`**

Crear `src/app/pos/components/checkout/AmountChips.tsx`:

```tsx
"use client";

import { Box, Button } from "@mui/material";

interface AmountChipsProps {
  /** Smallest payable amount covering the pending total. */
  exact: number;
  suggestions: number[];
  /** Amount the line currently holds, used to highlight the active chip. */
  value: number;
  onSelect: (amount: number) => void;
  onOther: () => void;
}

export function AmountChips({
  exact,
  suggestions,
  value,
  onSelect,
  onOther,
}: AmountChipsProps) {
  const chips: Array<{ label: string; amount: number }> = [
    ...(exact > 0 ? [{ label: "Exacto", amount: exact }] : []),
    ...suggestions.map((amount) => ({ label: String(amount), amount })),
  ];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {chips.map(({ label, amount }) => {
        const active = Math.round(amount * 100) === Math.round(value * 100);
        return (
          <Button
            key={label}
            variant={active ? "contained" : "outlined"}
            color={active ? "success" : "inherit"}
            onClick={() => onSelect(amount)}
            sx={{
              minHeight: 44,
              flex: "1 1 auto",
              textTransform: "none",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {label}
          </Button>
        );
      })}
      <Button
        variant="outlined"
        onClick={onOther}
        sx={{
          minHeight: 44,
          flex: "1 1 100%",
          textTransform: "none",
          borderStyle: "dashed",
          color: "text.secondary",
        }}
      >
        Otro monto…
      </Button>
    </Box>
  );
}
```

- [ ] **Step 2: Escribir `PaymentLineCard`**

Crear `src/app/pos/components/checkout/PaymentLineCard.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { AmountChips } from "@/app/pos/components/checkout/AmountChips";
import { AmountKeypad } from "@/app/pos/components/checkout/AmountKeypad";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import { convertToBase } from "@/lib/currency";
import type { ITransferDestination } from "@/schemas/transferDestination";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface PaymentLineCardProps {
  line: PaymentLine;
  /** Amount still owed, expressed in this line's currency. */
  pending: number;
  denominations: number[];
  isBase: boolean;
  transferDestinations: ITransferDestination[];
  rates: ITasaSnapshot;
  base: string;
  onChange: (patch: Partial<PaymentLine>) => void;
  onRemove?: () => void;
}

export function PaymentLineCard({
  line,
  pending,
  denominations,
  isBase,
  transferDestinations,
  rates,
  base,
  onChange,
  onRemove,
}: PaymentLineCardProps) {
  const [keypadOpen, setKeypadOpen] = useState(false);

  const { exact, suggestions } = useMemo(
    () => suggestedAmounts(pending, denominations),
    [pending, denominations],
  );

  const isCash = line.kind === "cash";
  const equivalentBase = useMemo(
    () =>
      isBase || line.amount <= 0
        ? null
        : convertToBase(line.amount, line.currency, rates, base),
    [isBase, line.amount, line.currency, rates, base],
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
        {isCash ? (
          <PaymentsOutlinedIcon fontSize="small" color="action" />
        ) : (
          <CreditCardIcon fontSize="small" color="action" />
        )}
        <Typography variant="body2" fontWeight={700}>
          {isCash ? "Efectivo" : "Transferencia"}
        </Typography>
        <Chip
          label={line.currency}
          size="small"
          color={isBase ? "primary" : "default"}
          variant={isBase ? "filled" : "outlined"}
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
        <Box flex={1} />
        {onRemove && (
          <IconButton
            size="small"
            onClick={onRemove}
            aria-label={`Quitar ${isCash ? "efectivo" : "transferencia"} en ${line.currency}`}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {/*
        inputMode="none" keeps the on-screen keyboard down on mobile while a
        physical keyboard still types into it on desktop; tapping opens
        AmountKeypad. The field must NOT be readOnly — that would block the
        physical keyboard too and leave onChange dead.
      */}
      <Box
        component="input"
        inputMode="none"
        value={line.amount || ""}
        placeholder="0"
        aria-label={`Monto en ${line.currency}`}
        onClick={() => setKeypadOpen(true)}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ amount: Number(event.target.value) || 0 })
        }
        sx={{
          width: "100%",
          border: 0,
          borderBottom: "2px solid",
          borderColor: "divider",
          bgcolor: "transparent",
          color: "text.primary",
          font: "inherit",
          fontSize: "1.4rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          py: 0.5,
          outline: "none",
          "&:focus": { borderColor: "primary.main" },
        }}
      />

      {equivalentBase !== null && (
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          ≈ {equivalentBase.toFixed(2)} {base}
        </Typography>
      )}

      {isCash && (
        <Box mt={1}>
          <AmountChips
            exact={exact}
            suggestions={suggestions}
            value={line.amount}
            onSelect={(amount) => onChange({ amount })}
            onOther={() => setKeypadOpen(true)}
          />
        </Box>
      )}

      {!isCash && line.amount > 0 && transferDestinations.length > 1 && (
        <FormControl
          fullWidth
          size="small"
          sx={{ mt: 1, "& .MuiOutlinedInput-root": { minHeight: 44 } }}
        >
          <InputLabel>Destino</InputLabel>
          <Select
            label="Destino"
            value={line.transferDestinationId ?? ""}
            onChange={(event) =>
              onChange({ transferDestinationId: event.target.value })
            }
          >
            {transferDestinations.map((destination) => (
              <MenuItem key={destination.id} value={destination.id}>
                {destination.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <AmountKeypad
        open={keypadOpen}
        currency={line.currency}
        denominations={denominations}
        value={line.amount}
        label={`${isCash ? "Efectivo" : "Transferencia"} ${line.currency}`}
        pendingLabel={`Falta ${pending.toFixed(2)}`}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(amount) => {
          onChange({ amount });
          setKeypadOpen(false);
        }}
      />
    </Paper>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/pos/components/checkout/AmountChips.tsx src/app/pos/components/checkout/PaymentLineCard.tsx
git commit -m "feat(pos): add payment line card with suggested amount chips

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: `AddPaymentSheet`

**Files:**
- Create: `src/app/pos/components/checkout/AddPaymentSheet.tsx`

**Interfaces:**
- Consumes: `PaymentLineKind` (Task 2); `suggestedAmounts` (Task 1); `INegocioMoneda` de `@/schemas/moneda`.
- Produces:
  - `interface PaymentOption { kind: PaymentLineKind; currency: string; suggested: number; equivalentBase: number | null }`
  - `<AddPaymentSheet open options base onClose onPick />` con `onPick: (option: PaymentOption) => void`

Las opciones se calculan en `CheckoutView` (Task 9), no acá — este componente solo las presenta.

- [ ] **Step 1: Escribir el componente**

Crear `src/app/pos/components/checkout/AddPaymentSheet.tsx`:

```tsx
"use client";

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import type { PaymentLineKind } from "@/app/pos/utils/paymentMath";

export interface PaymentOption {
  kind: PaymentLineKind;
  currency: string;
  /** Pending amount expressed in this option's currency. */
  suggested: number;
  /** Base equivalent of `suggested`, or null when this is the base currency. */
  equivalentBase: number | null;
}

interface AddPaymentSheetProps {
  open: boolean;
  options: PaymentOption[];
  base: string;
  onClose: () => void;
  onPick: (option: PaymentOption) => void;
}

export function AddPaymentSheet({
  open,
  options,
  base,
  onClose,
  onPick,
}: AddPaymentSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      <Stack
        gap={1}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Typography variant="caption" color="text.secondary">
          AGREGAR FORMA DE PAGO
        </Typography>

        {options.length === 0 ? (
          <Typography variant="body2" color="text.secondary" py={2}>
            No hay otras formas de pago configuradas para este negocio.
          </Typography>
        ) : (
          <List disablePadding>
            {options.map((option) => (
              <ListItemButton
                key={`${option.kind}-${option.currency}`}
                onClick={() => onPick(option)}
                sx={{
                  minHeight: 44,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {option.kind === "cash" ? (
                    <PaymentsOutlinedIcon fontSize="small" />
                  ) : (
                    <CreditCardIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${option.kind === "cash" ? "Efectivo" : "Transferencia"} ${option.currency}`}
                  secondary={
                    option.suggested > 0
                      ? option.equivalentBase !== null
                        ? `Sugerido: ${option.suggested.toFixed(2)} · ≈ ${option.equivalentBase.toFixed(2)} ${base}`
                        : `Sugerido: ${option.suggested.toFixed(2)}`
                      : "Ya está cubierto el total"
                  }
                  primaryTypographyProps={{ fontWeight: 600, variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/pos/components/checkout/AddPaymentSheet.tsx
git commit -m "feat(pos): add payment method picker sheet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: `ChangeSheet` y `ChangeSummary`

**Files:**
- Create: `src/app/pos/components/checkout/ChangeSheet.tsx`
- Create: `src/app/pos/components/checkout/ChangeSummary.tsx`

**Interfaces:**
- Consumes: `ChangeDistribution` (Task 4); `SelectableTextField` de `@/components/SelectableTextField`.
- Produces:
  - `<ChangeSheet open distribution errors eligibleCurrencies changeTotalBase distributedBaseAmount base onClose onChange onAdd onRemove />`
  - `<ChangeSummary missing missingAmount changeAmount base error canSell onOpenDetail onSell />`

- [ ] **Step 1: Escribir `ChangeSheet`**

Crear `src/app/pos/components/checkout/ChangeSheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SelectableTextField from "@/components/SelectableTextField";
import type { ChangeDistribution } from "@/app/pos/utils/changeMath";

interface ChangeSheetProps {
  open: boolean;
  distribution: ChangeDistribution;
  errors: Record<string, string | null>;
  /** Currencies with denominations that are not in the distribution yet. */
  eligibleCurrencies: string[];
  changeTotalBase: number;
  distributedBaseAmount: number;
  base: string;
  onClose: () => void;
  onChange: (currency: string, amount: number) => void;
  onAdd: (currency: string) => void;
  onRemove: (currency: string) => void;
}

export function ChangeSheet({
  open,
  distribution,
  errors,
  eligibleCurrencies,
  changeTotalBase,
  distributedBaseAmount,
  base,
  onClose,
  onChange,
  onAdd,
  onRemove,
}: ChangeSheetProps) {
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);
  const entries = Object.entries(distribution);
  // The totals box must not read as "done" while a per-currency split is
  // invalid — the footer would be saying the opposite at the same time.
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      <Stack
        gap={1.25}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="caption" color="text.secondary">
            REPARTIR CAMBIO
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {changeTotalBase.toFixed(2)} {base} a dar
          </Typography>
        </Stack>

        {entries.map(([currency, amount]) => (
          <Stack key={currency} gap={0.25}>
            <Stack direction="row" gap={1} alignItems="center">
              <Chip label={currency} size="small" variant="outlined" />
              <SelectableTextField
                size="small"
                value={amount || ""}
                onChange={(event) =>
                  onChange(currency, parseFloat(event.target.value) || 0)
                }
                inputProps={{ inputMode: "decimal" }}
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": { minHeight: 44 },
                }}
                error={Boolean(errors[currency])}
              />
              <IconButton
                size="small"
                onClick={() => onRemove(currency)}
                aria-label={`Quitar cambio en ${currency}`}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            {errors[currency] && (
              <Typography variant="caption" color="error" ml={1}>
                {errors[currency]}
              </Typography>
            )}
          </Stack>
        ))}

        {eligibleCurrencies.length > 0 && (
          <>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={(event) =>
                eligibleCurrencies.length === 1
                  ? onAdd(eligibleCurrencies[0])
                  : setAddAnchor(event.currentTarget)
              }
              sx={{ textTransform: "none", alignSelf: "flex-start", minHeight: 44 }}
            >
              Dar cambio en otra moneda
            </Button>
            <Menu
              anchorEl={addAnchor}
              open={Boolean(addAnchor)}
              onClose={() => setAddAnchor(null)}
            >
              {eligibleCurrencies.map((currency) => (
                <MenuItem
                  key={currency}
                  onClick={() => {
                    onAdd(currency);
                    setAddAnchor(null);
                  }}
                >
                  {currency}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ p: 1.25, borderRadius: 2, bgcolor: "action.hover" }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            color={hasErrors ? "error.main" : "text.primary"}
          >
            Repartido
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            color={hasErrors ? "error.main" : "text.primary"}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {distributedBaseAmount.toFixed(2)} / {changeTotalBase.toFixed(2)}
          </Typography>
        </Stack>

        <Button variant="contained" onClick={onClose} sx={{ minHeight: 48 }}>
          Listo
        </Button>
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Escribir `ChangeSummary`**

Crear `src/app/pos/components/checkout/ChangeSummary.tsx`:

```tsx
"use client";

import type { KeyboardEvent } from "react";
import { alpha, Box, Button, Stack, Typography, useTheme } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface ChangeSummaryProps {
  missing: boolean;
  /** How much is still owed, in base currency. */
  missingAmount: number;
  /** How much change to give, in base currency. */
  changeAmount: number;
  base: string;
  /** Drawer balance error, shown inline next to the disabled button. */
  error: string | null;
  canSell: boolean;
  onOpenDetail: () => void;
  onSell: () => void;
}

export function ChangeSummary({
  missing,
  missingAmount,
  changeAmount,
  base,
  error,
  canSell,
  onOpenDetail,
  onSell,
}: ChangeSummaryProps) {
  const theme = useTheme();
  const hasChange = !missing && changeAmount > 0;
  const tone = missing || error ? "error" : hasChange ? "success" : "neutral";

  const label = missing
    ? "Falta"
    : hasChange
      ? "Cambio"
      : "Pago exacto";

  const value = missing
    ? `${missingAmount.toFixed(2)} ${base}`
    : hasChange
      ? `${changeAmount.toFixed(2)} ${base}`
      : `0.00 ${base}`;

  return (
    <Stack gap={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        aria-live="polite"
        // Only interactive when there is a split to open. Without the role,
        // tabIndex and key handler this row is mouse-only, and "focus visible
        // on everything interactive" could never be satisfied — there would be
        // nothing to focus.
        {...(hasChange
          ? {
              role: "button",
              tabIndex: 0,
              onClick: onOpenDetail,
              onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenDetail();
                }
              },
            }
          : {})}
        sx={{
          p: 1.25,
          borderRadius: 2,
          cursor: hasChange ? "pointer" : "default",
          minHeight: 44,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
          bgcolor:
            tone === "error"
              ? alpha(theme.palette.error.main, 0.12)
              : "action.hover",
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          color={tone === "error" ? "error.main" : "text.secondary"}
        >
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Typography
            variant="h6"
            fontWeight={700}
            color={
              tone === "error"
                ? "error.main"
                : tone === "success"
                  ? "success.main"
                  : "text.secondary"
            }
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </Typography>
          {hasChange && <ChevronRightIcon fontSize="small" />}
        </Stack>
      </Stack>

      {error && (
        <Typography variant="caption" color="error" fontWeight={600}>
          {error} Repartí el cambio en otra moneda.
        </Typography>
      )}

      <Box>
        <Button
          variant="contained"
          color="success"
          fullWidth
          size="large"
          disabled={!canSell}
          onClick={onSell}
          sx={{ fontWeight: "bold", py: 1.25, minHeight: 48 }}
        >
          VENDER
        </Button>
      </Box>
    </Stack>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/pos/components/checkout/ChangeSheet.tsx src/app/pos/components/checkout/ChangeSummary.tsx
git commit -m "feat(pos): add checkout change summary and distribution sheet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Hooks y `CheckoutView`

**Files:**
- Create: `src/app/pos/components/checkout/usePaymentLines.ts`
- Create: `src/app/pos/components/checkout/useChangeDistribution.ts`
- Create: `src/app/pos/components/checkout/CheckoutView.tsx`

**Interfaces:**
- Consumes: todo lo anterior; `useAppContext` de `@/context/AppContext` (`monedasNegocio`, `tasasVigentes`, `monedaBase`); `DENOMINACIONES` de `@/constants/billDenominations`.
- Produces:
  - `usePaymentLines({ finalTotal, monedaBase, denominationsFor, defaultTransferDestId })` → `{ lines, dirty, addLine, updateLine, removeLine, reset }`
  - `useChangeDistribution({ lines, changeAmountBase, missing, rates, base, tiendaId, cierreId })` → `{ distribution, errors, hasErrors, distributedBaseAmount, setAmount, addCurrency, removeCurrency, refreshBalance, reset }`
  - `<CheckoutView finalTotal discountTotal promoCode transferDestinations tiendaId cierreId itemCount onBack makePay onSaleComplete />`

- [ ] **Step 1: Escribir `usePaymentLines`**

Crear `src/app/pos/components/checkout/usePaymentLines.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine, PaymentLineKind } from "@/app/pos/utils/paymentMath";

interface UsePaymentLinesArgs {
  finalTotal: number;
  monedaBase: string;
  denominationsFor: (currency: string) => number[];
  defaultTransferDestId: string;
}

let lineCounter = 0;
const nextLineId = () => `line-${++lineCounter}`;

export function usePaymentLines({
  finalTotal,
  monedaBase,
  denominationsFor,
  defaultTransferDestId,
}: UsePaymentLinesArgs) {
  const buildInitialLine = useCallback(
    (): PaymentLine => ({
      id: nextLineId(),
      kind: "cash",
      currency: monedaBase,
      amount: suggestedAmounts(finalTotal, denominationsFor(monedaBase)).exact,
    }),
    [finalTotal, monedaBase, denominationsFor],
  );

  const [lines, setLines] = useState<PaymentLine[]>(() => [buildInitialLine()]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // While untouched, the single base line tracks the total (e.g. a discount
  // lands). Once the cashier has touched anything, amounts are theirs.
  useEffect(() => {
    if (dirtyRef.current) return;
    if (finalTotal <= 0) return;
    const exact = suggestedAmounts(finalTotal, denominationsFor(monedaBase)).exact;
    setLines((prev) =>
      prev.length === 1 && prev[0].kind === "cash" && prev[0].currency === monedaBase
        ? [{ ...prev[0], amount: exact }]
        : prev,
    );
  }, [finalTotal, monedaBase, denominationsFor]);

  const addLine = useCallback(
    (kind: PaymentLineKind, currency: string, amount: number) => {
      setDirty(true);
      setLines((prev) => [
        ...prev,
        {
          id: nextLineId(),
          kind,
          currency,
          amount,
          ...(kind === "transfer"
            ? { transferDestinationId: defaultTransferDestId }
            : {}),
        },
      ]);
    },
    [defaultTransferDestId],
  );

  const updateLine = useCallback((id: string, patch: Partial<PaymentLine>) => {
    setDirty(true);
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setDirty(true);
    setLines((prev) => prev.filter((line) => line.id !== id));
  }, []);

  const reset = useCallback(() => {
    setDirty(false);
    setLines([buildInitialLine()]);
  }, [buildInitialLine]);

  return { lines, dirty, addLine, updateLine, removeLine, reset };
}
```

- [ ] **Step 2: Escribir `useChangeDistribution`**

Crear `src/app/pos/components/checkout/useChangeDistribution.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  autoChangeDistribution,
  changeErrors,
  distributedBase,
  hasChangeErrors,
  type ChangeDistribution,
} from "@/app/pos/utils/changeMath";
import { convertFromBase } from "@/lib/currency";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface UseChangeDistributionArgs {
  lines: PaymentLine[];
  changeAmountBase: number;
  missing: boolean;
  rates: ITasaSnapshot;
  base: string;
  tiendaId: string;
  cierreId: string;
}

export function useChangeDistribution({
  lines,
  changeAmountBase,
  missing,
  rates,
  base,
  tiendaId,
  cierreId,
}: UseChangeDistributionArgs) {
  const [distribution, setDistribution] = useState<ChangeDistribution>({});
  const [locked, setLocked] = useState(false);
  const [drawerBalance, setDrawerBalance] = useState<Record<string, number>>({});

  const refreshBalance = useCallback(() => {
    if (!tiendaId || !cierreId) return;
    fetch(`/api/cierre/${tiendaId}/${cierreId}/cash-balance`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((balance: Record<string, number>) => setDrawerBalance(balance))
      .catch(() => setDrawerBalance({}));
  }, [tiendaId, cierreId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Auto-distribute until the cashier edits the split by hand.
  useEffect(() => {
    if (missing) {
      setDistribution({});
      setLocked(false);
      return;
    }
    if (locked) return;
    setDistribution(
      autoChangeDistribution(lines, changeAmountBase, rates, base),
    );
  }, [missing, locked, lines, changeAmountBase, rates, base]);

  const errors = useMemo(
    () => changeErrors(distribution, lines, drawerBalance),
    [distribution, lines, drawerBalance],
  );

  const distributedBaseAmount = useMemo(
    () => distributedBase(distribution, rates, base),
    [distribution, rates, base],
  );

  const setAmount = useCallback((currency: string, amount: number) => {
    setLocked(true);
    setDistribution((prev) => ({ ...prev, [currency]: amount }));
  }, []);

  const addCurrency = useCallback(
    (currency: string) => {
      setLocked(true);
      const remaining = Math.max(0, changeAmountBase - distributedBaseAmount);
      const suggested =
        remaining > 0
          ? Number(convertFromBase(remaining, currency, rates, base).toFixed(2))
          : 0;
      setDistribution((prev) => ({ ...prev, [currency]: suggested }));
    },
    [changeAmountBase, distributedBaseAmount, rates, base],
  );

  const removeCurrency = useCallback((currency: string) => {
    setLocked(true);
    setDistribution((prev) => {
      const next = { ...prev };
      delete next[currency];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDistribution({});
    setLocked(false);
    refreshBalance();
  }, [refreshBalance]);

  return {
    distribution,
    errors,
    hasErrors: hasChangeErrors(errors),
    distributedBaseAmount,
    setAmount,
    addCurrency,
    removeCurrency,
    refreshBalance,
    reset,
  };
}
```

- [ ] **Step 3: Escribir `CheckoutView`**

Crear `src/app/pos/components/checkout/CheckoutView.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { useAppContext } from "@/context/AppContext";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { PaymentLineCard } from "@/app/pos/components/checkout/PaymentLineCard";
import {
  AddPaymentSheet,
  type PaymentOption,
} from "@/app/pos/components/checkout/AddPaymentSheet";
import { ChangeSheet } from "@/app/pos/components/checkout/ChangeSheet";
import { ChangeSummary } from "@/app/pos/components/checkout/ChangeSummary";
import { usePaymentLines } from "@/app/pos/components/checkout/usePaymentLines";
import { useChangeDistribution } from "@/app/pos/components/checkout/useChangeDistribution";
import {
  changeBase,
  hasMissingTransferDestination,
  isMissing,
  paidBase,
  pendingInCurrency,
  toPagoLineas,
} from "@/app/pos/utils/paymentMath";
import { toVueltoLineas } from "@/app/pos/utils/changeMath";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import { convertToBase } from "@/lib/currency";
import { DENOMINACIONES } from "@/constants/billDenominations";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface CheckoutViewProps {
  finalTotal: number;
  discountTotal: number;
  promoCode: string;
  transferDestinations: ITransferDestination[];
  tiendaId: string;
  cierreId: string;
  itemCount: number;
  onBack: () => void;
  makePay: (
    total: number,
    totalcash: number,
    totaltransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => Promise<void>;
  onSaleComplete: () => void;
}

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

export function CheckoutView({
  finalTotal,
  discountTotal,
  promoCode,
  transferDestinations,
  tiendaId,
  cierreId,
  itemCount,
  onBack,
  makePay,
  onSaleComplete,
}: CheckoutViewProps) {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();

  const monedasActivas = useMemo(
    () => monedasNegocio.filter((m) => m.activo),
    [monedasNegocio],
  );

  const denominationsFor = useCallback(
    (currency: string): number[] => {
      const info = monedasActivas.find((m) => m.monedaCode === currency);
      const values = (info?.moneda?.denominaciones ?? [])
        .filter((d) => d.activo)
        .map((d) => d.valor)
        .sort((a, b) => b - a);
      if (values.length > 0) return values;
      // CUP keeps a static fallback so the base currency always has bills.
      return currency === "CUP" ? [...DENOMINACIONES.CUP].sort((a, b) => b - a) : [];
    },
    [monedasActivas],
  );

  const { lines, addLine, updateLine, removeLine } = usePaymentLines({
    finalTotal,
    monedaBase,
    denominationsFor,
    defaultTransferDestId: defaultDestId(transferDestinations),
  });

  const paid = paidBase(lines, tasasVigentes, monedaBase);
  const missing = finalTotal === 0 ? false : isMissing(paid, finalTotal);
  const change = changeBase(paid, finalTotal);

  const {
    distribution,
    errors,
    hasErrors,
    distributedBaseAmount,
    setAmount,
    addCurrency,
    removeCurrency,
  } = useChangeDistribution({
    lines,
    changeAmountBase: change,
    missing,
    rates: tasasVigentes,
    base: monedaBase,
    tiendaId,
    cierreId,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  // The exit transition keeps this view mounted for ~200 ms after a sale is
  // submitted; without this guard a second tap would send a second sale.
  const [submitting, setSubmitting] = useState(false);
  // The ref is the actual guard — state updates are asynchronous, so two taps
  // landing in the same tick would both read `submitting === false` and both
  // submit. Ghost double-fire is a real failure mode on POS touch hardware and
  // the cost is a duplicate sale. The state flag only drives `disabled`.
  const submittingRef = useRef(false);

  const allCurrencies = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];
    for (const currency of allCurrencies) {
      const isBase = currency === monedaBase;
      const info = monedasActivas.find((m) => m.monedaCode === currency);
      const allowsCash = isBase || (info?.admiteEfectivo ?? true);
      const allowsTransfer = isBase || (info?.admiteTransferencia ?? false);
      const pending = pendingInCurrency(
        lines,
        finalTotal,
        currency,
        tasasVigentes,
        monedaBase,
      );
      const suggested = suggestedAmounts(pending, denominationsFor(currency)).exact;
      const equivalentBase =
        isBase || suggested <= 0
          ? null
          : convertToBase(suggested, currency, tasasVigentes, monedaBase);

      const hasCashLine = lines.some(
        (line) => line.kind === "cash" && line.currency === currency,
      );
      if (allowsCash && !hasCashLine) {
        options.push({ kind: "cash", currency, suggested, equivalentBase });
      }
      if (allowsTransfer) {
        options.push({
          kind: "transfer",
          currency,
          suggested: pending,
          equivalentBase,
        });
      }
    }
    return options;
  }, [
    allCurrencies,
    monedaBase,
    monedasActivas,
    lines,
    finalTotal,
    tasasVigentes,
    denominationsFor,
  ]);

  const eligibleChangeCurrencies = useMemo(
    () =>
      allCurrencies.filter(
        (currency) =>
          !(currency in distribution) && denominationsFor(currency).length > 0,
      ),
    [allCurrencies, distribution, denominationsFor],
  );

  const firstError = useMemo(
    () => Object.values(errors).find((error) => error !== null) ?? null,
    [errors],
  );

  // A business with no transfer destinations configured must still be able to
  // sell — the line simply carries none (spec §6). Only demand a destination
  // when there is one to pick.
  const needsTransferDestination =
    transferDestinations.length > 0 && hasMissingTransferDestination(lines);

  const canSell =
    !submitting &&
    (finalTotal === 0 ? lines.length > 0 : !missing) &&
    !needsTransferDestination &&
    !hasErrors;

  const handleSell = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const pagosDetalle = toPagoLineas(lines, tasasVigentes, monedaBase);
    const vueltoDetalle = toVueltoLineas(distribution);

    const totalCashBase = pagosDetalle
      .filter((p) => p.tipo === "cash")
      .reduce((sum, p) => sum + p.equivalenteBase, 0);
    const totalTransferBase = pagosDetalle
      .filter((p) => p.tipo === "transfer")
      .reduce((sum, p) => sum + p.equivalenteBase, 0);
    const firstTransferDestId = pagosDetalle.find(
      (p) => p.tipo === "transfer",
    )?.transferDestinationId;

    const multimoneda: IMultimonedaExtras = {
      monedaCobro: monedaBase,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot: tasasVigentes,
      ...(discountTotal > 0 ? { discountTotal } : {}),
    };

    // The parent switches back to the cart step, which unmounts this view and
    // therefore resets both hooks — no explicit reset needed here.
    onSaleComplete();

    await makePay(
      finalTotal,
      totalCashBase,
      totalTransferBase,
      firstTransferDestId,
      promoCode ? [promoCode] : [],
      multimoneda,
    ).catch((error) => console.error("Error pago:", error));
  };

  return (
    <Box
      sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
        <IconButton
          onClick={onBack}
          aria-label="Volver al carrito"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h6">Cobrar</Typography>
          <Typography variant="caption" color="text.secondary">
            {itemCount} producto{itemCount !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Stack>

      <Box flex={1} minHeight={0} sx={{ overflowY: "auto" }}>
        <Box mb={1.5}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            Total a cobrar
          </Typography>
          <MultiCurrencyAmount
            amount={finalTotal}
            variant="emphasized"
            color="success.main"
          />
        </Box>

        <Stack gap={1}>
          {lines.map((line) => (
            <PaymentLineCard
              key={line.id}
              line={line}
              pending={pendingInCurrency(
                lines,
                finalTotal,
                line.currency,
                tasasVigentes,
                monedaBase,
                line.id,
              )}
              denominations={denominationsFor(line.currency)}
              isBase={line.currency === monedaBase}
              transferDestinations={transferDestinations}
              rates={tasasVigentes}
              base={monedaBase}
              onChange={(patch) => updateLine(line.id, patch)}
              onRemove={lines.length > 1 ? () => removeLine(line.id) : undefined}
            />
          ))}

          {paymentOptions.length > 0 && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              sx={{
                textTransform: "none",
                borderStyle: "dashed",
                minHeight: 44,
              }}
              variant="outlined"
              color="inherit"
            >
              Agregar forma de pago
            </Button>
          )}
        </Stack>
      </Box>

      {/*
        No safe-area padding here on purpose: CartContent already applies
        `env(safe-area-inset-bottom)` to the container this view is absolutely
        positioned inside. Adding it again would double the gap. If CheckoutView
        is ever mounted somewhere else, that container owes it the same padding.
      */}
      <Box
        flex="0 0 auto"
        sx={{
          mt: 1,
          pt: 1.5,
          borderTop: "2px solid",
          borderColor: "divider",
        }}
      >
        <ChangeSummary
          missing={missing}
          missingAmount={Math.max(0, finalTotal - paid)}
          changeAmount={change}
          base={monedaBase}
          error={firstError}
          canSell={canSell}
          onOpenDetail={() => setChangeOpen(true)}
          onSell={handleSell}
        />
      </Box>

      <AddPaymentSheet
        open={addOpen}
        options={paymentOptions}
        base={monedaBase}
        onClose={() => setAddOpen(false)}
        onPick={(option) => {
          addLine(option.kind, option.currency, option.suggested);
          setAddOpen(false);
        }}
      />

      <ChangeSheet
        open={changeOpen}
        distribution={distribution}
        errors={errors}
        eligibleCurrencies={eligibleChangeCurrencies}
        changeTotalBase={change}
        distributedBaseAmount={distributedBaseAmount}
        base={monedaBase}
        onClose={() => setChangeOpen(false)}
        onChange={setAmount}
        onAdd={addCurrency}
        onRemove={removeCurrency}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Correr la suite de tests**

Run: `npm test`
Expected: 164 tests pasando.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/components/checkout/usePaymentLines.ts src/app/pos/components/checkout/useChangeDistribution.ts src/app/pos/components/checkout/CheckoutView.tsx
git commit -m "feat(pos): add checkout view with progressive payment flow

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Componentes del carrito

**Files:**
- Create: `src/components/cartDrawer/components/CartItemCard.tsx`
- Create: `src/components/cartDrawer/components/DiscountField.tsx`
- Create: `src/components/cartDrawer/components/CartSummaryFooter.tsx`

**Interfaces:**
- Consumes: `ICartItem` de `@/store/cartStore`; `MultiCurrencyAmount`; `DiscountApplicationResultItem` de `@/lib/discounts`.
- Produces:
  - `<CartItemCard item onDecrease onIncrease onRemove canUpdateQuantity />`
  - `<DiscountField promoCode applied discountTotal base onCodeChange onApply />`
  - `<CartSummaryFooter total finalTotal discountTotal base applied promoCode canCheckout onCodeChange onApply onCheckout />`

- [ ] **Step 1: Extraer `CartItemCard`**

Es una extracción literal, **sin cambios de comportamiento**. El código fuente está en el repo:

1. Leer `src/components/cartDrawer/components/cartContent.tsx` líneas 44–269. Ese bloque contiene `ExpiryChip`, la interfaz `CartItemCardProps` y el componente `CartItemCard`.
2. Crear `src/components/cartDrawer/components/CartItemCard.tsx` con, en este orden:
   - `"use client";`
   - Los imports que ese bloque necesita: `Delete`, `Remove`, `Add` de `@mui/icons-material`; `Box`, `Typography`, `Chip`, `IconButton`, `Paper`, `Tooltip`, `useTheme`, `alpha` de `@mui/material`; `ICartItem` de `@/store/cartStore`; `MultiCurrencyAmount` de `@/components/MultiCurrencyAmount`.
   - El bloque copiado tal cual.
3. Cambiar `function CartItemCard(` por `export function CartItemCard(`. `ExpiryChip` y `CartItemCardProps` quedan privados del módulo — no exportarlos.
4. **No** borrar todavía el bloque de `cartContent.tsx`; eso pasa en Task 11, cuando el archivo se reescribe entero.

- [ ] **Step 2: Escribir `DiscountField`**

Crear `src/components/cartDrawer/components/DiscountField.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Box, Button, Collapse, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

interface DiscountFieldProps {
  promoCode: string;
  applied: DiscountApplicationResultItem[];
  discountTotal: number;
  base: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
}

export function DiscountField({
  promoCode,
  applied,
  discountTotal,
  base,
  onCodeChange,
  onApply,
}: DiscountFieldProps) {
  const [open, setOpen] = useState(false);
  const hasDiscount = applied.length > 0;

  return (
    <Box>
      {hasDiscount && (
        <Typography variant="body2" fontWeight={600} color="success.main">
          Descuento aplicado: −{discountTotal.toFixed(2)} {base}
        </Typography>
      )}

      <Button
        variant="text"
        size="small"
        onClick={() => setOpen((value) => !value)}
        startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ textTransform: "none", color: "text.secondary", minHeight: 44 }}
      >
        {hasDiscount ? "Cambiar código" : "¿Tenés un código de descuento?"}
      </Button>

      <Collapse in={open}>
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <TextField
            label="Código de descuento"
            value={promoCode}
            onChange={(event) => onCodeChange(event.target.value.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApply();
            }}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={onApply}
            sx={{ minWidth: 90, minHeight: 44 }}
            size="small"
          >
            Aplicar
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
```

- [ ] **Step 3: Escribir `CartSummaryFooter`**

Crear `src/components/cartDrawer/components/CartSummaryFooter.tsx`:

```tsx
"use client";

import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { DiscountField } from "@/components/cartDrawer/components/DiscountField";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

interface CartSummaryFooterProps {
  total: number;
  finalTotal: number;
  discountTotal: number;
  base: string;
  applied: DiscountApplicationResultItem[];
  promoCode: string;
  canCheckout: boolean;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onCheckout: () => void;
}

export function CartSummaryFooter({
  total,
  finalTotal,
  discountTotal,
  base,
  applied,
  promoCode,
  canCheckout,
  onCodeChange,
  onApply,
  onCheckout,
}: CartSummaryFooterProps) {
  return (
    <Box
      flex="0 0 auto"
      sx={{
        mt: 1,
        pt: 1.5,
        px: 0.5,
        borderTop: "2px solid",
        borderColor: "divider",
        boxShadow: "0px -4px 12px rgba(0,0,0,0.08)",
      }}
    >
      {discountTotal > 0 && (
        <Stack direction="row" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" color="text.secondary">
            Subtotal
          </Typography>
          <Typography
            variant="caption"
            sx={{ textDecoration: "line-through", color: "text.disabled" }}
          >
            {total.toFixed(2)} {base}
          </Typography>
        </Stack>
      )}

      <DiscountField
        promoCode={promoCode}
        applied={applied}
        discountTotal={discountTotal}
        base={base}
        onCodeChange={onCodeChange}
        onApply={onApply}
      />

      <Divider sx={{ my: 1 }} />

      <Box mb={1}>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
        >
          Total
        </Typography>
        <MultiCurrencyAmount
          amount={finalTotal}
          variant="emphasized"
          color="success.main"
        />
      </Box>

      <Button
        variant="contained"
        color="success"
        fullWidth
        size="large"
        disabled={!canCheckout}
        onClick={onCheckout}
        sx={{ fontWeight: "bold", py: 1.25, minHeight: 48 }}
      >
        COBRAR
      </Button>
    </Box>
  );
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. `cartContent.tsx` sigue teniendo su copia inline de `CartItemCard`; esa duplicación se resuelve en Task 11.

- [ ] **Step 5: Commit**

```bash
git add src/components/cartDrawer/components/CartItemCard.tsx src/components/cartDrawer/components/DiscountField.tsx src/components/cartDrawer/components/CartSummaryFooter.tsx
git commit -m "refactor(cart): extract item card, discount field and summary footer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Reescribir `CartContent` y eliminar el flujo viejo

**Files:**
- Modify: `src/components/cartDrawer/components/cartContent.tsx` (reescritura completa)
- Delete: `src/app/pos/components/QuickPayFields.tsx`
- Delete: `src/app/pos/components/MultiCurrencyPaymentPanel.tsx`
- Modify: `src/app/pos/page.tsx` (solo si el typecheck lo exige)

**Interfaces:**
- Consumes: `CartItemCard`, `CartSummaryFooter` (Task 10); `CheckoutView` (Task 9).
- Produces: `CartContent` con la **misma firma de props que hoy** — `CartDrawer.tsx` y `page.tsx` no necesitan cambios de contrato.

- [ ] **Step 1: Reescribir `cartContent.tsx`**

Reemplazar el contenido completo por:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Close, Delete } from "@mui/icons-material";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
  Fade,
} from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { ICartItem } from "@/store/cartStore";
import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";
import { CartItemCard } from "@/components/cartDrawer/components/CartItemCard";
import { CartSummaryFooter } from "@/components/cartDrawer/components/CartSummaryFooter";
import { CheckoutView } from "@/app/pos/components/checkout/CheckoutView";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";
import type {
  DiscountApplicationResult,
  DiscountApplicationResultItem,
} from "@/lib/discounts";

interface IProps {
  clear?: () => void;
  cart: ICartItem[];
  updateQuantity?: (id: string, quantity: number) => void;
  onClose: () => void;
  removeItem?: (id: string) => void;
  total: number;
  makePay: (
    total: number,
    totalcash: number,
    totaltransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => Promise<void>;
  transferDestinations: ITransferDestination[];
  cierreId: string;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}

type CartStep = "cart" | "checkout";

export const CartContent = ({
  cart,
  total,
  isCartPinned,
  clear,
  updateQuantity,
  onClose,
  removeItem,
  makePay,
  transferDestinations,
  cierreId,
  setIsCartPinned,
}: IProps) => {
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const { user, monedaBase } = useAppContext();
  const tiendaId = user?.localActual?.id ?? "";

  const [step, setStep] = useState<CartStep>("cart");

  // ─── Discount ─────────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);
  const finalTotal = Math.max(0, total - discountTotal);

  const previewDiscount = async (codes?: string[]): Promise<void> => {
    try {
      const res = await fetch("/api/discounts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiendaId,
          products: cart.map((item) => ({
            productoTiendaId: item.productoTiendaId,
            cantidad: item.quantity,
            precio: item.price,
          })),
          ...(codes?.length ? { discountCodes: codes } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      const data = (await res.json()) as DiscountApplicationResult;
      setDiscountTotal(Number(data.discountTotal) || 0);
      setApplied(Array.isArray(data.applied) ? data.applied : []);
    } catch (e: unknown) {
      console.error("Error preview descuento", e);
      setDiscountTotal(0);
      setApplied([]);
      showMessage("No se pudo aplicar el código de descuento", "warning");
    }
  };

  const cartSignature = JSON.stringify(
    cart.map((i) => ({ id: i.productoTiendaId, q: i.quantity })),
  );

  useEffect(() => {
    if (cart.length > 0) previewDiscount(promoCode ? [promoCode] : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  /**
   * Fired at the point a sale actually submits — never inferred from cart
   * contents, so it cannot false-positive when switching carts/accounts
   * while the cart is pinned and therefore never unmounts.
   */
  const resetCheckoutState = () => {
    setStep("cart");
    setPromoCode("");
    setDiscountTotal(0);
    setApplied([]);
  };

  const handleRemoveItem = (item: ICartItem) => {
    if (removeItem) removeItem(item.id);
  };

  const decreaseQty = (id: string) => {
    const product = cart.find((p) => p.id === id);
    if (!product) return;
    if (product.quantity === 1) {
      if (removeItem) {
        removeItem(id);
      } else {
        showMessage("No puede elminar completamente el producto", "warning");
      }
    } else {
      updateQuantity(id, product.quantity - 1);
    }
  };

  const increaseQty = (id: string) => {
    const product = cart.find((p) => p.id === id);
    if (!product) return;
    updateQuantity(id, product.quantity + 1);
  };

  const handleClearCart = () => {
    if (clear && cart.length > 0) {
      confirmDialog(
        `¿Estás seguro de que deseas vaciar el carrito? Se eliminarán ${cart.length} producto${cart.length !== 1 ? "s" : ""}.`,
        () => clear(),
      );
    }
  };

  const handlePinCart = () => {
    if (!isMobile) setIsCartPinned(!isCartPinned);
  };

  const getContainerWidth = () => {
    if (isCartPinned) return "100%";
    // Full width on mobile so the checkout never gets clipped.
    if (isMobile) return "100vw";
    return 400;
  };

  return (
    <Box
      sx={{
        width: getContainerWidth(),
        p: 2,
        pt: !isCartPinned ? "calc(16px + env(safe-area-inset-top))" : 2,
        pb: !isCartPinned ? "calc(16px + env(safe-area-inset-bottom))" : 2,
        display: "flex",
        flexDirection: "column",
        height: isCartPinned ? "calc(100vh - 120px)" : "100dvh",
        maxHeight: isCartPinned ? "calc(100vh - 120px)" : "100dvh",
        boxSizing: "border-box",
        ...(isCartPinned && {
          maxWidth: isMobile ? "100%" : isTablet ? "48vw" : "42vw",
          minWidth: 360,
          position: "sticky",
          top: 0,
          overflow: "hidden",
        }),
      }}
    >
      {step === "cart" && (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
        >
          <Box display="flex" flexDirection="column" flex={1}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography variant="h6">Venta</Typography>
              {!isMobile && (
                <Tooltip
                  title={isCartPinned ? "Desanclar carrito" : "Anclar carrito"}
                >
                  <IconButton
                    onClick={handlePinCart}
                    size="small"
                    aria-label={
                      isCartPinned ? "Desanclar carrito" : "Anclar carrito"
                    }
                    sx={{
                      color: isCartPinned ? "primary.main" : "secondary.main",
                      "&:hover": {
                        bgcolor: isCartPinned
                          ? alpha(theme.palette.primary.main, 0.08)
                          : "action.hover",
                      },
                    }}
                  >
                    {isCartPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <Typography variant="body2" color="success.main">
              Productos ({cart.length})
            </Typography>
          </Box>

          <Box display="flex" flexDirection="row" alignItems="flex-start">
            {clear && (
              <Button
                startIcon={<Delete />}
                variant="contained"
                onClick={handleClearCart}
                disabled={cart.length === 0}
                size={isCartPinned && !isTablet ? "medium" : "small"}
                sx={{ mr: 1 }}
              >
                Vaciar
              </Button>
            )}
            <IconButton onClick={onClose} disabled={isCartPinned}>
              <Close color={isCartPinned ? "disabled" : "error"} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/*
        Both panels are absolutely positioned inside a fixed-size relative
        container: if they competed for flex:1 while both are mounted mid
        transition, the height would jump for an instant.
      */}
      <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
        <Fade in={step === "cart"} timeout={200} unmountOnExit>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              flex={1}
              minHeight={0}
              minWidth={0}
              overflow="auto"
              sx={{
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-track": { background: "rgba(0,0,0,0.05)" },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "3px",
                  "&:hover": { background: "rgba(0,0,0,0.3)" },
                },
              }}
            >
              {cart.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onDecrease={decreaseQty}
                  onIncrease={increaseQty}
                  onRemove={removeItem ? handleRemoveItem : undefined}
                  canUpdateQuantity={Boolean(updateQuantity)}
                />
              ))}
            </Box>

            <CartSummaryFooter
              total={total}
              finalTotal={finalTotal}
              discountTotal={discountTotal}
              base={monedaBase}
              applied={applied}
              promoCode={promoCode}
              canCheckout={cart.length > 0}
              onCodeChange={setPromoCode}
              onApply={() =>
                previewDiscount(promoCode ? [promoCode] : undefined)
              }
              onCheckout={() => setStep("checkout")}
            />
          </Box>
        </Fade>

        <Fade in={step === "checkout"} timeout={200} unmountOnExit>
          <Box sx={{ position: "absolute", inset: 0 }}>
            <CheckoutView
              finalTotal={finalTotal}
              discountTotal={discountTotal}
              promoCode={promoCode}
              transferDestinations={transferDestinations}
              tiendaId={tiendaId}
              cierreId={cierreId}
              itemCount={cart.length}
              onBack={() => setStep("cart")}
              makePay={makePay}
              onSaleComplete={resetCheckoutState}
            />
          </Box>
        </Fade>
      </Box>

      {ConfirmDialogComponent}
    </Box>
  );
};
```

- [ ] **Step 2: Eliminar los componentes reemplazados**

```bash
git rm src/app/pos/components/QuickPayFields.tsx src/app/pos/components/MultiCurrencyPaymentPanel.tsx
```

- [ ] **Step 3: Verificar que no quedan referencias**

Run: `grep -rn "QuickPayFields\|MultiCurrencyPaymentPanel" src/`
Expected: sin resultados. Si aparece alguno en `src/app/pos/page.tsx`, borrar ese import — `page.tsx` monta `CartContent`, cuya firma no cambió.

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Correr la suite de tests**

Run: `npm test`
Expected: 164 tests pasando.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/cartDrawer src/app/pos
git commit -m "feat(pos): replace the split checkout with a single progressive flow

The payment UI becomes a full-screen second step of the cart drawer.
QuickPayFields and MultiCurrencyPaymentPanel are gone: cash and transfer
are now the same kind of payment line, in any currency.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: QA manual y corrección de `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: la aplicación completa.
- Produces: nada de código.

- [ ] **Step 1: Levantar la app**

Run: `npm run dev`
Abrir `http://localhost:3000/pos` con un usuario que tenga permiso `pos.vender` y un período de caja abierto.

- [ ] **Step 2: Recorrer la checklist de QA en mobile**

Usar las herramientas de desarrollo en viewport de teléfono (390×844). Marcar cada punto:

- [ ] Con 3 productos en el carrito, la lista ocupa el alto disponible y no hay scroll dentro de scroll.
- [ ] `COBRAR` abre el paso 2 a pantalla completa; `←` vuelve al carrito con el carrito intacto.
- [ ] El efectivo llega precargado con el total redondeado hacia arriba y el pie dice «Pago exacto».
- [ ] Los chips muestran Exacto y hasta tres montos redondos; tocar uno actualiza el Cambio.
- [ ] «Otro monto…» abre el sheet, **no** aparece el teclado del sistema, y el primer dígito reemplaza el valor precargado.
- [ ] La pestaña Billetes suma al tocar denominaciones y «Deshacer» quita la última.
- [ ] Pasar de Teclado a Billetes con 1.550 escrito muestra `1×1000 1×500 1×50`.
- [ ] «Agregar forma de pago» ofrece las monedas configuradas con el monto pendiente sugerido.
- [ ] Agregar una transferencia sin destino deja `VENDER` deshabilitado; elegir destino lo habilita.
- [ ] Quitar una línea recalcula el pie; la última línea no se puede quitar.
- [ ] Pagar de menos muestra «Falta N» en rojo y `VENDER` deshabilitado.
- [ ] Pagar de más muestra «Cambio N ›»; tocarlo abre el reparto.
- [ ] Pedir más vuelto del que hay en caja muestra el error inline en el pie y bloquea `VENDER`.
- [ ] Vender vuelve al carrito, limpia el descuento y el carrito queda vacío.
- [ ] El pie nunca queda tapado por la barra de gestos (safe-area).

- [ ] **Step 3: Recorrer la checklist en desktop con el carrito anclado**

- [ ] Anclar el carrito y cobrar: el paso 2 ocupa el panel, con `←` en el header.
- [ ] «Otro monto…» abre un diálogo centrado, no una hoja inferior.
- [ ] Se puede escribir el monto con el teclado físico.
- [ ] Completar una venta con el carrito anclado no rompe el estado ni resetea al cambiar de carrito.

- [ ] **Step 4: Verificar los casos de configuración**

- [ ] Negocio **sin monedas extra**: «Agregar forma de pago» ofrece solo Transferencia en moneda base.
- [ ] Negocio **con USD**: agregar efectivo USD muestra el `≈` en base con la tasa aplicada.
- [ ] Venta con **total 0** (100 % de descuento): `VENDER` habilitado.

- [ ] **Step 5: Corregir `CLAUDE.md`**

En la sección «Commands», reemplazar la línea:

```
> No automated tests exist in this project.
```

por:

```
```bash
npm test             # Vitest suite (src/__tests__/)
npm run test:watch   # Watch mode
```

> Los tests cubren lógica pura (`src/lib/`, `src/app/pos/utils/`). No hay
> `@testing-library/react`: los componentes se verifican con `npx tsc --noEmit`,
> `npm run lint` y QA manual.
```

- [ ] **Step 6: Verificación final completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: 164 tests pasando, typecheck sin output, lint limpio, build exitoso.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct the testing section, the project does have tests

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Cobertura del spec

| Sección del spec | Tareas |
|---|---|
| §3 Arquitectura y archivos | 5–11 |
| §4 Modelo de estado `PaymentLine` | 2, 9 |
| §5.1 Chips sugeridos | 1, 6 |
| §5.2 Teclado y billetes | 3, 5 |
| §5.3 Agregar formas de pago | 7, 9 |
| §5.4 Sincronización con el total | 9 (`usePaymentLines`) |
| §5.5 Vuelto | 4, 8, 9 |
| §5.6 Estados del pie | 8 |
| §5.7 `canSell` | 2, 9 |
| §5.8 Reset tras la venta | 9, 11 |
| §5.9 Descuento en el carrito | 10, 11 |
| §6 Casos borde | 9 (lógica), 12 (verificación) |
| §7 Táctil y accesibilidad | 5–9, verificado en 12 |
| §8 Convenciones | Global Constraints |
