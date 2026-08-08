# POS Category Filter + Cart Panel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the POS's category-tile modal and floating search-results popup with a single always-visible product grid filtered by a fixed row of category pills + the existing search box, and close out the four items parked from the pinned-cart-layout final review (width crunch, footer extraction, unnecessary `onClose`, missing panel border).

**Architecture:** Two independent efforts against `src/app/pos/page.tsx` and its component tree. Cart-panel polish (Tasks 1-3) touches only the cart-panel region and `CartContent`. The category filter redesign (Tasks 4-6) replaces the category-tile grid + `ProductModal` + search popup with two new components (`CategoryPillsBar`, `PosProductGrid`) driven by a single combined filter (`selectedCategoryId` + `searchQuery`).

**Tech Stack:** Next.js 15, React 19, MUI v6 (`sx` prop, `Chip`, old `Grid` API for the product grid), TypeScript, no automated component tests (per `CLAUDE.md`: verified via `tsc --noEmit`, `npm run lint`, manual QA).

## Global Constraints

- All new identifiers/comments in English; UI copy stays in Spanish (tuteo register). (`CLAUDE.md`)
- `@/` alias for all `src/` imports.
- No new automated tests required (component-level UI is verified via `tsc`/`lint`/manual QA, per `CLAUDE.md`).
- No Prisma/DB access — this is UI-only.
- Verify with `npx tsc --noEmit` and `npm run lint` after every task.
- Follow the project's "no inline UI blocks" convention: extract self-contained UI regions to their own components rather than leaving them inline in `page.tsx`.

---

## Starting state

This plan assumes the codebase already has the changes from the prior "pinned cart layout" plan applied (uncommitted, in the working tree): `CartContent` takes a `variant: "panel" | "drawer"` prop, the cart panel is a permanent sidebar from `sm+`, the POS left region is a flex column (header / scrollable content wrapped in a non-scrolling containing-block wrapper / footer), and `ProductModal`'s prop is named `inPanel`. Each task below quotes the **current** file contents it modifies — if a "replace" block's old-text doesn't match what's actually in the file, stop and report NEEDS_CONTEXT rather than guessing.

---

## Task 1: Cart panel — 700px breakpoint + visible border

**Files:**
- Modify: `src/app/pos/page.tsx`

**Interfaces:** None new — `showCartPanel` keeps its name and boolean meaning, only its derivation changes.

- [ ] **Step 1: Give the cart panel its own breakpoint, decoupled from `isMobile`**

The cart panel's `minWidth: 360px` floor (protects the checkout UI's own layout — do not lower it) combined with showing the panel from `sm` (600px) left as little as ~240px for the whole left panel between 600-700px. Decouple the panel's visibility threshold from the general `isMobile` (600px) question, which everything else on the page keeps using unchanged.

Replace:
```tsx
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // The cart panel is a permanent sidebar from sm+ — no toggle, no
  // closing it. Below that it falls back to the CartDrawer overlay.
  const showCartPanel = !isMobile;
```

with:

```tsx
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // The cart panel needs its own threshold, decoupled from the general
  // "is this a phone" breakpoint (isMobile, 600px): with the panel's
  // minWidth:360px floor (protects the checkout UI's own layout), showing
  // it below ~700px left too little room for the product grid, category
  // pills and search bar. isMobile keeps governing everything else that
  // already used it (text sizes, the hardware scanner, etc.) — this is a
  // narrower, purpose-specific question. Below 700px it falls back to the
  // CartDrawer overlay, same as mobile.
  const showCartPanel = useMediaQuery(theme.breakpoints.up(700));
```

- [ ] **Step 2: Add a real border between the two panels**

Today the only delimiter between the left panel and the cart panel is a `box-shadow`, and both share the same `background.paper` color — the seam is hard to see. Add a hard border; keep the shadow for depth.

Find the cart panel's wrapping `Box` (the last top-level child of the root `Box`, rendered when `showCartPanel` is true). Replace:

```tsx
            flexShrink: 0,
            width: getCartWidth(),
            maxWidth: getCartWidth(),
            minWidth: "360px",
            height: "100%",
            // A shadow reads as "a distinct panel sitting beside this one,"
            // not just a line marking where the two happen to touch — same
            // language used for the checkout/cart footers. It has to live
            // on THIS box, not the inner one below: box-shadow paints
            // outside the border box, and a sibling `overflow: hidden` on
            // the very same box clips its own shadow away — which is why
            // the delimiting shadow wasn't actually showing.
            boxShadow: "-8px 0px 24px rgba(0,0,0,0.12)",
            backgroundColor: "background.paper",
```

with:

