# POS inline checkout (no payment modal) — design

Status: approved by user, ready for implementation planning
Date: 2026-08-03
Scope: `src/components/cartDrawer/components/cartContent.tsx`, `src/app/pos/components/PaymentModal.tsx` (dissolved), `src/app/pos/page.tsx` (wiring only)

## Problem

Completing a sale today always opens `PaymentModal` (a centered `Modal`, 1087 lines) on top of the cart drawer, for every transaction regardless of complexity. The overwhelming majority of sales are simple: exact or near-exact cash payment in the business's own currency. Forcing a modal round-trip for that common case adds friction to the single highest-leverage action in the POS — completing a sale — and is inconsistent with the progressive-disclosure approach already applied to the quantity-picker (`docs/superpowers/specs/2026-08-02-pos-quantity-dialog-redesign-design.md`).

## Approach

Dissolve `PaymentModal` into two pieces that live directly inside the cart drawer (`CartContent`), swapping in place of each other rather than stacking as a modal:

1. **Fast path** (`QuickPayFields`, always visible): a handful of optional fields below the cart total. Touching nothing and tapping **Vender** sells for the exact total, in the business's base currency, in cash. Every field is opt-in on top of that default.
2. **Multi-currency path** (`MultiCurrencyPaymentPanel`): the existing multi-currency payment UI, relocated. Reached via a **Multimoneda** button that only exists (in the DOM) when the business has more than one active currency — single-currency businesses never see it. Opening it collapses the product list and shows this panel in its place, within the same drawer; a **Volver** button restores the product list.

Both paths call the same `handleMakePay` in `page.tsx` — its signature does not change.

## Component structure

