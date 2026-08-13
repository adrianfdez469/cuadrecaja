# POS QuantityDialog redesign — design

Status: approved by user, ready for implementation planning
Date: 2026-08-02
Scope: `src/app/pos/components/QuantityDialog.tsx` only (first step of a broader POS UX pass; search/category browsing are separate, future steps)

## Problem

The current `QuantityDialog` (817 lines, single component) is the modal that lets a cashier pick a quantity and add a product to the cart. User feedback on the wider POS view: it's slow, dated-looking, and hard to use quickly. For this dialog specifically:

- Up to 14 step buttons can render simultaneously (±0.01, ±0.1, ±0.5, ±1, ±10, ±50, ±100), depending on stock size and whether the product allows decimals. There is no way to type a quantity directly — reaching a value like 37 or 2.35 means repeated tapping.
- Increase-related buttons (decimal + bulk) sit in one row; bulk-decrease buttons sit in a separate row below — no visual symmetry between "add" and "subtract".
- Decrement color semantics are inconsistent: decimal decrements are `primary` (same blue as increments), bulk decrements are `warning` (orange).
- Hardcoded styles ignore the theme: `border: 2px solid black`, `width: 30vw`, `fontSize: 8vw` (the last one scales badly on desktop).
- No product image/visual anchor — the dialog feels disconnected from the card the cashier just tapped.
- The two CTAs ("Agregar al Carrito" / "Venta Rápida") have no supporting text explaining what each does.
- When `maxPorTransaccion` is 0, buttons just disable with no explanation.

## Approach

Three variants were sketched and reviewed as wireframes with the user (see conversation; recommended variant A). Approved direction: **replace the button ladder with a directly-editable quantity field plus a minimal, step-size-driven stepper.**

## Component structure

Split the current single file into three, following the project convention of never inlining UI blocks even for single-use pieces:

- **`QuantityDialog.tsx`** (orchestrator, existing file, refactored in place) — `Dialog` shell, product header (avatar placeholder + name + price + availability line), mounts `QuantityStepper`, renders the two CTA buttons, owns `addToCart`/`handleConfirmQuantity`/`handlePayAll`. **Prop signature (`QuantityDialogProps`) stays unchanged** — `ProductModal.tsx` and `page.tsx` (the two callers) require no changes.
- **`QuantityStepper.tsx`** (new, same folder) — the quantity cluster: editable number box, ± step buttons, step-size chip row. Owns its own local UI state (edit mode, selected step chip); reports committed quantity changes to the parent via `onChange`.
- **`ProductAvatarPlaceholder.tsx`** (new, same folder) — small reserved visual slot for a future product image. Renders a generic placeholder icon today; this is the single place to wire in a real image once the data model supports one.

## `QuantityStepper` — interaction model

Props: `value: number`, `onChange: (next: number) => void`, `min: number`, `max: number`, `allowDecimal: boolean`, `showBulkChip10/50/100: boolean` (three flags, computed by the orchestrator exactly as today: `productoTienda?.existencia >= N || productoTienda?.producto.unidadesPorFraccion >= N` for `N` in `10/50/100` — kept as the same OR-condition, not collapsed into a single "tier" number, to avoid changing existing threshold behavior).

`min` is computed by the orchestrator as `allowDecimal ? 0.01 : 1` — same minimum the current implementation enforces via `decrease()`/`decreaseWithPrecision()`.

**Display mode (default):**
- Quantity shown as large `tabular-nums` text inside a bordered box. `border: 1px solid` theme divider token, `borderRadius: 8` (theme default), font size via responsive `sx` breakpoints (`xs`/`sm`/`md`), not `vw` units.
- Flanking `−{step}` / `+{step}` buttons, always visible (2 buttons total, not up to 12).
- Step-size chip row below the box, single-select:
  - Integer products: chips from `[1, 10, 50, 100]`, each of `10`/`50`/`100` gated by its matching `showBulkChip10/50/100` prop. `1` always present.
  - Decimal-allowed products: chips fixed at `[0.01, 0.1, 0.5, 1]` — no threshold filtering, these are always relevant for fractioned/loose products.
  - Exactly one chip is active. Default active chip: `1` for integer products, `0.1` for decimal products (matches today's implicit primary step).
  - **Tapping a chip changes only the active step for the ± buttons — it never changes `value`.** (Explicitly confirmed with user.)
- "Usar máximo" text-button under the availability line: sets `value = max` in one tap. Covers "sell off the rest of this stock" without repeated bulk-button taps.

**Edit mode (triggered by tapping/clicking the quantity box):**
- Box swaps to a `SelectableTextField` (existing project component — wraps MUI `TextField`, selects all text on focus via deferred `setTimeout` so typing overwrites immediately; same pattern used by `MoneyField`/`PercentageField`).
- `inputProps={{ inputMode: allowDecimal ? "decimal" : "numeric" }}` — not `type="number"` (documented reason in `SelectableTextField`/`MoneyField`: `.select()` doesn't reliably work on native number inputs).
- Non-decimal products: strip any non-digit character from input as it's typed (same "wrap + intercept onChange" pattern `MoneyField` uses for stripping `-`).
- Commit on blur or Enter:
  - Parse the buffered text to a number.
  - Empty/NaN → revert to the last valid `value` (never silently commit 0).
  - Otherwise: round (2 decimals if `allowDecimal`, else integer), clamp to `[min, max]`, call `onChange`.
  - **Clamping is silent** — no error toast. The visible "Disponibles: N" line already sets the ceiling before the user types, so an inline correction is enough; this also matches the existing philosophy of disabling controls rather than surfacing validation errors.
- Exit edit mode after commit, re-render display mode with the new value.

## `QuantityDialog` — orchestrator changes

- Keeps `getMaxQuantity` / `getMaxForDisplay` / `maxDisponibleOverride` handling **exactly as today** — these already delegate to `calcularDisponibilidadReal`'s `maxPorTransaccion`, which is the authoritative ceiling (accounts for parent-stock consumption on fraction products). `QuantityStepper` only changes *how* `quantity` state gets set; it does not touch the existing stock-validation logic in `handleConfirmQuantity`/`handlePayAll`. This keeps the change low-risk on the already-hardened stock math.
- Product header row: `ProductAvatarPlaceholder` + name + price (unchanged `MultiCurrencyAmount` usage) + availability line (unchanged copy: `"Stock: X | Máx. por venta: Y"` for fraction products, `"Disponibles: Y"` otherwise).
- **Zero-stock case**: when `getMaxForDisplay() <= 0`, replace the availability line with `"Sin stock disponible"` and skip rendering the stepper's step chips/± buttons (box shows `0`, disabled).
- CTA buttons: same two buttons and same click handlers as today. Add a small caption under "Venta Rápida": *"Agrega y pasa directo a cobrar"*.

## Out of scope

- Search bar, category browsing modal (`ProductModal.tsx`), and the floating search-results panel in `page.tsx` — separate future steps in the broader POS UX pass.
- Any backend/schema change to add a real product image field — `ProductAvatarPlaceholder` only reserves the slot.
- Bottom-sheet dialog presentation (Approach B) and pure cosmetic-only cleanup (Approach C) — considered and rejected in favor of Approach A during wireframe review.

## Testing

No automated test suite exists in this project (per `CLAUDE.md`). Verification is manual: exercise the dialog for (a) a normal integer-stock product, (b) a decimal/fraction product, (c) a product with `stockTier` crossing each chip threshold (10/50/100), (d) zero-stock product, (e) typing an out-of-range value to confirm silent clamping, (f) typing an empty/invalid value to confirm revert-to-last-valid.