```tsx
            flexShrink: 0,
            width: getCartWidth(),
            maxWidth: getCartWidth(),
            minWidth: "360px",
            height: "100%",
            // The shadow alone reads as "something sits near this edge,"
            // not as a hard line — both panels share the same background
            // color, so without an actual border the seam was hard to
            // spot. The border is the delimiter; the shadow adds depth on
            // top of it. It has to live on THIS box, not the inner one
            // below: box-shadow paints outside the border box, and a
            // sibling `overflow: hidden` on the very same box clips its
            // own shadow away.
            borderLeft: "1px solid",
            borderColor: "divider",
            boxShadow: "-8px 0px 24px rgba(0,0,0,0.12)",
            backgroundColor: "background.paper",
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, no new errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/pos/page.tsx
git commit -m "$(cat <<'EOF'
fix(pos): give the cart panel its own breakpoint, add a real border

The panel's minWidth:360px floor combined with showing it from 600px
left as little as ~240px for the rest of the page in the 600-700px
range. showCartPanel now has its own 700px threshold instead of
reusing isMobile's 600px — isMobile keeps its existing meaning
everywhere else. Also adds a borderLeft (divider color) so the two
panels have a visible seam instead of relying on a shadow alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `CartContent` — discriminated union so `onClose` can't be passed to `variant="panel"`

**Files:**
- Modify: `src/components/cartDrawer/components/cartContent.tsx`
- Modify: `src/app/pos/page.tsx`

**Interfaces:**
- Produces: `CartContent`'s prop type becomes a discriminated union — `{ variant: "drawer"; onClose: () => void; ...common }` or `{ variant: "panel"; ...common }`. `CartDrawer` (always `variant="drawer"`) needs no changes — it already provides `onClose`.

- [ ] **Step 1: Split the props into a common interface + discriminated union**

Replace:

```tsx
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
  variant: "panel" | "drawer";
}

type CartStep = "cart" | "checkout";

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

with:

```tsx
interface ICommonProps {
  clear?: () => void;
  cart: ICartItem[];
  updateQuantity?: (id: string, quantity: number) => void;
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
}

// A "panel" cart has no way to close — it's a permanent sidebar — so
// `onClose` is only representable on the "drawer" variant. This makes the
// previously-possible invalid state (a panel passed a close handler that
// nothing ever calls) impossible to construct.
type IProps =
  | (ICommonProps & { variant: "drawer"; onClose: () => void })
  | (ICommonProps & { variant: "panel" });

type CartStep = "cart" | "checkout";

export const CartContent = (props: IProps) => {
  const {
    cart,
    total,
    variant,
    clear,
    updateQuantity,
    removeItem,
    makePay,
    transferDestinations,
    cierreId,
  } = props;
```

- [ ] **Step 2: Access `onClose` only through the narrowed `props`, not the destructured `variant`**

The destructured `variant` above is a plain `"panel" | "drawer"` string — checking it does not let TypeScript narrow `props.onClose`'s availability. The check must run on `props.variant` itself.

Replace:

```tsx
            {variant === "drawer" && (
              <IconButton onClick={onClose} aria-label="Cerrar">
                <Close color="error" />
              </IconButton>
            )}
```

with:

```tsx
            {props.variant === "drawer" && (
              <IconButton onClick={props.onClose} aria-label="Cerrar">
                <Close color="error" />
              </IconButton>
            )}
```

- [ ] **Step 3: Stop passing `onClose` to the panel-variant `CartContent` in `page.tsx`**

With the discriminated union, passing `onClose` alongside `variant="panel"` is now a type error (excess property on that branch of the union). Find the `CartContent` usage inside the `showCartPanel &&` block in `src/app/pos/page.tsx`. Replace:

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

with:

```tsx
            <CartContent
              cart={cart}
              total={total}
              clear={clearCart}
              updateQuantity={handleUpdateQuantity}
              removeItem={removeFromCart}
              makePay={handleMakePay}
              transferDestinations={transferDestinations}
              cierreId={periodo?.id ?? ""}
              variant="panel"
            />
```

Do **not** touch `src/components/cartDrawer/CartDrawer.tsx` — it already passes both `variant="drawer"` and `onClose`, which satisfies the union as-is.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If TypeScript complains about `onClose` not existing on `props` anywhere else in `cartContent.tsx`, you missed an access site — search the file for `onClose` to confirm the only remaining reference is the one in Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/cartDrawer/components/cartContent.tsx src/app/pos/page.tsx
git commit -m "$(cat <<'EOF'
refactor(pos): make CartContent's onClose impossible to pass to a panel

variant="panel" (the permanent sidebar) has no close button and never
calls onClose — page.tsx was passing a handler nothing invokes. The
discriminated union makes that invalid combination unrepresentable
instead of just unused.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract the footer (account pills + search bar) to `PosBottomBar`

**Files:**
- Create: `src/app/pos/components/PosBottomBar.tsx`
- Modify: `src/app/pos/page.tsx`

**Interfaces:**
- Produces: `PosBottomBar` component, props listed in Step 1.

- [ ] **Step 1: Create `PosBottomBar.tsx`**

This is a pure extraction of the current footer block from `page.tsx` (the `Box` with `sx={{ flexShrink: 0 }}` containing the account-pills `Stack` and the search `Box`) — same JSX, same behavior, just moved into its own file and driven by props instead of closures over `page.tsx`'s state.

Create `src/app/pos/components/PosBottomBar.tsx`:

