# POS Pinned Cart Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the POS cart's pin toggle; the cart panel is always a fixed sidebar on the right from `sm` (≥600px) up, and the floating toolbar/search bars stop needing hand-computed offsets to avoid sliding under it.

**Architecture:** Two independent structural changes to `src/app/pos/page.tsx`, plus a prop rename that ripples through `CartContent`/`CartDrawer`/`ProductModal`: (1) replace the `isCartPinned` toggle with a breakpoint-derived `showCartPanel = !isMobile`; (2) turn the left region of the POS page into its own flex column (header / scrollable content / footer) so the account-pills bar and search bar become normal flow children instead of `position: fixed` elements that compute a `right` offset to avoid the cart panel.

**Tech Stack:** Next.js 15, React 19, MUI v6 (`sx` prop, `Grid2`), TypeScript, no automated component tests (per `CLAUDE.md`: components are verified with `tsc --noEmit`, `npm run lint`, and manual QA).

## Global Constraints

- All new identifiers/comments in English; UI copy stays in Spanish (tuteo register). (`CLAUDE.md`)
- No Prisma/DB access involved — this is UI-only.
- `@/` alias for all `src/` imports.
- No new automated tests required for this change (component-level UI is verified via `tsc`/`lint`/manual QA, per `CLAUDE.md`'s testing section).
- Verify with `npx tsc --noEmit` and `npm run lint` after every task.

---

## Task 1: `CartContent` — replace `isCartPinned`/`setIsCartPinned` with `variant`

**Files:**
- Modify: `src/components/cartDrawer/components/cartContent.tsx`

**Interfaces:**
- Produces: `CartContent` prop `variant: "panel" | "drawer"` (replaces `isCartPinned: boolean` + `setIsCartPinned: (v: boolean) => void`). `"panel"` = always-visible desktop/tablet sidebar (fills 100% of its parent-controlled width). `"drawer"` = mobile overlay (fills `100vw`).

- [ ] **Step 1: Update the props interface**

In `src/components/cartDrawer/components/cartContent.tsx`, replace:

```tsx
  transferDestinations: ITransferDestination[];
  cierreId: string;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}
```

with:

```tsx
  transferDestinations: ITransferDestination[];
  cierreId: string;
  variant: "panel" | "drawer";
}
```

- [ ] **Step 2: Update the destructured params**

Replace:

```tsx
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
```

with:

```tsx
export const CartContent = ({
  cart,
  total,
  variant,
  clear,
  updateQuantity,
  onClose,
  removeItem,
  makePay,
  transferDestinations,
  cierreId,
}: IProps) => {
```

- [ ] **Step 3: Drop the now-unused breakpoint/theme hooks and imports**

`isMobile`/`isTablet`/`theme` were only used by the pin button and the pinned-width calc, both removed in this task. Replace:

```tsx
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const { user, monedaBase } = useAppContext();
```

with:

```tsx
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();

  const { user, monedaBase } = useAppContext();
```

Then update the import list: remove `useMediaQuery`, `useTheme`, `alpha` (all three become unused once the pin button and its hover color go away in Step 5), and remove the `PushPinIcon`/`PushPinOutlinedIcon` imports.

Before:

```tsx
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
  Fade,
} from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
```

After:

```tsx
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Fade,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
```

- [ ] **Step 4: Remove `handlePinCart` and simplify the width/sizing logic**

Replace:

```tsx
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
```

with:

```tsx
  return (
    <Box
      sx={{
        // In "panel" the real width comes from the wrapping Box that
        // page.tsx renders around this component (single source of truth
        // for the panel's width) — this just fills it. "drawer" is only
        // ever mounted on mobile, so it fills the full viewport width.
        width: variant === "panel" ? "100%" : "100vw",
        p: 2,
        pt: variant === "drawer" ? "calc(16px + env(safe-area-inset-top))" : 2,
        pb:
          variant === "drawer" ? "calc(16px + env(safe-area-inset-bottom))" : 2,
        display: "flex",
        flexDirection: "column",
        height: variant === "panel" ? "calc(100vh - 120px)" : "100dvh",
        maxHeight: variant === "panel" ? "calc(100vh - 120px)" : "100dvh",
        boxSizing: "border-box",
        ...(variant === "panel" && { overflow: "hidden" }),
      }}
    >
```

- [ ] **Step 5: Remove the pin `IconButton`/`Tooltip` and gate the close button by `variant`**

Replace:

```tsx
          {/* Pin, Vaciar and Close all share this one row so they line up
              at the same height — the pin used to live in a separate,
              shorter row next to the title and sat visibly off from the
              other two. */}
          <Stack direction="row" alignItems="center" gap={0.5}>
            {!isMobile && (
              <Tooltip
                title={isCartPinned ? "Desanclar carrito" : "Anclar carrito"}
              >
                <IconButton
                  onClick={handlePinCart}
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
            {clear && (
              <Tooltip title="Vaciar carrito">
                <span>
                  <IconButton
                    onClick={handleClearCart}
                    disabled={cart.length === 0}
                    aria-label="Vaciar carrito"
                  >
                    <Delete color={cart.length === 0 ? "disabled" : "action"} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <IconButton onClick={onClose} disabled={isCartPinned}>
              <Close color={isCartPinned ? "disabled" : "error"} />
            </IconButton>
          </Stack>
```

with:

```tsx
          {/* Vaciar and Close share this row so they line up at the same
              height. Close only renders in "drawer": a "panel" cart can't
              be closed, so there's nothing to disable-and-show. */}
          <Stack direction="row" alignItems="center" gap={0.5}>
            {clear && (
              <Tooltip title="Vaciar carrito">
                <span>
                  <IconButton
                    onClick={handleClearCart}
                    disabled={cart.length === 0}
                    aria-label="Vaciar carrito"
                  >
                    <Delete color={cart.length === 0 ? "disabled" : "action"} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {variant === "drawer" && (
              <IconButton onClick={onClose} aria-label="Cerrar">
                <Close color="error" />
              </IconButton>
            )}
          </Stack>
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `cartContent.tsx`. There will be errors in `CartDrawer.tsx` and `page.tsx` (they still pass the old `isCartPinned`/`setIsCartPinned` props) — that's expected until Tasks 2 and 4 land; confirm the errors are only in those two files.

- [ ] **Step 7: Commit**

```bash
git add src/components/cartDrawer/components/cartContent.tsx
git commit -m "$(cat <<'EOF'
refactor(pos): replace cart pin toggle with a panel/drawer variant

CartContent no longer owns pin state or renders a pin button — it just
adapts its own sizing to whichever context mounts it. Callers now say
which one they want instead of the component deciding via a shared
boolean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `CartDrawer` — always mounts `CartContent` as `variant="drawer"`

**Files:**
- Modify: `src/components/cartDrawer/CartDrawer.tsx`

**Interfaces:**
- Consumes: `CartContent` prop `variant: "panel" | "drawer"` (Task 1).
- Produces: `CartDrawer`'s own `IProps` drops `isCartPinned`/`setIsCartPinned` — callers no longer pass them.

- [ ] **Step 1: Drop the pin props from `CartDrawer`'s interface and destructuring**

Replace:

```tsx
  updateQuantity?: (id: string, quantity: number) => void;
  clear?: () => void;
  removeItem?: (id: string) => void;
  total: number;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}

const CartDrawer: FC<IProps> = ({
  open,
  cart,
  onClose,
  makePay,
  transferDestinations,
  cierreId,
  updateQuantity,
  clear,
  removeItem,
  total,
  isCartPinned,
  setIsCartPinned,
}) => {
```

with:

```tsx
  updateQuantity?: (id: string, quantity: number) => void;
  clear?: () => void;
  removeItem?: (id: string) => void;
  total: number;
}

const CartDrawer: FC<IProps> = ({
  open,
  cart,
  onClose,
  makePay,
  transferDestinations,
  cierreId,
  updateQuantity,
  clear,
  removeItem,
  total,
}) => {
```

- [ ] **Step 2: Pass `variant="drawer"` instead of the pin props**

Replace:

```tsx
        <CartContent
          cart={cart}
          total={total}
          clear={clear}
          updateQuantity={updateQuantity}
          onClose={onClose}
          removeItem={removeItem}
          makePay={makePay}
          transferDestinations={transferDestinations}
          cierreId={cierreId}
          isCartPinned={isCartPinned}
          setIsCartPinned={setIsCartPinned}
        />
```

with:

```tsx
        <CartContent
          cart={cart}
          total={total}
          clear={clear}
          updateQuantity={updateQuantity}
          onClose={onClose}
          removeItem={removeItem}
          makePay={makePay}
          transferDestinations={transferDestinations}
          cierreId={cierreId}
          variant="drawer"
        />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `CartDrawer.tsx`. `page.tsx` still errors (still passes `isCartPinned`/`setIsCartPinned` to `CartDrawer` — fixed in Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/components/cartDrawer/CartDrawer.tsx
git commit -m "$(cat <<'EOF'
refactor(pos): CartDrawer always mounts CartContent in drawer variant

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ProductModal` — rename `isCartPinned` to `inPanel`

**Files:**
- Modify: `src/app/pos/components/ProductModal.tsx`

**Interfaces:**
- Produces: `ProductModal` prop `inPanel?: boolean` (replaces `isCartPinned?: boolean`) — same boolean semantics (in-flow overlay vs. centered `Modal`), just no longer named after a pin toggle since the caller now derives it from the breakpoint.

- [ ] **Step 1: Rename the prop everywhere it appears in this file**

Replace:

```tsx
interface ProductModalProps {
  open: boolean;
  closeModal: () => void;
  productosTienda: IProductoTiendaV2[];
  allProductosTienda?: IProductoTiendaV2[];
  category: { id: string; nombre: string; color: string } | null;
  isCartPinned?: boolean;
}

export function ProductModal({
  open,
  closeModal,
  productosTienda,
  allProductosTienda,
  category,
  isCartPinned,
}: ProductModalProps) {
```

with:

```tsx
interface ProductModalProps {
  open: boolean;
  closeModal: () => void;
  productosTienda: IProductoTiendaV2[];
  allProductosTienda?: IProductoTiendaV2[];
  category: { id: string; nombre: string; color: string } | null;
  inPanel?: boolean;
}

export function ProductModal({
  open,
  closeModal,
  productosTienda,
  allProductosTienda,
  category,
  inPanel,
}: ProductModalProps) {
```

- [ ] **Step 2: Update the two remaining usages**

Replace:

```tsx
        borderRadius: isCartPinned ? 0 : { xs: 0, sm: 2 },
```

with:

```tsx
        borderRadius: inPanel ? 0 : { xs: 0, sm: 2 },
```

Replace:

```tsx
  return isCartPinned ? (
```

with:

```tsx
  return inPanel ? (
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `ProductModal.tsx`. `page.tsx` still errors (still passes `isCartPinned` to `ProductModal` — fixed in Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/app/pos/components/ProductModal.tsx
git commit -m "$(cat <<'EOF'
refactor(pos): rename ProductModal's isCartPinned prop to inPanel

No behavior change — the prop stops implying a pin toggle that no
longer exists; the caller now derives the boolean from the breakpoint.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `page.tsx` — remove the pin toggle, cart panel always shows on `sm+`

This task removes `isCartPinned` state and the pin toggle everywhere in `page.tsx`, replacing it with a derived `showCartPanel = !isMobile`. It deliberately does **not** yet touch the `position: fixed` floating bars' architecture — they keep using the existing `cartPanelWidth` measurement, just gated by `showCartPanel` instead of `isCartPinned`. That's Task 5. At the end of this task the pin is fully gone and the cart is a permanent sidebar on `sm+` — a complete, shippable increment on its own.

**Files:**
- Modify: `src/app/pos/page.tsx`

**Interfaces:**
- Consumes: `CartContent` `variant` prop (Task 1), `CartDrawer` without pin props (Task 2), `ProductModal` `inPanel` prop (Task 3).

- [ ] **Step 1: Hoist the breakpoint hooks above the `cartPanelWidth` effect**

The effect that measures the pinned panel's width needs to re-run when the panel mounts/unmounts, which now depends on `isMobile` — so `isMobile` must exist before that effect is declared. Move `theme`/`isMobile`/`isTablet` up.

Replace:

```tsx
  const [isCartPinned, setIsCartPinned] = useState(false);

  // The floating cart-pills bar, search bar and search-results panel all
  // need to stop exactly where the pinned cart panel begins. They used to
  // compute that offset independently via getCartWidth() (a guessed vw
  // string) — the same "two numbers that must coincidentally agree" bug
  // already fixed once for the main content column, recurring here because
  // these three bars stayed position:fixed with their own hand-computed
  // right offset instead of becoming real flex layout. Measuring the
  // panel's actual rendered width sidesteps the class of bug entirely,
  // rather than guessing a value that has to match it.
  const cartPanelRef = useRef<HTMLDivElement | null>(null);
  const [cartPanelWidth, setCartPanelWidth] = useState(0);

  useEffect(() => {
    const el = cartPanelRef.current;
    if (!el) {
      setCartPanelWidth(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setCartPanelWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCartPinned]);

  useEffect(() => {
    if (openCart && !isCartPinned) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
      setShowSearchResults(false);
    }
  }, [openCart, isCartPinned]);
```

with:

```tsx
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // The cart panel is a permanent sidebar from sm+ — no toggle, no
  // closing it. Below that it falls back to the CartDrawer overlay.
  const showCartPanel = !isMobile;

  // The floating cart-pills bar, search bar and search-results panel all
  // need to stop exactly where the cart panel begins. They compute that
  // offset via getCartWidth() (a guessed vw string) matched against the
  // panel's actual rendered width, measured here. Task 5 replaces this
  // whole mechanism with normal flex layout, which needs no measuring at
  // all — this is an intermediate step that only removes the pin toggle.
  const cartPanelRef = useRef<HTMLDivElement | null>(null);
  const [cartPanelWidth, setCartPanelWidth] = useState(0);

  useEffect(() => {
    const el = cartPanelRef.current;
    if (!el) {
      setCartPanelWidth(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setCartPanelWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCartPanel]);

  useEffect(() => {
    if (openCart && !showCartPanel) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
      setShowSearchResults(false);
    }
  }, [openCart, showCartPanel]);
```

- [ ] **Step 2: Remove the now-duplicate `theme`/`isMobile`/`isTablet` declaration further down**

Replace:

```tsx
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    if (!onboardingRun || !isMobile) return;
```

with:

```tsx
  useEffect(() => {
    if (!onboardingRun || !isMobile) return;
```

- [ ] **Step 3: Simplify `getCartWidth()`'s dead mobile branch**

`getCartWidth()` is now only ever used for the always-`sm+` panel, so its `isMobile` branch is unreachable — the panel never mounts on mobile. Replace:

```tsx
  // Calcular ancho del carrito según la pantalla
  const getCartWidth = () => {
    if (isMobile) return "100%";
    if (isTablet) return "48vw";
    return "42vw";
  };
```

with:

```tsx
  // Calcular ancho del panel del carrito (sm+ solamente; en mobile se usa
  // el Drawer, que no llama a esta función).
  const getCartWidth = () => {
    if (isTablet) return "48vw";
    return "42vw";
  };
```

- [ ] **Step 4: Category grid — static breakpoint columns instead of the `isCartPinned` ternary**

Replace:

```tsx
            gridTemplateColumns: isCartPinned
              ? {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                }
              : {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                  lg: "repeat(5, 1fr)",
                },
```

with:

```tsx
            // The cart panel is always visible from sm+ now, so these are
            // the column counts that used to only apply when pinned.
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            },
```

- [ ] **Step 5: Category tile label font size — static breakpoint object**

Replace:

```tsx
                    fontSize: isCartPinned
                      ? {
                          xs: "0.7rem",
                          sm: "0.8rem",
                          md: "1rem",
                          lg: "1.25rem",
                        }
                      : { xs: "1.25rem", sm: "1.5rem" },
```

with:

```tsx
                    // xs keeps the larger mobile size (no panel competes
                    // for width there); sm+ keeps the smaller size that
                    // used to only apply when pinned, since the panel is
                    // now always there.
                    fontSize: {
                      xs: "1.25rem",
                      sm: "0.8rem",
                      md: "1rem",
                      lg: "1.25rem",
                    },
```

- [ ] **Step 6: `ProductModal` — pass `inPanel` derived from the breakpoint**

Replace:

```tsx
        {selectedCategory && (!openCart || isCartPinned) && (
          <ProductModal
            open={showProducts}
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id,
            )}
            allProductosTienda={productosTienda}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            isCartPinned={isCartPinned}
          />
        )}
```

with:

```tsx
        {selectedCategory && (!openCart || showCartPanel) && (
          <ProductModal
            open={showProducts}
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id,
            )}
            allProductosTienda={productosTienda}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            inPanel={showCartPanel}
          />
        )}