- **`CartContent.tsx`** (modified): adds `paymentMode: "cart" | "multimoneda"` state (default `"cart"`). Owns the discount-code field and the resulting `finalTotal`/`discountTotal` (shared by both payment modes — discount is a property of the sale, not of how it's paid). Renders:
  - `paymentMode === "cart"`: product list (unchanged) + `QuickPayFields` + **Vender** button.
  - `paymentMode === "multimoneda"`: `MultiCurrencyPaymentPanel` in place of the product list, with its own **Confirmar Pago** and **Volver**.
  - The **Multimoneda** button (opens the panel) renders only when `hasExtraCurrencies` (moved from `PaymentModal` — `monedasActivas.some(m => m.monedaCode !== monedaBase)`) is true, directly below **Vender**.
- **`QuickPayFields.tsx`** (new): the optional fast-path fields — cash amount received, transfer toggle (amount + destination), bill-breakdown toggle. Pure controlled inputs; reports its computed `{ cash, transfer, transferDestId, showingBreakdown }` up to `CartContent` (no cart/sale knowledge of its own).
- **`MultiCurrencyPaymentPanel.tsx`** (new, extracted from `PaymentModal.tsx`): the per-currency payment/change UI — add currency, cash/transfer/breakdown per currency, multi-currency change distribution, drawer-balance validation. Same logic as today's `PaymentModal` body, minus the `Modal` wrapper, minus the discount section (now owned by `CartContent`), minus the header total display (also owned by `CartContent`, always visible above whichever mode is active).
- **`PaymentModal.tsx`**: deleted. `IMultimonedaExtras` (currently exported from it) moves to `src/types/` — it's already imported by both `page.tsx` (view layer) and `src/services/sellService.ts` (service layer), which is exactly the cross-layer sharing `CLAUDE.md`'s conventions say belongs in `src/types/`, not re-exported from a component file. Both existing import sites update to the new path.
- **`page.tsx`**: stops rendering `<PaymentModal>` and stops owning `paymentDialog` open/close state for it (`setPaymentDialog` calls tied to the modal's lifecycle are removed). `handleMakePay` itself is untouched — both new components call it exactly as `PaymentModal` did.

## `QuickPayFields` behavior

- **Monto recibido (efectivo)**: optional numeric field, no default value shown (placeholder communicates "exacto" when empty). Its "empty" meaning depends on the transfer toggle, to keep the rule unambiguous:
  - Transfer **off**: empty → cash tendered = the full total due (the "exact payment" default). Filled with an amount ≥ what's owed → a "Cambio: X" line appears live below the field, computed the same way `PaymentModal`'s single-currency branch already computes it (`round2(monto - finalTotal)`, base currency, no denomination assist).
  - Transfer **on**: empty → cash tendered = 0 (no auto-fill/auto-suggestion once a second payment method is in play — the customer paid entirely by transfer unless a cash amount is explicitly typed too). This intentionally drops `PaymentModal`'s reactive `suggestCash` auto-fill-the-remainder behavior in favor of a simpler, fully predictable default.
  - Either way, if cash + transfer is still less than what's owed → a "Falta: X" line appears in `error.main` and **Vender** disables — same guard `PaymentModal` already applies (`!falta` before allowing confirm).
- **Toggle "Pagó por transferencia"**: reveals a transfer-amount field (no default value; empty = 0) and (only if `transferDestinations.length > 1`) a destination `Select`, using the existing `defaultDestId` logic for the default selection when only one destination exists. Cash and transfer amounts sum toward the total, same as `PaymentModal`'s base-currency section today — just without that section's auto-suggest.
- **Toggle "Desglosar billetes"**: reveals the existing `BillBreakdownInput` component inline; its `onChange` feeds the same "monto recibido" field `QuickPayFields` already owns — it's an input assist, not a separate value.
- **Vender button** (owned by `CartContent`, reads `QuickPayFields`' reported values): disabled when payment is short (`falta`) or a transfer amount is entered without a resolved destination. Otherwise a single tap executes the sale immediately — no secondary confirmation screen. This matches today's friction level: opening the cart, reviewing it, and tapping one clearly-labeled action.

## `MultiCurrencyPaymentPanel` behavior

Functionally identical to `PaymentModal` today, with these boundary changes:
- No `Modal`/backdrop — renders as a normal child of `CartContent`'s scroll area, replacing the product list.
- Receives `finalTotal`/`discountTotal` as props from `CartContent` instead of owning discount state itself.
- **Volver** button calls a prop (`onBack`) that sets `paymentMode` back to `"cart"` in `CartContent`. Re-entering the panel later re-initializes it (same "reset on open" behavior `PaymentModal`'s `useEffect(..., [open, monedaBase])` already has today) — nothing carries over between visits, matching today's modal-close-discards-state behavior.
- **Confirmar Pago** button: unchanged logic from `PaymentModal.handlePayment`, calling `handleMakePay` with the full multi-currency payload.

## Data flow into `handleMakePay`

No change to `handleMakePay`'s signature in `page.tsx`. Both callers build its arguments differently:

- **Fast path** ("Vender"): `totalCash` = cash amount (or `finalTotal` if the field was left empty and transfer is off), `totalTransfer` = transfer amount if toggled (else 0), `transferDestinationId` = selected destination if transfer used, `discountCodes` = `[promoCode]` if a code was applied, `multimoneda` = constructed with the same shape `PaymentModal` builds today (`monedaCobro: monedaBase`, `pagosDetalle` with the cash/transfer lines actually used, `vueltoDetalle` with the computed change if any, `tasaSnapshot: tasasVigentes`, `discountTotal` if > 0) — so cash-drawer balance tracking and sale records stay exactly as complete as they are today, regardless of which path sold the item.
- **Multi-currency path** ("Confirmar Pago"): identical to `PaymentModal.handlePayment` today — unchanged.

## Out of scope

- The currency math itself (`calcularVuelto`, `convertToBase`/`convertFromBase` in `src/lib/currency.ts`) — untouched.
- Drawer cash-balance validation (`vueltoErrors`, the `/api/cierre/.../cash-balance` fetch) — carries into `MultiCurrencyPaymentPanel` unchanged.
- `isCartPinned` desktop split-view mechanism — both `paymentMode` states must render correctly in both the pinned sidebar and the mobile drawer, but the pinning mechanism itself isn't touched.
- Discount preview API (`/api/discounts/preview`) — same request/response contract, just called from `CartContent` instead of `PaymentModal`.
- Any change to how sales are synced/stored (`createSell`, `addSale`, `syncPendingSales`) — only how the payment payload is assembled before reaching `handleMakePay`.

## Testing

No automated test suite covers UI components in this project (per `CLAUDE.md`); this change has no pure-logic surface worth a new unit test (the fast path reuses `PaymentModal`'s existing change/falta arithmetic, not new math). Verification is manual: exercise (a) exact-payment sale (nothing touched, tap Vender), (b) cash overpayment showing computed change, (c) cash underpayment showing "Falta" and a disabled Vender, (d) transfer-only payment with a single configured destination, (e) transfer payment with multiple destinations requiring a selection, (f) bill-breakdown assist filling the cash field, (g) a discount code applied before tapping Vender, (h) the same discount code carried into the multi-currency panel, (i) full multi-currency flow via "Multimoneda" → "Confirmar Pago", (j) "Volver" discarding multi-currency panel state, (k) a single-currency business confirming the "Multimoneda" button never renders, (l) both `isCartPinned` on and off.