```tsx
"use client";

import { RefObject } from "react";
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Grid2 as Grid,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SelectableTextField from "@/components/SelectableTextField";
import ProductProcessorData, {
  ProductProcessorDataRef,
} from "@/components/ProductProcessorData/ProductProcessorData";
import { IProcessedData } from "@/schemas/processedData";
import { ICart } from "@/store/cartStore";

interface PosBottomBarProps {
  carts: ICart[];
  activeCartId: string;
  onSelectCart: (id: string) => void;
  onCreateCart: () => void;
  onRemoveActiveCart: () => void;
  onRenameCart: (id: string, name: string) => void;
  editingCartId: string | null;
  onStartEditingCart: (id: string, name: string) => void;
  editingCartName: string;
  onEditingCartNameChange: (name: string) => void;
  onStopEditingCart: () => void;
  editCartInputRef: RefObject<HTMLInputElement>;
  searchAnchorRef: RefObject<HTMLDivElement>;
  searchInputRef: RefObject<HTMLInputElement>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchMouseDown: () => void;
  scannerRef: RefObject<ProductProcessorDataRef>;
  onProductScan: (code: string) => void;
  onCameraOpenChange: (open: boolean) => void;
  scannerError: string | null;
  onDismissScannerError: () => void;
}

export function PosBottomBar({
  carts,
  activeCartId,
  onSelectCart,
  onCreateCart,
  onRemoveActiveCart,
  onRenameCart,
  editingCartId,
  onStartEditingCart,
  editingCartName,
  onEditingCartNameChange,
  onStopEditingCart,
  editCartInputRef,
  searchAnchorRef,
  searchInputRef,
  searchQuery,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onSearchMouseDown,
  scannerRef,
  onProductScan,
  onCameraOpenChange,
  scannerError,
  onDismissScannerError,
}: PosBottomBarProps) {
  return (
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
        {/* Píldoras de carritos */}
        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
          {carts.map((c) => (
            <Box key={c.id} sx={{ display: "flex", alignItems: "center" }}>
              {editingCartId === c.id ? (
                <SelectableTextField
                  size="small"
                  value={editingCartName}
                  autoFocus
                  ref={editCartInputRef}
                  onChange={(e) => onEditingCartNameChange(e.target.value)}
                  onBlur={onStopEditingCart}
                  onKeyDown={(e) => {
                    const key = e.key;
                    // Evitar interferencia de IME y de manejadores globales
                    const composing = e?.nativeEvent?.isComposing ?? false;
                    if (
                      !composing &&
                      (key === "Enter" || key === "NumpadEnter")
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      onRenameCart(c.id, (editingCartName || "").trim() || c.name);
                      onStopEditingCart();
                    } else if (key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      onStopEditingCart();
                    }
                  }}
                  InputProps={{
                    inputProps: {
                      inputMode: "text",
                      autoComplete: "off",
                      autoCorrect: "off",
                      autoCapitalize: "off",
                      spellCheck: false,
                    },
                  }}
                  sx={{ minWidth: 140 }}
                />
              ) : (
                <Chip
                  tabIndex={-1}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box
                        sx={{
                          maxWidth: 140,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name}
                      </Box>
                      <IconButton
                        aria-label="Editar nombre"
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onStartEditingCart(c.id, c.name);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                        }}
                        onTouchMove={(e) => {
                          e.stopPropagation();
                        }}
                        edge="end"
                        sx={{ p: 0.25 }}
                      >
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                  }
                  color={c.id === activeCartId ? "primary" : "default"}
                  variant={c.id === activeCartId ? "filled" : "outlined"}
                  onClick={() => onSelectCart(c.id)}
                  onDelete={() => {
                    if (carts.length <= 1) return; // mantener al menos uno
                    if (c.id !== activeCartId) {
                      onSelectCart(c.id);
                    }
                    onRemoveActiveCart();
                  }}
                  sx={{
                    cursor: "pointer",
                    "& .MuiChip-label": {
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
              )}
            </Box>
          ))}
          <Chip
            label="Nueva cuenta"
            variant="outlined"
            onClick={onCreateCart}
            sx={{ cursor: "pointer" }}
          />
        </Stack>
      </Box>

      {/* Buscador */}
      <Box
        ref={searchAnchorRef}
        data-tour="pos-search"
        sx={{
          p: 1,
          background: (theme) =>
            `linear-gradient(to top, ${theme.palette.background.paper} 0%, ${theme.palette.background.paper}e6 100%)`,
          backdropFilter: "blur(10px)",
          boxSizing: "border-box",
        }}
      >
        <Stack direction="row" spacing={1}>
          <SelectableTextField
            ref={searchInputRef}
            fullWidth
            variant="outlined"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            onMouseDown={onSearchMouseDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange("")}>
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                bgcolor: "background.paper",
                borderRadius: "12px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                },
              },
            }}
          />
          <Grid size={{ xs: 7, sm: 10 }} data-tour="pos-toolbar-scanner">
            <ProductProcessorData
              ref={scannerRef}
              onProcessedData={(data: IProcessedData) => {
                if (data?.code) onProductScan(data.code);
              }}
              enableHardwareScanner={false}
              onCameraOpenChange={onCameraOpenChange}
            />
            {scannerError && (
              <Alert
                severity="warning"
                onClose={onDismissScannerError}
                sx={{ mt: 1 }}
              >
                {scannerError}
              </Alert>
            )}
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
}
```

Note: the search bar's `background` changed from `alpha(theme.palette.background.paper, 1/0.9)` to an inline template using the theme callback form of `sx` — this avoids importing `alpha` into a component that otherwise wouldn't need it. `e6` is `~90%` opacity in hex alpha, equivalent to the old `0.9`.

- [ ] **Step 2: Replace the footer block in `page.tsx` with `<PosBottomBar />`**

