# POS Inline Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `PaymentModal` popup with an inline checkout that lives in the cart drawer itself — a fast "Vender" path for exact/simple payment, and an optional multi-currency panel that swaps in place of the product list instead of opening as a modal.

**Architecture:** Dissolve `PaymentModal.tsx` into two new components (`QuickPayFields.tsx`, `MultiCurrencyPaymentPanel.tsx`) wired into `CartContent.tsx`, which gains a `paymentMode` toggle. Both payment paths call the existing `handleMakePay` in `page.tsx` — its signature is untouched.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / MUI v6 / Zustand. No new dependencies. No automated UI tests (per `CLAUDE.md`); verification is manual in the browser.

## Global Constraints

- `handleMakePay`'s signature in `page.tsx` does not change: `(total, totalCash, totalTransfer, transferDestinationId?, discountCodes?, multimoneda?) => Promise<void>`.
- The **Multimoneda** button must not render in the DOM at all (not just hidden) for businesses without extra active currencies — same `hasExtraCurrencies` check `PaymentModal` already uses: `monedasActivas.some(m => m.monedaCode !== monedaBase)`.
- Fast-path "Monto recibido" field: empty **and** transfer off → cash tendered = the full total due, no change. Empty **and** transfer on → cash tendered = 0 (no auto-suggest once a second payment method is in play).
- Insufficient payment (`falta`) disables **Vender**, exactly like `PaymentModal` already disables **Confirmar Pago** today.
- Discount-code state (`promoCode`, `discountTotal`, `applied`) is owned by `CartContent`, shared by both payment paths — not duplicated in either.
- `IMultimonedaExtras` moves to `src/schemas/pago.ts` as a Zod-derived type (`z.infer`), matching this project's "interfaces derive from Zod schemas" convention — not a hand-written `interface` in a component file.
- New code: English identifiers/comments; existing Spanish identifiers in code being moved (e.g. `pagosMap`, `monedaBase`) are preserved as-is, per `CLAUDE.md`.

---

### Task 1: Move `IMultimonedaExtras` to `src/schemas/pago.ts`

**Files:**
- Modify: `src/schemas/pago.ts`
- Modify: `src/app/pos/components/PaymentModal.tsx:1-52` (imports + remove local interface)
- Modify: `src/app/pos/page.tsx:715` (type reference)
- Modify: `src/services/sellService.ts:7` (import)

**Interfaces:**
- Produces (consumed by every later task): `IMultimonedaExtras` type, importable as `import type { IMultimonedaExtras } from "@/schemas/pago";`. Shape unchanged: `{ monedaCobro: string; pagosDetalle: IPagoLinea[]; vueltoDetalle: IVueltoLinea[]; tasaSnapshot: ITasaSnapshot; discountTotal?: number }`.

- [ ] **Step 1: Add the schema and type to `src/schemas/pago.ts`**

Read the current file first — it already exports `pagosDetalleSchema`, `vueltoDetalleSchema`, `IPagoLinea`, `IVueltoLinea`. Add an import for `tasaSnapshotSchema` and the new schema/type at the end of the file:

```ts
import { tasaSnapshotSchema } from "./tasaCambio";
```

(add this import near the top, alongside the existing `import { z } from 'zod';`)

```ts
export const multimonedaExtrasSchema = z.object({
  monedaCobro: z.string().min(1),
  pagosDetalle: pagosDetalleSchema,
  vueltoDetalle: vueltoDetalleSchema,
  tasaSnapshot: tasaSnapshotSchema,
  discountTotal: z.number().nonnegative().optional(),
});

export type IMultimonedaExtras = z.infer<typeof multimonedaExtrasSchema>;
```

(add this at the end of the file, after the existing type exports)

- [ ] **Step 2: Update `PaymentModal.tsx` to import instead of declare**

In `src/app/pos/components/PaymentModal.tsx`, delete lines 46-52 (the local `export interface IMultimonedaExtras { ... }` block) entirely, and add this import near the top of the file (alongside the other `@/schemas/...` imports, e.g. next to `import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";` — merge into the same import statement):

```ts
import type { IPagoLinea, IVueltoLinea, IMultimonedaExtras } from "@/schemas/pago";
```

Every other usage of `IMultimonedaExtras` inside `PaymentModal.tsx` (its own `IProps.makePay` parameter type, and the `const multimoneda: IMultimonedaExtras = {...}` in `handlePayment`) stays exactly as written — only the import source changes.