```

- [ ] **Step 7: `CartDrawer` — open only on mobile, drop the removed props**

Replace:

```tsx
        {/* Carrito de compras */}
        <CartDrawer
          cart={cart}
          onClose={() => setOpenCart(false)}
          open={!isCartPinned && openCart}
          makePay={handleMakePay}
          transferDestinations={transferDestinations}
          cierreId={periodo?.id ?? ""}
          total={total}
          clear={clearCart}
          removeItem={removeFromCart}
          updateQuantity={handleUpdateQuantity}
          isCartPinned={isCartPinned}
          setIsCartPinned={setIsCartPinned}
        />
```

with:

```tsx
        {/* Carrito de compras (overlay, solo mobile) */}
        <CartDrawer
          cart={cart}
          onClose={() => setOpenCart(false)}
          open={isMobile && openCart}
          makePay={handleMakePay}
          transferDestinations={transferDestinations}
          cierreId={periodo?.id ?? ""}
          total={total}
          clear={clearCart}
          removeItem={removeFromCart}
          updateQuantity={handleUpdateQuantity}
        />
```

- [ ] **Step 8: `ShoppingCartComponent` FAB — hide it once the panel is always visible**

Replace:

```tsx
        <ShoppingCartComponent
          openCart={openCart}
          handleCartIcon={handleCartIcon}
          hidden={false}
        />