Replace the entire footer block:

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
            {/* Píldoras de carritos */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ overflowX: "auto", pb: 0.5 }}
            >
              {carts.map((c) => (
                <Box key={c.id} sx={{ display: "flex", alignItems: "center" }}>
                  {editingCartId === c.id ? (
                    <SelectableTextField
                      size="small"
                      value={editingCartName}
                      autoFocus
                      ref={editCartInputRef}
                      onChange={(e) => setEditingCartName(e.target.value)}
                      onBlur={() => {
                        if (editingCartId) {
                          const newName =
                            (editingCartName || "").trim() || c.name;
                          renameCart(editingCartId, newName);
                        }
                        setEditingCartId(null);
                      }}
                      onKeyDown={(e) => {
                        const key = e.key;
                        // Evitar interferencia de IME y de manejadores globales
                        const composing = e?.nativeEvent?.isComposing ?? false;
                        if (
                          !composing &&
                          (key === "Enter" || key === "NumpadEnter")
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (editingCartId) {
                            const newName =
                              (editingCartName || "").trim() || c.name;
                            renameCart(editingCartId, newName);
                          }
                          setEditingCartId(null);
                        } else if (key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingCartId(null);
                        }
                      }}
                      InputProps={{
                        inputProps: {
                          inputMode: "text",
                          autoComplete: "off",
                          autoCorrect: "off",
                          autoCapitalize: "off",
                          spellCheck: false,
                        },
                      }}
                      sx={{ minWidth: 140 }}
                    />
                  ) : (
                    <Chip
                      tabIndex={-1}
                      label={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              maxWidth: 140,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name}
                          </Box>
                          <IconButton
                            aria-label="Editar nombre"
                            size="small"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingCartId(c.id);
                              setEditingCartName(c.name);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchMove={(e) => {
                              e.stopPropagation();
                            }}
                            edge="end"
                            sx={{ p: 0.25 }}
                          >
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      }
                      color={c.id === activeCartId ? "primary" : "default"}
                      variant={c.id === activeCartId ? "filled" : "outlined"}
                      onClick={() => setActiveCart(c.id)}
                      onDelete={() => {
                        if (carts.length <= 1) return; // mantener al menos uno
                        if (c.id !== activeCartId) {
                          setActiveCart(c.id);
                        }
                        removeActiveCart();
                      }}
                      sx={{
                        cursor: "pointer",
                        "& .MuiChip-label": {
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      }}
                    />
                  )}
                </Box>
              ))}
              <Chip
                label="Nueva cuenta"
                variant="outlined"
                onClick={() => createCart()}
                sx={{ cursor: "pointer" }}
              />
            </Stack>
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
            <Stack direction="row" spacing={1}>
              <SelectableTextField
                ref={searchInputRef}
                fullWidth
                variant="outlined"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                // onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
                onFocus={() => handleSearchFocus()}
                onBlur={() => handleSearchBlur()}
                onMouseDown={() => handleSearchMouseDown()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchQuery("");
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: "background.paper",
                    borderRadius: "12px",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  },
                }}
              />
              <Grid size={{ xs: 7, sm: 10 }} data-tour="pos-toolbar-scanner">
                <ProductProcessorData
                  ref={scannerRef}
                  onProcessedData={(data: IProcessedData) => {
                    if (data?.code) handleProductScan(data.code);
                  }}
                  enableHardwareScanner={false}
                  onCameraOpenChange={setCameraScannerOpen}
                />
                {scannerError && (
                  <Alert
                    severity="warning"
                    onClose={() => setScannerError(null)}
                    sx={{ mt: 1 }}
                  >
                    {scannerError}
                  </Alert>
                )}
              </Grid>
            </Stack>
          </Box>
        </Box>
```

with:

```tsx
        <PosBottomBar
          carts={carts}
          activeCartId={activeCartId}
          onSelectCart={setActiveCart}
          onCreateCart={() => createCart()}
          onRemoveActiveCart={removeActiveCart}
          onRenameCart={renameCart}
          editingCartId={editingCartId}
          onStartEditingCart={(id, name) => {
            setEditingCartId(id);
            setEditingCartName(name);
          }}
          editingCartName={editingCartName}
          onEditingCartNameChange={setEditingCartName}
          onStopEditingCart={() => {
            if (editingCartId) {
              const cart = carts.find((c) => c.id === editingCartId);
              const newName = (editingCartName || "").trim() || cart?.name || "";
              renameCart(editingCartId, newName);
            }
            setEditingCartId(null);
          }}
          editCartInputRef={editCartInputRef}
          searchAnchorRef={searchAnchorRef}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onSearchFocus={handleSearchFocus}
          onSearchBlur={handleSearchBlur}
          onSearchMouseDown={handleSearchMouseDown}
          scannerRef={scannerRef}
          onProductScan={handleProductScan}
          onCameraOpenChange={setCameraScannerOpen}
          scannerError={scannerError}
          onDismissScannerError={() => setScannerError(null)}
        />