- [ ] **Step 3: Update `page.tsx`'s inline type reference**

In `src/app/pos/page.tsx`, find (around line 715):

```ts
multimoneda?: import("@/app/pos/components/PaymentModal").IMultimonedaExtras,
```

Replace with a normal top-level import instead of the inline `import(...)` type. Add near the top of the file, alongside the other `@/schemas/...` imports:

```ts
import type { IMultimonedaExtras } from "@/schemas/pago";
```

Then change the parameter type to:

```ts
multimoneda?: IMultimonedaExtras,
```

- [ ] **Step 4: Update `sellService.ts`'s import**

In `src/services/sellService.ts`, find:

```ts
import type { IMultimonedaExtras } from "@/app/pos/components/PaymentModal";
```

Replace with:

```ts
import type { IMultimonedaExtras } from "@/schemas/pago";
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/schemas/pago.ts src/app/pos/components/PaymentModal.tsx src/app/pos/page.tsx src/services/sellService.ts`
Expected: no new errors (pre-existing unrelated warnings in `page.tsx` are fine — this project already has some `react-hooks/exhaustive-deps` warnings there; do not fix unrelated ones).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass (this task has no logic change, purely a type relocation).

- [ ] **Step 7: Commit**

```bash
git add src/schemas/pago.ts src/app/pos/components/PaymentModal.tsx src/app/pos/page.tsx src/services/sellService.ts
git commit -m "refactor(pos): move IMultimonedaExtras to src/schemas/pago"
```

---

### Task 2: `QuickPayFields` component

**Files:**
- Create: `src/app/pos/components/QuickPayFields.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (self-contained).
- Produces (consumed by Task 3):
  ```ts
  export interface QuickPayValues {
    cash: number;
    transferEnabled: boolean;
    transfer: number;
    transferDestId: string;
  }

  interface QuickPayFieldsProps {
    finalTotal: number;
    monedaBase: string;
    transferDestinations: ITransferDestination[];
    onChange: (values: QuickPayValues) => void;
  }

  export function QuickPayFields(props: QuickPayFieldsProps): JSX.Element;
  ```
  `QuickPayFields` owns its own UI/input state internally and calls `onChange` with the full current `QuickPayValues` on every change — the parent never needs to feed values back in (uncontrolled from the parent's point of view, like `QuantityStepper`'s internal edit-mode state).

- [ ] **Step 1: Create the component**

Create `src/app/pos/components/QuickPayFields.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoneyField from "@/components/MoneyField";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { moneyRegex } from "@/utils/regex";
import type { ITransferDestination } from "@/schemas/transferDestination";

export interface QuickPayValues {
  cash: number;
  transferEnabled: boolean;
  transfer: number;
  transferDestId: string;
}

interface QuickPayFieldsProps {
  finalTotal: number;
  monedaBase: string;
  transferDestinations: ITransferDestination[];
  onChange: (values: QuickPayValues) => void;
}

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