```

with:

```tsx
        <ShoppingCartComponent
          openCart={openCart}
          handleCartIcon={handleCartIcon}
          hidden={showCartPanel}
        />
```

- [ ] **Step 9: Pills bar and search bar — drop the dead `isCartPinned` half of the ternary**

Both bars had `right: isCartPinned && !isMobile ? cartPanelWidth : 0`. Since `showCartPanel` already means `!isMobile`, this simplifies directly. Replace (pills bar):

```tsx
            right: isCartPinned && !isMobile ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background:
              "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
```

with:

```tsx
            right: showCartPanel ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background:
              "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
```

Replace (search bar):

```tsx
            right: isCartPinned && !isMobile ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background: `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
```

with:

```tsx
            right: showCartPanel ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background: `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
```

- [ ] **Step 10: Search results portal — drop the dead ternary branch too**

Replace:

```tsx
                left: 8,
                right: isCartPinned && !isMobile ? cartPanelWidth + 8 : 8,
                bottom: searchPanelLayout.bottom,
                maxHeight: searchPanelLayout.maxHeight,
                zIndex: 1300,
                minWidth: 0,
                boxSizing: "border-box",
                maxWidth:
                  !isMobile && !isCartPinned
                    ? "min(700px, calc(100vw - 16px))"
                    : "calc(100vw - 16px)",