```

Note: `onStopEditingCart` centralizes the rename-and-clear logic that used to be duplicated between the `onBlur` and the `Enter`-key handler inside the inline `SelectableTextField` — both call sites in the old code did the exact same three lines. `PosBottomBar` itself no longer needs `renameCart`/`editingCartId`/`editingCartName` for that duplication; it just calls `onStopEditingCart` from both its `onBlur` and its `Enter` handler (already written that way in Step 1), and `onRenameCart`/`carts` from its own props are only used inside `page.tsx`'s single `onStopEditingCart` closure now — wait: re-check Step 1's `PosBottomBar` code above — it still calls `onRenameCart(c.id, ...)` directly from its `Enter`-key handler, separately from `onStopEditingCart`. Keep both call sites as written in Step 1 (they mirror the original's two call sites exactly); do not further deduplicate beyond what Step 1 already shows — that would be a design change beyond this task's scope.

- [ ] **Step 3: Remove now-unused imports from `page.tsx`**

`InputAdornment`, `Grid2 as Grid`, `Chip`, `Stack`, `SearchIcon`, `CloseIcon`, `EditIcon`, `SelectableTextField`, `ProductProcessorData` (the default import) are no longer used in `page.tsx` — they moved into `PosBottomBar.tsx`. `ProductProcessorDataRef` (the type import) **stays** — `scannerRef`'s type annotation in `page.tsx` still needs it. Run `npx tsc --noEmit` and remove exactly the imports TypeScript/ESLint flags as unused; do not guess which ones by inspection alone, since some (e.g. `Chip`, `Stack`) might still be referenced elsewhere in `page.tsx` at this point in the plan (they are not, as of this task, but verify).

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/pos/components/PosBottomBar.tsx src/app/pos/page.tsx
git commit -m "$(cat <<'EOF'
refactor(pos): extract the account-pills/search footer to PosBottomBar

Pure extraction — same JSX, same behavior — out of ~200 lines inline
in page.tsx, per the project's convention against inline UI blocks.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `CategoryPillsBar` component

**Files:**
- Create: `src/app/pos/components/CategoryPillsBar.tsx`

**Interfaces:**
- Produces: `CategoryPillsBar({ categories: ICategory[]; selectedCategoryId: string | null; onSelectCategory: (id: string | null) => void })`. `selectedCategoryId === null` means "Todas".

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Box, Chip, Stack, useTheme } from "@mui/material";
import { ICategory } from "@/schemas/categoria";

interface CategoryPillsBarProps {
  categories: ICategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryPillsBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPillsBarProps) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        flexShrink: 0,
        overflowX: "auto",
        px: 1,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Chip
        label="Todas"
        variant={selectedCategoryId === null ? "filled" : "outlined"}
        color={selectedCategoryId === null ? "primary" : "default"}
        onClick={() => onSelectCategory(null)}
        sx={{ height: 36, cursor: "pointer", flexShrink: 0 }}
      />
      {categories.map((category, index) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <Chip
            key={category.id}
            {...(index === 0 ? { "data-tour": "pos-category-first" } : {})}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {!isSelected && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: category.color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box
                  sx={{
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {category.nombre}
                </Box>
              </Box>
            }
            variant={isSelected ? "filled" : "outlined"}
            onClick={() => onSelectCategory(isSelected ? null : category.id)}
            sx={{
              height: 36,
              cursor: "pointer",
              flexShrink: 0,
              ...(isSelected && {
                bgcolor: category.color,
                color: theme.palette.getContrastText(category.color),
                borderColor: category.color,
                "&:hover": { bgcolor: category.color, opacity: 0.9 },
              }),
            }}
          />
        );
      })}
    </Stack>
  );
}
```

Tapping the already-selected category pill clears the filter back to "Todas" (`onSelectCategory(isSelected ? null : category.id)`) — same toggle affordance "Todas" itself has implicitly (it's just `null`).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (`page.tsx` will still show errors from not yet consuming this component — that's fine, later tasks wire it in.)

- [ ] **Step 3: Commit**

```bash
git add src/app/pos/components/CategoryPillsBar.tsx
git commit -m "$(cat <<'EOF'
feat(pos): add CategoryPillsBar component

A fixed row of category chips replacing the category-tile grid.
"Todas" (null) is always first; each category chip carries its own
color as an accent dot when unselected and as its fill when selected.
Not yet wired into page.tsx.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `PosProductGrid` component

**Files:**
- Create: `src/app/pos/components/PosProductGrid.tsx`

**Interfaces:**
- Produces: `PosProductGrid({ products: IProductoTiendaV2[]; allProductosTienda: IProductoTiendaV2[]; emptyMessage: string })`.

- [ ] **Step 1: Create the component**

Same grid markup `ProductModal.tsx` used internally (`Grid` from `@mui/material`, `item xs={12} sm={6} md={4} lg={3}`), extracted so it can render the always-visible, filtered product listing instead of a per-category modal body.

```tsx
"use client";

import { Box, Grid, Typography } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { PosProductItemLayout } from "./PosProductItemLayout";

interface PosProductGridProps {
  products: IProductoTiendaV2[];
  allProductosTienda: IProductoTiendaV2[];
  emptyMessage: string;
}

export function PosProductGrid({
  products,
  allProductosTienda,
  emptyMessage,
}: PosProductGridProps) {
  if (products.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ p: 1 }}>
      {products.map((productoTienda) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={productoTienda.id}>
          <PosProductItemLayout
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
            showDescription
            sx={{ height: "100%" }}
          />
        </Grid>
      ))}
    </Grid>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/pos/components/PosProductGrid.tsx
git commit -m "$(cat <<'EOF'
feat(pos): add PosProductGrid component

Renders a filtered product listing (same PosProductItemLayout cards
ProductModal used) with an empty-state message. Not yet wired into
page.tsx; ProductModal.tsx is still in use until the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `page.tsx` to the pills + grid, remove `ProductModal` and the search popup