export function QuickPayFields({
  finalTotal,
  monedaBase,
  transferDestinations,
  onChange,
}: QuickPayFieldsProps) {
  const [cash, setCash] = useState(0);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [transfer, setTransfer] = useState(0);
  const [transferDestId, setTransferDestId] = useState(() =>
    defaultDestId(transferDestinations),
  );
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);

  const report = (
    next: Partial<QuickPayValues>,
    base: {
      cash: number;
      transferEnabled: boolean;
      transfer: number;
      transferDestId: string;
    },
  ) => {
    onChange({ ...base, ...next });
  };

  const handleCashChange = (value: number) => {
    setCash(value);
    report({ cash: value }, { cash, transferEnabled, transfer, transferDestId });
  };

  const handleTransferToggle = () => {
    const next = !transferEnabled;
    setTransferEnabled(next);
    const nextTransfer = next ? transfer : 0;
    if (!next) setTransfer(0);
    report(
      { transferEnabled: next, transfer: nextTransfer },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleTransferChange = (value: number) => {
    setTransfer(value);
    report({ transfer: value }, { cash, transferEnabled, transfer, transferDestId });
  };

  const handleTransferDestChange = (id: string) => {
    setTransferDestId(id);
    report(
      { transferDestId: id },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleToggleBreakdown = () => {
    if (!showBreakdown) setBreakdownResetKey((k) => k + 1);
    setShowBreakdown((v) => !v);
  };

  return (
    <Box>
      <MoneyField
        fullWidth
        label="Monto recibido (efectivo)"
        placeholder={`Exacto: ${finalTotal.toFixed(2)} ${monedaBase}`}
        currencySymbol={<AttachMoneyIcon />}
        value={cash || ""}
        onChange={(e) => {
          if (showBreakdown) return;
          const v = e.target.value;
          if (moneyRegex.test(v)) handleCashChange(Number(v));
          else if (v === "") handleCashChange(0);
        }}
        inputProps={{ readOnly: showBreakdown }}
        sx={showBreakdown ? { bgcolor: "action.hover" } : {}}
      />

      <Button
        variant="text"
        size="small"
        onClick={handleToggleBreakdown}
        startIcon={showBreakdown ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mt: 0.5, textTransform: "none", color: "text.secondary" }}
      >
        {showBreakdown ? "Ocultar desglose" : "Desglosar billetes"}
      </Button>
      <Collapse in={showBreakdown}>
        {showBreakdown && (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              px: { xs: 0.5, sm: 1.5 },
              pb: 1,
            }}
          >
            <BillBreakdownInput
              currency={DEFAULT_CURRENCY}
              targetAmount={finalTotal}
              onChange={handleCashChange}
              resetKey={breakdownResetKey}
            />
          </Box>
        )}
      </Collapse>

      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Switch
            checked={transferEnabled}
            onChange={handleTransferToggle}
            size="small"
          />
        }
        label="Pagó por transferencia"
      />

      <Collapse in={transferEnabled}>
        <Box sx={{ mt: 1 }}>
          <MoneyField
            fullWidth
            label="Monto por transferencia"
            currencySymbol={<CreditCardIcon />}
            value={transfer || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (moneyRegex.test(v)) handleTransferChange(Number(v));
              else if (v === "") handleTransferChange(0);
            }}
          />

          {transfer > 0 && transferDestinations.length > 1 && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Destino</InputLabel>
              <Select
                value={transferDestId}
                label="Destino"
                onChange={(e) => handleTransferDestChange(e.target.value)}
              >
                {transferDestinations.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
```

**Note on `report`'s signature:** it takes the field(s) that changed (`next`) plus an explicit `base` snapshot of all four current values, rather than reading `cash`/`transferEnabled`/`transfer`/`transferDestId` from the enclosing closure implicitly — this makes each call site's inputs explicit and avoids any ambiguity about which render's state is being read. Each handler passes its own just-read closure values as `base` (correct, since only the one field it's updating differs from what's already in state).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/pos/components/QuickPayFields.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pos/components/QuickPayFields.tsx
git commit -m "feat(pos): add QuickPayFields component for inline checkout"
```

---

### Task 3: Extract `MultiCurrencyPaymentPanel`, wire inline checkout into `CartContent`

This is the task where everything lands together — `MultiCurrencyPaymentPanel` doesn't work standalone (it needs `CartContent` to mount it), and `CartContent`'s new checkout UI needs both `QuickPayFields` (Task 2) and `MultiCurrencyPaymentPanel` (this task) to exist. At the end of this task, `PaymentModal.tsx` is still present in the codebase and still imported by `page.tsx`, but nothing sets `paymentDialog` to `true` anymore, so it's unreachable dead code — that cleanup is Task 4, kept separate so this task's new flow can be verified working before the old one is deleted.

**Files:**
- Create: `src/app/pos/components/MultiCurrencyPaymentPanel.tsx`
- Modify: `src/components/cartDrawer/components/cartContent.tsx` (full rewrite of the footer/checkout section; product list and header stay as-is)
- Modify: `src/components/cartDrawer/CartDrawer.tsx` (prop passthrough)
- Modify: `src/app/pos/page.tsx` (both call sites that render `CartDrawer`/`CartContent`)

**Interfaces:**
- Consumes (from Task 2): `QuickPayFields`, `QuickPayValues` from `./QuickPayFields`.
- Consumes (from Task 1): `IMultimonedaExtras` from `@/schemas/pago`.
- Produces: `MultiCurrencyPaymentPanel` component (below). `CartContent`'s new prop interface (below) — `CartDrawer.tsx` and `page.tsx` must match it exactly.

#### `MultiCurrencyPaymentPanel` — exact extraction from `PaymentModal.tsx`

Read `src/app/pos/components/PaymentModal.tsx` in full before starting (it's ~1040 lines after Task 1's edit). This step moves the vast majority of it verbatim into a new file, with these specific changes and nothing else:

1. **Props interface** — replace `IProps`/component signature with:
   ```ts
   interface MultiCurrencyPaymentPanelProps {
     finalTotal: number;
     discountTotal: number;
     promoCode: string;
     makePay: (
       total: number,
       totalcash: number,
       totaltransfer: number,
       transferDestinationId?: string,
       discountCodes?: string[],
       multimoneda?: IMultimonedaExtras,
     ) => Promise<void>;
     transferDestinations: ITransferDestination[];
     tiendaId: string;
     cierreId: string;
     onBack: () => void;
   }
   ```
   Drop `open`, `onClose`, `total` (renamed `finalTotal`, now a prop instead of computed locally), `products` (only used for the discount preview, which no longer lives here).

2. **Delete the local `IMultimonedaExtras` interface** — it no longer exists in `PaymentModal.tsx` after Task 1; import it instead: `import type { IMultimonedaExtras } from "@/schemas/pago";`.

3. **Delete `fmtBase`** — only used by the header total display, which this component no longer renders.

4. **Delete the entire discount state block**: `promoCode`, `discountTotal` (now a prop), `applied`, `showDiscount`, `discountExpanded`, and the `finalTotal` `useMemo` (now a prop) — i.e. everything between the `fmtBase` line and the `// ─── Payments ───` comment in the original file.

5. **Delete `handleClose`** entirely — its two call sites change instead (see 7 and 8 below).

6. **Init `useEffect`** (the one that sets initial `pagosMap`, resets breakdown/vuelto state, and fetches `drawerBalance` — originally keyed on `[open, monedaBase]`): remove the `if (!open) return;` guard at its top, and change its dependency array to `[]` so it runs exactly once on mount (this component is now conditionally *mounted*, not conditionally *open*, so "runs once when opened" becomes "runs once on mount" — equivalent behavior).

7. **"Sync base cash when finalTotal resolves" `useEffect`**: change its guard from `if (!open || finalTotal <= 0) return;` to `if (finalTotal <= 0) return;`, and its dependency array from `[finalTotal, monedaBase, open]` to `[finalTotal, monedaBase]`.

8. **`handlePayment`**: replace its `handleClose();` call (near the top of the function, right after building `vueltoArr`) with `onBack();`. Nothing else in this function changes — it still reads `finalTotal`/`discountTotal`/`promoCode` (now props with the same names) and still builds the same `multimoneda` object.

9. **Delete `previewDiscount`** and the `useEffect` that calls it on `[open, JSON.stringify(products)]` — discount preview now happens in `CartContent`.

10. **Render — remove the `Modal`/positioning wrapper.** Replace:
    ```tsx
    return (
      <Modal open={open} onClose={handleClose}>
        <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", bgcolor: "background.paper", p: { xs: 2.5, sm: 4 }, borderRadius: 2, boxShadow: 24, width: { xs: "95vw", sm: 420 }, maxHeight: "90vh", overflowY: "auto" }}>
    ```
    with:
    ```tsx
    return (
      <Box sx={{ width: "100%" }}>
    ```
    (drop the `Modal` import too — it's no longer used anywhere in this file.)

11. **Remove the header** — delete the `{/* ── Header ── */}` `Typography` block (the "Cobrar: X" line with the discount strikethrough) entirely.

12. **Keep verbatim, unchanged**: the `{/* ── Payment sections ── */}` block (the `monedas.map(...)` loop covering cash/transfer/breakdown per currency), the `{/* Add payment currency */}` block, and the entire `{/* ── Change section ── */}` block. These don't reference anything that was removed.

13. **Remove the entire `{/* ── Discounts ── */}` block** (the promo-code `TextField` + "Aplicar" button + applied-discounts list) — and the `<Divider sx={{ my: 2 }} />` immediately before it (that divider was separating change-section from discounts; discounts are gone, so remove that specific divider). Keep exactly one `<Divider sx={{ my: 2 }} />` immediately before the `{/* ── Summary ── */}` block, so there's still a visual separator between the change section and the summary.

14. **In `{/* ── Summary ── */}`**: delete the "Total:" `Stack` (the first one, showing `finalTotal` with the discount color). Keep the `falta ? (...) : (...)` conditional `Stack` that shows "Falta" or "Cambio" — unchanged.

15. **In `{/* ── Actions ── */}`**: the "🚀 Confirmar Pago" button is unchanged (`onClick={handlePayment}`, `disabled={!canConfirm}`). Change the "Cancelar" button's label to "Volver" and its `onClick` from `handleClose` to `onBack`.

16. **Everything else not mentioned above** (imports you still need, `monedasActivas`/`hasExtraCurrencies`/`ceilCash`/`round2`/`defaultDestId`/`monedas`/`todasMonedas`/`monedasDisponibles`/`denominaciones`/`totalPagado`/`pagosLinea`/`falta`/`vueltoTotalBase`/`vueltoMap`/`vueltoLocked`/`drawerBalance`/`suggestCash`/`updatePago`/`addCurrency`/`removeCurrency`/`togglePayBreakdown`/`toggleTransfer`/`handleToggleBreakdown`/`updateVuelto`/`removeVueltoMoneda`/`addVueltoMoneda`/`vueltoErrors`/`hasVueltoErrors`/`canConfirm`) carries over **completely unchanged** — same variable names, same logic, same JSX. The component still uses `useAppContext()` for `monedasNegocio, tasasVigentes, monedaBase` exactly as `PaymentModal` did.

- [ ] **Step 1: Create `MultiCurrencyPaymentPanel.tsx`** by copying `PaymentModal.tsx`'s current content and applying transformations 1-16 above. Name the exported component `MultiCurrencyPaymentPanel` (named export, not default — `export function MultiCurrencyPaymentPanel(props: MultiCurrencyPaymentPanelProps) { ... }`), file default export removed (`PaymentModal.tsx` used `export default PaymentModal;` — this new file does not need a default export).

- [ ] **Step 2: Typecheck just this new file in isolation**

Run: `npx tsc --noEmit`
Expected: errors only about `MultiCurrencyPaymentPanel` not being imported/used anywhere yet are **not** expected (an unused exported function is not a TypeScript error) — the file should compile cleanly. If you see errors about missing props or mismatched types, re-check each of the 16 transformations above against the original file.

#### `CartContent.tsx` — new checkout section

Read the current `src/components/cartDrawer/components/cartContent.tsx` in full first. The `ExpiryChip` function, `CartItemCard` component, and the `{/* Header */}` and `{/* Productos */}` JSX blocks inside `CartContent` **do not change**. Everything from the `interface IProps` declaration onward changes as follows.

- [ ] **Step 1: Replace the props interface and add new imports**

Replace:
```ts
interface IProps {
  clear?: () => void;
  cart: ICartItem[];
  updateQuantity?: (id: string, quantity: number) => void;
  onClose: () => void;
  removeItem?: (id: string) => void;
  total: number;
  onOkButtonClick: () => void;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}
```
with:
```ts
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
```

Add these imports at the top of the file (alongside the existing ones):
```ts
import { useEffect, useState } from "react";
import { Collapse, TextField } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useAppContext } from "@/context/AppContext";
import type {
  IMultimonedaExtras,
  IPagoLinea,
  IVueltoLinea,
} from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";
import type {
  DiscountApplicationResult,
  DiscountApplicationResultItem,
} from "@/lib/discounts";
import { QuickPayFields, type QuickPayValues } from "@/app/pos/components/QuickPayFields";
import { MultiCurrencyPaymentPanel } from "@/app/pos/components/MultiCurrencyPaymentPanel";
```

- [ ] **Step 2: Add the new state and derived values inside `CartContent`**

Right after the existing `const isTablet = useMediaQuery(...)` line, add:

```ts
  const { user, monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const tiendaId = user?.localActual?.id ?? "";

  const monedasActivas = monedasNegocio.filter((m) => m.activo);
  const hasExtraCurrencies = monedasActivas.some(
    (m) => m.monedaCode !== monedaBase,
  );

  const [paymentMode, setPaymentMode] = useState<"cart" | "multimoneda">(
    "cart",
  );

  // ─── Discount (shared by both payment modes) ──────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);
  const [showDiscount, setShowDiscount] = useState(false);
  const discountExpanded = showDiscount || applied.length > 0;
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

  useEffect(() => {
    if (cart.length > 0) previewDiscount(promoCode ? [promoCode] : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cart.map((i) => ({ id: i.productoTiendaId, q: i.quantity })))]);

  // ─── Fast-path payment fields ──────────────────────────────────────────────
  const [quickPay, setQuickPay] = useState<QuickPayValues>({
    cash: 0,
    transferEnabled: false,
    transfer: 0,
    transferDestId: "",
  });

  const touchedPayment = quickPay.transferEnabled || quickPay.cash > 0;
  const effectiveCash = touchedPayment ? quickPay.cash : finalTotal;
  const effectiveTransfer = quickPay.transferEnabled ? quickPay.transfer : 0;
  const totalPaidFast = effectiveCash + effectiveTransfer;
  const fastFalta =
    touchedPayment &&
    Math.round(totalPaidFast * 100) < Math.round(finalTotal * 100);
  const fastCambio = Math.max(0, totalPaidFast - finalTotal);
  const needsTransferDest =
    quickPay.transferEnabled &&
    quickPay.transfer > 0 &&
    transferDestinations.length > 1 &&
    !quickPay.transferDestId;
  const canSellFast = cart.length > 0 && !fastFalta && !needsTransferDest;

  const handleFastSell = async () => {
    const pagosDetalle: IPagoLinea[] = [];
    if (effectiveCash > 0) {
      pagosDetalle.push({
        tipo: "cash",
        moneda: monedaBase,
        monto: effectiveCash,
        equivalenteBase: effectiveCash,
      });
    }
    if (effectiveTransfer > 0) {
      pagosDetalle.push({
        tipo: "transfer",
        moneda: monedaBase,
        monto: effectiveTransfer,
        equivalenteBase: effectiveTransfer,
        transferDestinationId: quickPay.transferDestId,
      });
    }
    const vueltoDetalle: IVueltoLinea[] =
      fastCambio > 0 ? [{ moneda: monedaBase, monto: fastCambio }] : [];

    const multimoneda: IMultimonedaExtras = {
      monedaCobro: monedaBase,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot: tasasVigentes,
      ...(discountTotal > 0 ? { discountTotal } : {}),
    };

    await makePay(
      finalTotal,
      effectiveCash,
      effectiveTransfer,
      quickPay.transferDestId || undefined,
      promoCode ? [promoCode] : [],
      multimoneda,
    );
  };
```

**Note:** `equivalenteBase` for these lines is the raw amount itself, not run through `convertToBase` — `monedaCobro` is always `monedaBase` on the fast path, so the base-currency equivalent of a base-currency amount is that same amount; no currency-math import is needed here.

- [ ] **Step 3: Replace the `{/* Footer */}` block**

Replace the entire existing `{/* Footer */}` `Box` (from `<Box mt={2} sx={{...}}>` through its closing `</Box>`, right before `{ConfirmDialogComponent}`) with:

```tsx
      {/* Footer */}
      <Box
        mt={2}
        sx={{
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          display="flex"
          alignItems="flex-end"
          justifyContent="space-between"
          gap={1.5}
          mb={1.5}
        >
          <Box minWidth={0} flex={1}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              Total venta
            </Typography>
            {discountTotal > 0 && (
              <Typography
                variant="caption"
                sx={{ textDecoration: "line-through", color: "text.disabled" }}
                display="block"
              >
                {total.toFixed(2)} {monedaBase}
              </Typography>
            )}
            <MultiCurrencyAmount
              amount={finalTotal}
              variant="emphasized"
              color="success.main"
            />
          </Box>
        </Box>

        <Button
          variant="text"
          size="small"
          onClick={() => setShowDiscount((v) => !v)}
          startIcon={discountExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            textTransform: "none",
            color: applied.length > 0 ? "success.main" : "text.secondary",
            mb: discountExpanded ? 1 : 1.5,
          }}
        >
          {applied.length > 0
            ? `Descuento aplicado: -${discountTotal.toFixed(2)} ${monedaBase}`
            : "¿Tienes un código de descuento?"}
        </Button>
        <Collapse in={discountExpanded}>
          <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
            <TextField
              label="Código de descuento"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  previewDiscount(promoCode ? [promoCode] : undefined);
              }}
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() =>
                previewDiscount(promoCode ? [promoCode] : undefined)
              }
              sx={{ minWidth: 90 }}
              size="small"
            >
              Aplicar
            </Button>
          </Box>
        </Collapse>

        {paymentMode === "cart" ? (
          <>
            <QuickPayFields
              finalTotal={finalTotal}
              monedaBase={monedaBase}
              transferDestinations={transferDestinations}
              onChange={setQuickPay}
            />

            {touchedPayment && (
              <Typography
                variant="body2"
                fontWeight={600}
                color={fastFalta ? "error.main" : "success.main"}
                sx={{ mt: 1, mb: 1 }}
              >
                {fastFalta
                  ? `Falta: ${(finalTotal - totalPaidFast).toFixed(2)} ${monedaBase}`
                  : fastCambio > 0
                    ? `Cambio: ${fastCambio.toFixed(2)} ${monedaBase}`
                    : "Pago exacto"}
              </Typography>
            )}

            <Button
              variant="contained"
              color="success"
              disabled={!canSellFast}
              onClick={handleFastSell}
              fullWidth
              size="large"
              sx={{ mt: 1, fontWeight: "bold", py: 1.25, minHeight: 48 }}
            >
              VENDER
            </Button>

            {hasExtraCurrencies && (
              <Button
                variant="text"
                size="small"
                onClick={() => setPaymentMode("multimoneda")}
                sx={{ mt: 1, textTransform: "none" }}
              >
                Multimoneda
              </Button>
            )}
          </>
        ) : (
          <MultiCurrencyPaymentPanel
            finalTotal={finalTotal}
            discountTotal={discountTotal}
            promoCode={promoCode}
            makePay={makePay}
            transferDestinations={transferDestinations}
            tiendaId={tiendaId}
            cierreId={cierreId}
            onBack={() => setPaymentMode("cart")}
          />
        )}
      </Box>

      {ConfirmDialogComponent}
```

- [ ] **Step 4: Hide the product list while in multimoneda mode**

Find the existing `{/* Productos */}` `Box` (the scrollable list of `CartItemCard`s). Wrap its render condition so it only shows in `"cart"` mode — change:

```tsx
      {/* Productos */}
      <Box
        flex={1}
        overflow="auto"
        sx={{ ... }}
      >
        {cart.map((item) => ( ... ))}
      </Box>
```

to:

```tsx
      {/* Productos */}
      {paymentMode === "cart" && (
        <Box
          flex={1}
          overflow="auto"
          sx={{ ... }}
        >
          {cart.map((item) => ( ... ))}
        </Box>
      )}
```

(keep the `sx` block and the `.map(...)` body exactly as they are today — only the wrapping condition is new.)

- [ ] **Step 5: Update `src/components/cartDrawer/CartDrawer.tsx`**

Add these type imports near the top of the file, alongside the existing `import { ICartItem } from "@/store/cartStore";`:

```ts
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";
```

Replace its `IProps` interface's `onOkButtonClick?: () => Promise<void>;` line with:

```ts
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
```

Update the destructured props in the component signature to include `makePay, transferDestinations, cierreId` instead of `onOkButtonClick`, and update the `<CartContent .../>` call inside to pass `makePay={makePay} transferDestinations={transferDestinations} cierreId={cierreId}` instead of `onOkButtonClick={onOkButtonClick}`.

- [ ] **Step 6: Update both call sites in `src/app/pos/page.tsx`**

At the `<CartDrawer ...>` usage (search for `onOkButtonClick={async () => setPaymentDialog(true)}` — there are two occurrences, one inside `<CartDrawer>`'s props and one inside the standalone `<CartContent>` used for the pinned sidebar), replace each occurrence with:

```tsx
          makePay={handleMakePay}
          transferDestinations={transferDestinations}
          cierreId={periodo?.id ?? ""}
```

Do **not** remove the `<PaymentModal ...>` block or the `paymentDialog` state yet — that's Task 4.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/pos/components/MultiCurrencyPaymentPanel.tsx src/app/pos/components/QuickPayFields.tsx src/components/cartDrawer/components/cartContent.tsx src/components/cartDrawer/CartDrawer.tsx src/app/pos/page.tsx`
Expected: no new errors (pre-existing `react-hooks/exhaustive-deps` warnings elsewhere in `page.tsx` are fine).

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass — this task doesn't touch any of the pure-logic modules the existing tests cover.

- [ ] **Step 9: Manual verification in the browser**

Run `npm run dev`, open the POS view with items in the cart, and exercise:

1. Open the cart with items in it → confirm "Total venta", the discount toggle, `QuickPayFields`, and a "VENDER" button all render without opening any modal.
2. Tap "VENDER" with nothing else touched → confirm the sale completes for the exact total, in cash, in the base currency (check the resulting sale record if you have visibility into it, or at minimum confirm no error and the cart clears).
3. Type an amount into "Monto recibido" greater than the total → confirm a "Cambio: X" line appears and "VENDER" stays enabled.
4. Type an amount less than the total → confirm "Falta: X" appears in red and "VENDER" disables.
5. Toggle "Pagó por transferencia", leave "Monto recibido" empty → confirm cash is treated as 0 (not auto-filled to the total) and the falta/cambio math reflects only the transfer amount.
6. With only one transfer destination configured for the business: toggle transferencia and enter an amount → confirm no destination `Select` appears (it's auto-assigned). With more than one destination configured: confirm the `Select` does appear and "VENDER" stays disabled until one is chosen.
7. Tap "Desglosar billetes" → confirm the bill-breakdown counter appears inline and that entering bill counts fills "Monto recibido" with the matching total.
8. Enter a valid discount code → confirm the total updates (struck-through gross total appears) and it stays applied whether you tap VENDER directly or open the multimoneda panel afterward.
9. If the test business has more than one active currency: tap "Multimoneda" → confirm the product list is replaced by the multi-currency panel in the same drawer (no modal), the discount stays visible above it, "Confirmar Pago" completes a multi-currency sale, and "Volver" restores the product list with the fast-path fields reset (not carrying over anything you'd typed into the multi-currency panel).
10. If the test business has only one active currency: confirm the "Multimoneda" button does not render at all.
11. Repeat steps 1-3 with `isCartPinned` both on and off (desktop sidebar vs. mobile drawer).

- [ ] **Step 10: Commit**

```bash
git add src/app/pos/components/MultiCurrencyPaymentPanel.tsx src/components/cartDrawer/components/cartContent.tsx src/components/cartDrawer/CartDrawer.tsx src/app/pos/page.tsx
git commit -m "feat(pos): inline checkout in cart drawer, replacing the payment modal flow"
```

---

### Task 4: Delete `PaymentModal.tsx` and its dead wiring

**Files:**
- Delete: `src/app/pos/components/PaymentModal.tsx`
- Modify: `src/app/pos/page.tsx` (remove `paymentDialog` state and the `<PaymentModal>` render block)

**Interfaces:**
- Consumes: nothing new — this task only removes now-unreachable code left over from Task 3.

- [ ] **Step 1: Confirm nothing still references `PaymentModal`**

Run: `grep -rn "PaymentModal" src --include="*.ts" --include="*.tsx"`
Expected: only matches inside `src/app/pos/components/PaymentModal.tsx` itself and its `import PaymentModal from "./components/PaymentModal";` / `<PaymentModal ...>` usage in `page.tsx`. If anything else matches, stop and investigate before deleting — Task 3 may not have fully migrated that usage.

- [ ] **Step 2: Remove the import and render block from `page.tsx`**

Delete the line `import PaymentModal from "./components/PaymentModal";`.

Delete the entire `{/* Modal de pago */}` block (`<PaymentModal ...> ... </PaymentModal>` — a self-closing/void-content component, so just the whole `<PaymentModal ... />` element).

Delete the `const [paymentDialog, setPaymentDialog] = useState(false);` line.

Search for remaining references to `paymentDialog`/`setPaymentDialog` in `page.tsx` (there are a few: one in a boolean condition around line 311, `setPaymentDialog(false)` calls inside `handleMakePay`'s success/error branches). For each:
- The condition at line ~311 (something like `!paymentDialog && ...` gating another behavior, e.g. scanner auto-focus) — remove `!paymentDialog &&` from that condition (the state no longer exists, and the behavior it was guarding against — not doing something while the payment modal is open — no longer applies since there's no modal to be "open").
- The `setPaymentDialog(false)` calls inside `handleMakePay` — delete those two lines; nothing sets `paymentDialog` to `true` anymore, so setting it to `false` is a no-op either way, but the dead call should go too.

- [ ] **Step 3: Delete the file**

```bash
rm src/app/pos/components/PaymentModal.tsx
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/pos/page.tsx`
Expected: no new errors.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Manual verification in the browser**

Run `npm run dev`, repeat the full checkout flow from Task 3's Step 9 once more (exact sale, cash-with-change, transfer, discount, multimoneda if applicable) — confirming nothing regressed now that the old modal and its state are gone.

- [ ] **Step 7: Commit**

```bash
git add -A src/app/pos/components/PaymentModal.tsx src/app/pos/page.tsx
git commit -m "chore(pos): remove the now-unused PaymentModal and its dead wiring"
```