```

with:

```tsx
                left: 8,
                right: showCartPanel ? cartPanelWidth + 8 : 8,
                bottom: searchPanelLayout.bottom,
                maxHeight: searchPanelLayout.maxHeight,
                zIndex: 1300,
                minWidth: 0,
                boxSizing: "border-box",
                // showCartPanel is true for every non-mobile width now, so
                // the "cap at 700px" branch this used to have for unpinned
                // desktop is unreachable — always full width minus margin.
                maxWidth: "calc(100vw - 16px)",
```

- [ ] **Step 11: The pinned panel itself — mount on `showCartPanel`, pass `variant="panel"`**

Replace:

```tsx
      {isCartPinned && (
        <Box
          ref={cartPanelRef}
          sx={{
```

with:

```tsx
      {showCartPanel && (
        <Box
          ref={cartPanelRef}
          sx={{
```

Then, further down inside that same block, replace:

```tsx
            <CartContent
              cart={cart}
              total={total}
              clear={clearCart}
              updateQuantity={handleUpdateQuantity}
              onClose={() => setOpenCart(false)}
              removeItem={removeFromCart}
              makePay={handleMakePay}
              transferDestinations={transferDestinations}
              cierreId={periodo?.id ?? ""}
              isCartPinned={isCartPinned}
              setIsCartPinned={setIsCartPinned}
            />
```

with:

```tsx
            <CartContent
              cart={cart}
              total={total}
              clear={clearCart}
              updateQuantity={handleUpdateQuantity}
              onClose={() => setOpenCart(false)}
              removeItem={removeFromCart}
              makePay={handleMakePay}
              transferDestinations={transferDestinations}
              cierreId={periodo?.id ?? ""}
              variant="panel"
            />
```

- [ ] **Step 12: Search for any remaining `isCartPinned`/`setIsCartPinned` references**

Run: `grep -n "isCartPinned\|setIsCartPinned" src/app/pos/page.tsx`
Expected: no matches. If there are any left, resolve them the same way as the closest analogous step above before continuing.

- [ ] **Step 13: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors anywhere in the project — this is the last file that referenced the removed props.

- [ ] **Step 14: Commit**

```bash
git add src/app/pos/page.tsx
git commit -m "$(cat <<'EOF'
feat(pos): cart panel is a permanent sidebar from sm+, pin removed

isCartPinned is gone. The cart now always renders as a fixed side
panel from 600px up; below that it's still the CartDrawer overlay,
same as before. The floating bars (pills/search/results) still use
the old cartPanelWidth measurement for now, just gated on the
breakpoint instead of a toggle — Task 5 replaces that mechanism.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `page.tsx` — contain the floating bars inside the left panel

This is the structural fix for the actual bug reported ("floating elements overlap the cart panel"): the pills bar, search bar and search-results panel stop being `position: fixed` to the viewport and become normal children of a self-contained left-panel flex column. The browser then makes overlap with the cart panel structurally impossible, instead of relying on `cartPanelWidth` staying in sync.

**Files:**
- Modify: `src/app/pos/page.tsx`

**Interfaces:**
- Consumes: `showCartPanel` (Task 4).
- Produces: `posScrollRef` now points at the scrollable *content* region only (not the whole left panel) — relevant if any future code reads it besides `scrollPosTourTargetIntoView`.

- [ ] **Step 1: Wrap the left region in a flex column; turn the top toolbar into its first child**

Replace the opening of the left column and the top toolbar:

```tsx
      <Box
        ref={posScrollRef}
        sx={{
          // The pinned cart panel is a real flex sibling now (not a
          // position:fixed overlay with a hand-computed complementary
          // width), so `flex: 1` is what guarantees this always takes
          // exactly "whatever space the cart panel doesn't" — correct at
          // any viewport width, including when the cart's own minWidth
          // floor kicks in. Unconditional: when unpinned there's no sibling
          // at all, and flex:1 is what makes this fill the whole row —
          // `flex:"none"` shrinks it to its own content width instead,
          // leaving the rest of the row empty.
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          height: "100%", // Use parent height
          p: 0,
          position: "relative",
          ...(posOnboardingBlocksInteraction
            ? { pointerEvents: "none", userSelect: "none" }
            : {}),
        }}
      >
        {/* Barra superior con información del sistema - posicionada debajo del menú */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            bgcolor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            px: 2,
            py: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            mb: 1,
          }}
        >
```

with:

```tsx
      <Box
        sx={{
          // The cart panel is a real flex sibling (fixed sidebar from
          // sm+), so `flex: 1` guarantees this always takes exactly
          // "whatever space the cart panel doesn't" — correct at any
          // viewport width, including when the cart's own minWidth floor
          // kicks in. On mobile there's no sibling at all, and flex:1 is
          // what makes this fill the whole row.
          flex: 1,
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          ...(posOnboardingBlocksInteraction
            ? { pointerEvents: "none", userSelect: "none" }
            : {}),
        }}
      >
        {/* Barra superior con información del sistema */}
        <Box
          sx={{
            flexShrink: 0,
            bgcolor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            px: 2,
            py: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
```

The toolbar's inner content (the `PeriodoBadge`, `RefreshButton`, "Punto de partida" button, devolución button, `PosStatusToolBar`, `PrintQueueIndicator`, `ConnectionStatus` — everything between this opening `Box` and its matching closing `</Box>`) stays exactly as-is; only the wrapping `Box`'s `sx` changed above (sticky positioning removed since it's now a non-scrolling flex item; `mb: 1` dropped since the flex column's next child provides its own spacing via the wrapping content Box added in Step 2).

- [ ] **Step 2: Wrap the scrollable content (category grid + `ProductModal`) in its own `flex: 1` child, and reattach `posScrollRef` to it**

Immediately after the top toolbar's closing `</Box>` (right before the `{/* Contenido principal */}` comment and the category grid `Box`), open a new scrollable wrapper. Replace:

```tsx
        {/* Contenido principal */}
        <Box
          sx={{
            display: "grid",
```

with:

```tsx
        {/* Contenido principal (scrolleable) */}
        <Box
          ref={posScrollRef}
          sx={{ flex: 1, minWidth: 0, overflow: "auto", position: "relative" }}
        >
        <Box
          sx={{
            display: "grid",
```

Then find the category grid's closing `</Box>` (the one right before `{selectedCategory && (!openCart || showCartPanel) && (`) and the `ProductModal` block right after it — the new scroll wrapper needs to close **after** the `ProductModal` block, not before. Replace:

```tsx
          ))}
        </Box>
        {selectedCategory && (!openCart || showCartPanel) && (
          <ProductModal
            open={showProducts}
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id,
            )}
            allProductosTienda={productosTienda}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            inPanel={showCartPanel}
          />
        )}
```

with:

```tsx
          ))}
        </Box>
        {selectedCategory && (!openCart || showCartPanel) && (
          <ProductModal
            open={showProducts}
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id,
            )}
            allProductosTienda={productosTienda}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            inPanel={showCartPanel}
          />
        )}
        </Box>
```

(The category grid's own `pb: "120px"` reservation is removed in Step 5 below, since the footer no longer overlaps this scroll area.)

- [ ] **Step 3: Turn the pills bar and search bar into a normal-flow footer**

Replace:

```tsx
        <Box
          sx={{
            m: 0,
            position: "fixed",
            bottom: 60,
            left: 0,
            // Measured, not guessed: getCartWidth() is a vw string that has
            // to coincidentally match the panel's real rendered width
            // (including its minWidth floor) for this to ever line up.
            right: showCartPanel ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background:
              "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 -2px 1px rgba(0,0,0,0.1)",
          }}
        >
```

with:

```tsx
        {/* Franja inferior del panel izquierdo: píldoras de cuentas +
            buscador, en flujo normal — ya no position:fixed, así que no
            puede superponerse al panel del carrito. */}
        <Box sx={{ flexShrink: 0 }}>
        <Box
          sx={{
            m: 0,
            p: 1,
            background:
              "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 -2px 1px rgba(0,0,0,0.1)",
          }}
        >
```

The pills `Stack` and its contents (the `carts.map(...)` block and the "Nueva cuenta" `Chip`) stay unchanged inside this `Box`.

Immediately after the pills bar's closing tags (`</Stack>` then `</Box>`, right before the `{/* Buscador flotante */}` comment), replace:

```tsx
        </Box>

        {/* Buscador flotante */}
        <Box
          ref={searchAnchorRef}
          data-tour="pos-search"
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: showCartPanel ? cartPanelWidth : 0,
            p: 1,
            zIndex: 1200,
            background: `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            backdropFilter: "blur(10px)",
            boxSizing: "border-box",
            maxWidth: "100vw",
          }}
        >
```

with:

```tsx
        </Box>

        {/* Buscador */}
        <Box
          ref={searchAnchorRef}
          data-tour="pos-search"
          sx={{
            p: 1,
            background: `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            backdropFilter: "blur(10px)",
            boxSizing: "border-box",
          }}
        >
```

Then find the search bar's closing tags — right after the `</Stack>` that closes the search `Stack` (containing the `SelectableTextField` and the `Grid`/`ProductProcessorData`), and right before `{showSearchResults && searchQuery.trim() !== "" && (`. Replace:

```tsx
            </Grid>
          </Stack>
        </Box>

        {showSearchResults && searchQuery.trim() !== "" && (
```

with:

```tsx
            </Grid>
          </Stack>
        </Box>
        </Box>

        {showSearchResults && searchQuery.trim() !== "" && (
```

(This closes the new footer wrapper `Box` opened in this step, right after the search bar.)

- [ ] **Step 4: Derive the search-results panel's `right` from the search anchor's own measured position, not `cartPanelWidth`**

Replace the layout state and its updater:

```tsx
  const [searchPanelLayout, setSearchPanelLayout] = useState({
    bottom: 80,
    maxHeight: 300,
  });

  const updateSearchPanelLayout = useCallback(() => {
    const el = searchAnchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    setSearchPanelLayout({
      bottom: Math.max(0, window.innerHeight - rect.top + gap),
      maxHeight: Math.max(120, rect.top - 16 - gap),
    });
  }, []);
```

with:

```tsx
  const [searchPanelLayout, setSearchPanelLayout] = useState({
    bottom: 80,
    maxHeight: 300,
    right: 8,
  });

  const updateSearchPanelLayout = useCallback(() => {
    const el = searchAnchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    setSearchPanelLayout({
      bottom: Math.max(0, window.innerHeight - rect.top + gap),
      maxHeight: Math.max(120, rect.top - 16 - gap),
      // The search bar now lives in normal flow inside the left panel, so
      // its own right edge already stops exactly where the cart panel
      // begins (or the viewport edge, on mobile) — no need to know
      // anything about the cart panel itself.
      right: Math.max(8, window.innerWidth - rect.right + 8),
    });
  }, []);
```

Then update the results `Portal`'s `Box` to use it. Replace:

```tsx
              sx={{
                position: "fixed",
                left: 8,
                right: showCartPanel ? cartPanelWidth + 8 : 8,
                bottom: searchPanelLayout.bottom,
                maxHeight: searchPanelLayout.maxHeight,
                zIndex: 1300,
                minWidth: 0,
                boxSizing: "border-box",
                // showCartPanel is true for every non-mobile width now, so
                // the "cap at 700px" branch this used to have for unpinned
                // desktop is unreachable — always full width minus margin.
                maxWidth: "calc(100vw - 16px)",
              }}
```

with:

```tsx
              sx={{
                position: "fixed",
                left: 8,
                right: searchPanelLayout.right,
                bottom: searchPanelLayout.bottom,
                maxHeight: searchPanelLayout.maxHeight,
                zIndex: 1300,
                minWidth: 0,
                boxSizing: "border-box",
                maxWidth: "calc(100vw - 16px)",
              }}
```

- [ ] **Step 5: Remove the now-unneeded bottom padding reserved in the category grid**

The grid used to reserve space so its content wasn't hidden under the `position: fixed` bars. The footer is now a real flex sibling that claims its own space, so this is dead. Replace:

```tsx
            gap: { xs: 0.5, sm: 1.5, md: 2 },
            alignContent: "start",
            p: 1,
            width: "100%",
            maxWidth: "1400px",
            pb: "120px",
            minHeight: "90vh",
            position: "relative",
            zIndex: 1,
          }}
        >
```

with:

```tsx
            gap: { xs: 0.5, sm: 1.5, md: 2 },
            alignContent: "start",
            p: 1,
            width: "100%",
            maxWidth: "1400px",
            minHeight: "90vh",
            position: "relative",
            zIndex: 1,
          }}
        >
```

- [ ] **Step 6: Delete `cartPanelRef`/`cartPanelWidth` and their `ResizeObserver` — nothing reads them anymore**

Run: `grep -n "cartPanelWidth\|cartPanelRef" src/app/pos/page.tsx`

This should now show exactly two remaining references: the `ref={cartPanelRef}` on the pinned panel `Box` itself, and its declaration. Replace:

```tsx
  // The floating cart-pills bar, search bar and search-results panel all
  // need to stop exactly where the cart panel begins. They compute that
  // offset via getCartWidth() (a guessed vw string) matched against the
  // panel's actual rendered width, measured here. Task 5 replaces this
  // whole mechanism with normal flex layout, which needs no measuring at
  // all — this is an intermediate step that only removes the pin toggle.
  const cartPanelRef = useRef<HTMLDivElement | null>(null);
  const [cartPanelWidth, setCartPanelWidth] = useState(0);

  useEffect(() => {
    const el = cartPanelRef.current;
    if (!el) {
      setCartPanelWidth(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setCartPanelWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCartPanel]);

  useEffect(() => {
```

with:

```tsx
  useEffect(() => {
```

Then remove the now-unused `ref={cartPanelRef}` from the pinned panel `Box`. Replace:

```tsx
      {showCartPanel && (
        <Box
          ref={cartPanelRef}
          sx={{
```

with:

```tsx
      {showCartPanel && (
        <Box
          sx={{
```

- [ ] **Step 7: Confirm no stray references remain**

Run: `grep -n "cartPanelWidth\|cartPanelRef" src/app/pos/page.tsx`
Expected: no matches.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If `ResizeObserver`'s import/usage removal leaves any other now-unused identifier (e.g. an unused `useRef` if nothing else in the file needs it — check first, `searchAnchorRef`/`searchInputRef`/`searchResultsRef`/`posScrollRef`/`editCartInputRef`/`scannerRef`/`hardwareScanHandlerRef` all still use it), fix the lint error directly.

- [ ] **Step 9: Commit**

```bash
git add src/app/pos/page.tsx
git commit -m "$(cat <<'EOF'
fix(pos): stop the account-pills/search bars from needing to know the
cart panel's width

They were position:fixed to the viewport and computed a right offset
from a ResizeObserver-measured cartPanelWidth to avoid sliding under
the cart panel — the same fragile pattern the last several commits
patched symptom by symptom. They're normal flow children of a
self-contained left-panel flex column now, so the browser makes the
overlap structurally impossible instead of relying on two numbers
staying in sync.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, zero errors/warnings introduced by this change.

- [ ] **Step 2: Confirm the pin is fully gone from the codebase**

Run: `grep -rn "isCartPinned\|setIsCartPinned\|PushPinIcon\|PushPinOutlinedIcon\|Anclar carrito\|Desanclar carrito" src/`
Expected: no matches.

- [ ] **Step 3: Manual QA in the browser**

Per `CLAUDE.md`, this component is verified manually (no `@testing-library/react` in this project). Start the dev server (`npm run dev` or `npm run dev:https`, whichever the project is already using — check for a running instance on port 3000 first) and open `/pos` at each of these widths, resizing the window live where noted:

1. **Desktop (≥1200px):** cart panel visible on the right at load, no pin icon anywhere in the cart header, no floating cart FAB. Type in the search box until results appear — the results panel must stop flush at the cart panel's left edge, never underneath it. Switch between multiple cart accounts (pills) — the pills row must sit above the search bar, never behind the cart panel.
2. **Tablet (700-900px):** same checks; cart panel should be visibly narrower (`48vw`) than desktop's `42vw`.
3. **Mobile (<600px):** cart panel must NOT render; the floating cart FAB reappears once an item's in the cart; tapping it opens the `Drawer` overlay with a working "Cerrar" (X) button; category grid uses 2 columns with the larger label text.
4. **Resize live** from desktop down through 600px with the mobile drawer open: crossing 600px should close the drawer and swap in the fixed panel with no dangling open state.
5. **Open a category** (product grid) on desktop: on `sm+` it should render in-flow (square corners) inside the left panel and not visually escape into the cart panel or the footer; on mobile it's the centered rounded `Modal`.
6. Check the browser console for errors during all of the above.

If a `chromium-cli`-style headless driver is available in the execution environment, drive this same checklist there and attach screenshots instead of/in addition to describing the manual pass.

- [ ] **Step 4: Report results**

Summarize which of the Step 3 checks passed, and any that didn't (with what was observed) — don't claim the layout is fixed without having actually looked at it per `superpowers:verification-before-completion`.