**Files:**
- Modify: `src/app/pos/page.tsx`
- Delete: `src/app/pos/components/ProductModal.tsx`
- Modify: `src/features/onboarding/tours/primerosPasos.ts`

**Interfaces:**
- Consumes: `CategoryPillsBar` (Task 4), `PosProductGrid` (Task 5).

- [ ] **Step 1: Remove the `ProductModal` import, add the two new ones**

Replace:

```tsx
import { ProductModal } from "./components/ProductModal";
```

with:

```tsx
import { CategoryPillsBar } from "./components/CategoryPillsBar";
import { PosProductGrid } from "./components/PosProductGrid";
```

- [ ] **Step 2: Replace `selectedCategory`/`showProducts` state with `selectedCategoryId`**

Replace:

```tsx
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [productosTienda, setProductosTienda] = useState<IProductoTiendaV2[]>(
    [],
  );
  const [showProducts, setShowProducts] = useState(false);
```

with:

```tsx
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [productosTienda, setProductosTienda] = useState<IProductoTiendaV2[]>(
    [],
  );
```

- [ ] **Step 3: Remove the search-popup state and its layout-measuring machinery**

Replace:

```tsx
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const posScrollRef = useRef<HTMLDivElement>(null);
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
      right: Math.max(8, document.documentElement.clientWidth - rect.right + 8),
    });
  }, []);
  const [selectedProduct, setSelectedProduct] =
```

with:

```tsx
  const [searchQuery, setSearchQuery] = useState("");
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const posScrollRef = useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] =
```

- [ ] **Step 4: Remove the two `showSearchResults`/`intentToSearch` cleanup effects' now-dead line**

Replace:

```tsx
  useEffect(() => {
    if (openCart && !showCartPanel) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
      setShowSearchResults(false);
    }
  }, [openCart, showCartPanel]);

  useEffect(() => {
    if (showSyncView || resumenDiaOpen) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
      setShowSearchResults(false);
    }
  }, [showSyncView, resumenDiaOpen]);
```

with:

```tsx
  useEffect(() => {
    if (openCart && !showCartPanel) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
    }
  }, [openCart, showCartPanel]);

  useEffect(() => {
    if (showSyncView || resumenDiaOpen) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
    }
  }, [showSyncView, resumenDiaOpen]);
```

- [ ] **Step 5: `pos-category-first` no longer needs manual scroll-into-view — it's always visible now**

Replace:

```tsx
    const needsPosScroll =
      isPosTopToolbarTourTarget(target) ||
      target.includes("pos-category-first");
```

with:

```tsx
    // pos-category-first now lives in the fixed pills row above the
    // scrollable grid — always visible, no scroll needed to reveal it.
    const needsPosScroll = isPosTopToolbarTourTarget(target);
```

- [ ] **Step 6: Remove `handleOpenProducts`, simplify `handleProductScan`**

Replace:

```tsx
  const handleOpenProducts = (category: ICategory) => {
    setSelectedCategory(category);
    setShowProducts(true);
  };
  const handleCartIcon = () => {
```

with:

```tsx
  const handleCartIcon = () => {
```

Replace:

```tsx
  function handleProductScan(code: string) {
    const product = findProductByCode(code);
    if (product) {
      setSelectedProduct(product);
      setShowProducts(false); // Cierra modal de categorías si está abierto
      // El modal de cantidad se abre automáticamente por el estado selectedProduct
      setScannerError(null);
      setProductOrigin("camera"); // Marcar como escaneo de cámara
```

with:

```tsx
  function handleProductScan(code: string) {
    const product = findProductByCode(code);
    if (product) {
      setSelectedProduct(product);
      // El modal de cantidad se abre automáticamente por el estado selectedProduct
      setScannerError(null);
      setProductOrigin("camera"); // Marcar como escaneo de cámara
```

- [ ] **Step 7: Remove the sale-completion reset of `showSearchResults`**

Replace:

```tsx
        removeActiveCart();
        setOpenCart(false);
        setShowProducts(false);
        setSelectedProduct(null);
        setShowSearchResults(false);
        setSearchQuery("");
```

with:

```tsx
        removeActiveCart();
        setOpenCart(false);
        setSelectedProduct(null);
        setSearchQuery("");
```

- [ ] **Step 8: Replace the search-popup's `searchResults` with a combined `filteredProducts` + `emptyMessage`, simplify `handleSearch`/`handleSearchFocus`, remove `handleSearchBlur`'s popup-closing role**

Replace:

```tsx
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim() !== "");
  };

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return productosTienda
      .filter((p) =>
        normalizeSearch(p.producto.nombre).includes(
          normalizeSearch(searchQuery),
        ),
      )
      .slice(0, 10);
  }, [productosTienda, searchQuery]);
```

with:

```tsx
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Category and search combine as AND: with a category marked, the
  // search box filters within it rather than across the whole catalog.
  const filteredProducts = useMemo(() => {
    return productosTienda
      .filter(
        (p) =>
          selectedCategoryId === null ||
          p.producto.categoria.id === selectedCategoryId,
      )
      .filter((p) =>
        normalizeSearch(p.producto.nombre).includes(
          normalizeSearch(searchQuery),
        ),
      );
  }, [productosTienda, selectedCategoryId, searchQuery]);

  const emptyMessage =
    searchQuery.trim() !== ""
      ? `No se encontraron productos para "${searchQuery}"`
      : "No hay productos en esta categoría";
```

Replace:

```tsx
  const handleSearchFocus = () => {
    if (searchQuery.length > 0) {
      setShowSearchResults(true);
    }
    setIntentToSearch(true);
  };
```

with:

```tsx
  const handleSearchFocus = () => {
    setIntentToSearch(true);
  };
```

Replace:

```tsx
  const handleSearchBlur = () => {
    // Delay para permitir que los clicks en los resultados funcionen.
    // También se dispara desde el propio panel de resultados (ver su
    // onBlur) para reevaluar cuando el foco se mueve DENTRO del panel
    // (ej. edición inline de cantidad), que sí debe poder recibir foco
    // normalmente.
    setTimeout(() => {
      if (searchResultsRef.current?.contains(document.activeElement)) {
        return;
      }
      setIntentToSearch(false);
      setShowSearchResults(false);
    }, 150);
  };
```

with:

```tsx
  const handleSearchBlur = () => {
    setIntentToSearch(false);
  };
```

(The `searchResultsRef` dance and its 150ms delay existed only to keep the popup open while a click landed inside it — with no popup, `intentToSearch` can clear immediately.)

- [ ] **Step 9: Remove the `useLayoutEffect` that kept the popup's position in sync**

Delete entirely:

```tsx
  useLayoutEffect(() => {
    if (!showSearchResults || searchQuery.trim() === "") return;

    updateSearchPanelLayout();
    window.addEventListener("resize", updateSearchPanelLayout);
    window.addEventListener("scroll", updateSearchPanelLayout, true);
    const ro = new ResizeObserver(updateSearchPanelLayout);
    const el = searchAnchorRef.current;
    if (el) ro.observe(el);

    return () => {
      window.removeEventListener("resize", updateSearchPanelLayout);
      window.removeEventListener("scroll", updateSearchPanelLayout, true);
      ro.disconnect();
    };
  }, [showSearchResults, searchQuery, updateSearchPanelLayout]);

```
(Leave a single blank line where this block was, matching the surrounding spacing.)

- [ ] **Step 10: Replace the category-tile grid + `ProductModal` with `CategoryPillsBar` + `PosProductGrid`**

This is the main structural change. The current content region — the non-scrolling wrapper `Box` that exists solely to give `ProductModal`'s overlay a stable containing block, wrapping a scrolling `Box` with the tile grid, followed by the conditional `ProductModal` — collapses to a single scrollable `Box` (there's no more overlay needing a non-scrolling containing block) preceded by `CategoryPillsBar` as a fixed sibling.

Replace:

```tsx
        {/* Contenido principal: wrapper de tamaño fijo (no scrollea) que
            actúa como "ventana" del viewport visible — el contenido de
            adentro sí scrollea, en su propio Box. Esto es lo que le da al
            ProductModal (inPanel) un containing block que NO se desplaza
            con el scroll, para que su overlay quede siempre anclado al
            área visible en vez de al origen del contenido scrolleado. */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box ref={posScrollRef} sx={{ height: "100%", overflow: "auto" }}>
            <Box
              sx={{
                display: "grid",
                // The cart panel is always visible from sm+ now, so these are
                // the column counts that used to only apply when pinned.
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
                gap: { xs: 0.5, sm: 1.5, md: 2 },
                alignContent: "start",
                p: 1,
                width: "100%",
                maxWidth: "1400px",
                position: "relative",
                zIndex: 1,
              }}
            >
              {categories.map((category, categoryIndex) => (
                <Box
                  key={category.id}
                  {...(categoryIndex === 0
                    ? { "data-tour": "pos-category-first" }
                    : {})}
                  onClick={() => handleOpenProducts(category)}
                  sx={{
                    position: "relative",
                    aspectRatio: "1/1", // Mantiene proporción cuadrada
                    borderRadius: { xs: "12px", sm: "16px" },
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: category.color,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:active": {
                      transform: "scale(0.98)",
                    },
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 4,
                    },
                  }}
                >
                  {/* Scrim inferior: solo para legibilidad del texto sobre el color de la categoría */}
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      p: { xs: 1.5, sm: 2 },
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        color: "white",
                        fontWeight: 600,
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
                        textAlign: "center",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {category.nombre}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
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

with:

```tsx
        {/* Fila fija de píldoras de categorías */}
        <CategoryPillsBar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />

        {/* Contenido principal: grilla de productos filtrada, scrolleable */}
        <Box ref={posScrollRef} sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          <PosProductGrid
            products={filteredProducts}
            allProductosTienda={productosTienda}
            emptyMessage={emptyMessage}
          />
        </Box>
```

- [ ] **Step 11: Remove the search-results `Portal` block**

Delete entirely:

```tsx
        {showSearchResults && searchQuery.trim() !== "" && (
          <Portal>
            <Box
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
            >
              <MuiPaper
                ref={searchResultsRef}
                elevation={3}
                onMouseDown={(e) => {
                  // Evita que el buscador pierda foco (y el panel se
                  // cierre) al tocar cards/botones dentro del panel — pero
                  // sin bloquear el foco cuando el toque es sobre un input
                  // real (ej. edición inline de cantidad), que sí debe
                  // poder recibir foco normalmente.
                  const target = e.target as HTMLElement;
                  if (target.closest("input, textarea")) return;
                  e.preventDefault();
                }}
                onBlur={handleSearchBlur}
                sx={{
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  maxHeight: "inherit",
                  overflowX: "hidden",
                  overflowY: "auto",
                  borderRadius: "12px",
                  bgcolor: alpha(theme.palette.background.paper, 0.98),
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {searchResults.length > 0 ? (
                  <Box
                    sx={{
                      p: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    {searchResults.map((product) => (
                      <PosProductItemLayout
                        key={product.id}
                        productoTienda={product}
                        allProductosTienda={productosTienda}
                        highlightName={normalizeSearch(
                          product.producto.nombre,
                        ).startsWith(normalizeSearch(searchQuery))}
                      />
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography color="text.secondary" variant="body2">
                      No se encontraron productos para &quot;{searchQuery}
                      &quot;
                    </Typography>
                  </Box>
                )}
              </MuiPaper>
            </Box>
          </Portal>
        )}

```

- [ ] **Step 12: Remove now-unused imports**

At minimum, `Portal`, `Paper as MuiPaper`, `PosProductItemLayout` (moved into `PosProductGrid`), `ICategory` (only if nothing else in `page.tsx` still names the type — check: `categories` state is still `ICategory[]`, so this import **stays**), `alpha` (was used by the removed search bar background — Task 3 already removed that use — and the removed search-results panel above; check for any remaining use before removing), `useCallback` (only used by the removed `updateSearchPanelLayout` — check for other uses before removing), `useLayoutEffect` (only used by the removed effect — check before removing). Run `npx tsc --noEmit`/`npm run lint` and remove exactly what's flagged; do not remove anything still referenced elsewhere in the file.

- [ ] **Step 13: Delete `ProductModal.tsx`**

```bash
git rm src/app/pos/components/ProductModal.tsx
```

Confirm nothing else imports it first: `grep -rn "components/ProductModal" src/` should return nothing once this file is gone.

- [ ] **Step 14: Update the onboarding tour copy for `pos-category-first`**

In `src/features/onboarding/tours/primerosPasos.ts`, find the step targeting `pos-category-first`. Replace:

```tsx
    target: '[data-tour="pos-category-first"]',
    title: "Categorías de productos",
    content:
      "Cada tarjeta es una categoría (como esta). Al tocarla verás sus productos para añadirlos al carrito sin usar el buscador.",
```

with:

```tsx
    target: '[data-tour="pos-category-first"]',
    title: "Categorías de productos",
    content:
      "Cada píldora es una categoría (como esta). Tócala para ver solo sus productos; toca «Todas» para quitar el filtro.",
```

- [ ] **Step 15: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: fully clean, project-wide.

- [ ] **Step 16: Confirm no stray references remain**

Run: `grep -rn "showSearchResults\|searchResultsRef\|searchPanelLayout\|updateSearchPanelLayout\|selectedCategory\b\|showProducts\|handleOpenProducts\|ProductModal" src/app/pos/page.tsx`
Expected: no matches. (`selectedCategoryId` will still match the `selectedCategory\b` pattern's negation correctly since `\b` requires a word boundary right after "selectedCategory" — `selectedCategoryId` has no boundary there, so it won't false-positive; if your grep flavor doesn't support `\b`, just eyeball the output for the literal standalone name.)

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(pos): category pills + always-visible filtered product grid

Replaces the category-tile modal (ProductModal) and the floating
search-results popup with a single product grid, always visible,
filtered by (category pill selected) AND (search text) — both
combine. "Todas" is the default filter. Removes ~150 lines of
popup-positioning machinery (ResizeObserver, scroll/resize listeners,
Portal) that existed only to keep a floating panel glued to the
search box.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, zero errors/warnings introduced by this plan.

- [ ] **Step 2: Confirm the old popup/modal machinery is fully gone**

Run: `grep -rln "ProductModal\|showSearchResults\|searchPanelLayout" src/`
Expected: no matches anywhere in `src/`.

- [ ] **Step 3: Manual QA in the browser**

Per `CLAUDE.md`, this is verified manually. Start the dev server and open `/pos`:

1. **Category pills:** "Todas" is marked by default; the product grid shows the full catalog immediately (no empty home screen). Tap a category pill — grid narrows to that category, pill fills with its own color. Tap it again (or tap "Todas") — filter clears.
2. **Search + category combine:** with a category marked, type a search term that matches products only in a *different* category — grid should show zero results (not fall back to searching everything). Clear the category back to "Todas" with the same search text still typed — matching products from any category should now appear.
3. **No modal, no popup:** tapping a category must NOT open any modal/overlay; typing in the search box must NOT show any floating panel — results only ever appear in the persistent grid below the pills.
4. **Empty states:** search for a nonsense string — "No se encontraron productos para «…»". Pick a category with zero matching products (if one exists in test data) — "No hay productos en esta categoría".
5. **Cart panel width:** resize the window across 700px — panel should appear/disappear exactly at that width now (not 600px), and the border between the two panels should be visible at every width where the panel shows.
6. **Cart panel close button:** confirm there is no close (X) button in the cart panel header on desktop/tablet (only "Vaciar carrito"); confirm mobile's `Drawer` still has its close button.
7. **Onboarding tour** (if easy to trigger): the `pos-category-first` step should highlight the first category pill (not "Todas") with the updated copy.
8. Check the browser console for errors during all of the above.

- [ ] **Step 4: Report results**

Summarize which Step 3 checks passed, and any that didn't, per `superpowers:verification-before-completion` — don't claim the feature works without having actually looked at it.
