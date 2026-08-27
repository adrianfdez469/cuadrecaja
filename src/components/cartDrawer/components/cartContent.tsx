"use client";

import { useCallback, useEffect, useState } from "react";
import { Close } from "@mui/icons-material";
import { Box, IconButton, Fade } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { useCartStore } from "@/store/cartStore";
import { useCartTotals } from "@/store/useCartTotals";
import { useCartLineActions } from "@/store/useCartLineActions";
import { useCartTotal } from "@/hooks/useCartTotal";
import { useDiscountRulesStore } from "@/store/discountRulesStore";
import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";
import { CartItemCard } from "@/components/cartDrawer/components/CartItemCard";
import { CartSummaryFooter } from "@/components/cartDrawer/components/CartSummaryFooter";
import { CheckoutView } from "@/app/pos/components/checkout/CheckoutView";
import { SaleDoneView } from "@/app/pos/components/checkout/SaleDoneView";
import type { SaleReceipt } from "@/app/pos/components/checkout/saleReceipt";
import { CartAccountTabs } from "@/app/pos/components/CartAccountTabs";
import { PosListHeading } from "@/app/pos/components/PosListHeading";
import { Frozen } from "@/components/Frozen";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface ICommonProps {
  clear?: () => void;
  updateQuantity?: (id: string, quantity: number) => void;
  removeItem?: (id: string) => void;
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
  /**
   * Drives the step from outside. Passing it makes this component
   * controlled — the pinned desktop panel does, because tapping the dimmed
   * product area has to bring the cart back. Leave it out and the step is
   * kept internally, which is all the mobile drawer needs.
   */
  step?: CartStep;
  /** Notifies every step change, controlled or not. */
  onStepChange?: (step: CartStep) => void;
  /**
   * An account name is being typed in the tabs above the basket. The POS page
   * keeps the hardware scanner listening, and every keystroke would otherwise
   * arrive as a scanned barcode.
   */
  onRenamingCart?: (renaming: boolean) => void;
  /** Reprints the last sale's ticket. Absent where printing is not available. */
  onPrintLastSale?: () => void;
}

// A "panel" cart has no way to close — it's a permanent sidebar — so
// `onClose` is only representable on the "drawer" variant. This makes the
// previously-possible invalid state (a panel passed a close handler that
// nothing ever calls) impossible to construct.
type IProps =
  | (ICommonProps & { variant: "drawer"; onClose: () => void })
  | (ICommonProps & { variant: "panel" });

export type CartStep = "cart" | "checkout" | "done";

// «En la venta · 5 artículos», 12/14/8 as the redesign pads it inside the
// panel; the lines under it carry their own 14px.
const CART_LIST_HEADER_SX = { px: 1.75, pt: 1.5, pb: 1 } as const;

// Hoisted, and a function so the tints resolve against the active scheme
// instead of being three hardcoded blacks: on a dark ground a black-on-black
// scrollbar is invisible. This list repaints on every `+` and `-`.
const CART_SCROLLBAR_SX = (theme: Theme) => ({
  "&::-webkit-scrollbar": { width: "6px" },
  "&::-webkit-scrollbar-track": {
    background: alpha(theme.palette.text.primary, 0.05),
  },
  "&::-webkit-scrollbar-thumb": {
    background: alpha(theme.palette.text.primary, 0.2),
    borderRadius: "3px",
    "&:hover": { background: alpha(theme.palette.text.primary, 0.3) },
  },
});

export const CartContent = (props: IProps) => {
  const {
    variant,
    clear,
    updateQuantity,
    removeItem,
    makePay,
    transferDestinations,
    cierreId,
    step: controlledStep,
    onStepChange,
    onRenamingCart,
    onPrintLastSale,
  } = props;
  // Read here instead of taken as props: the POS page used to hold this
  // subscription and pass it down, which meant every cart mutation re-rendered
  // the whole 1700-line view — product grid included — just to update the
  // cart panel.
  const cart = useCartStore((state) => state.items);
  const total = useCartTotal();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();

  const { user, monedaBase } = useAppContext();
  const tiendaId = user?.localActual?.id ?? "";

  const [uncontrolledStep, setUncontrolledStep] = useState<CartStep>("cart");
  const step = controlledStep ?? uncontrolledStep;

  // Kept in sync even while controlled, so removing the `step` prop can never
  // leave the internal state stranded on a step the cart is no longer on.
  const goToStep = useCallback(
    (next: CartStep) => {
      setUncontrolledStep(next);
      onStepChange?.(next);
    },
    [onStepChange],
  );

  // No unmount reset here on purpose. This used to report back "cart" when
  // the drawer was destroyed, so a listener could not be left believing a
  // checkout was still in progress with nothing on screen to end it. But an
  // unmount cleanup also runs on React's development double-mount, which
  // fired the moment the drawer opened — and once the step is driven from
  // outside, that silently threw away a caller's request to open straight on
  // the checkout. Closing the drawer is the owner's own action, so the owner
  // resets the step there.

  // Payment lines belong to ONE basket. The checkout is remounted when the
  // sale is submitted or when the cashier switches to another cart/account,
  // because a pinned cart never unmounts on its own. Without this, lines
  // entered for cart A survive a switch to cart B and `missing`/`change` are
  // computed against B's total — the footer can show a plausible "Cambio" and
  // VENDER stays enabled, submitting mismatched cash/transfer figures.
  // The old fast path was safe only because it resynced the cash amount on
  // every total change; the `dirty` flag deliberately stops doing that.
  const activeCartId = useCartStore((state) => state.activeCartId);
  // The charge bar names the account it is about to charge. Selected as a
  // plain string so the selector can't churn identities on every render.
  const activeCartName = useCartStore(
    (state) => state.carts.find((c) => c.id === state.activeCartId)?.name,
  );
  const [saleCount, setSaleCount] = useState(0);
  const checkoutKey = `${activeCartId}:${saleCount}`;
  // What «Cobro registrado» shows. Kept here because the basket that produced
  // it is cleared the moment the sale is saved.
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  // ─── Discount ─────────────────────────────────────────────────────────────
  // Priced locally, synchronously, from rules loaded once with the catalog.
  // This used to POST to /api/discounts/preview on every change to the cart:
  // network traffic on the critical path of a sale, with no debounce and no
  // cancellation, so five taps on `+` meant five overlapping requests.
  //
  // The server recomputes discounts when the sale is confirmed, so it remains
  // the authority; what happens here is what the cashier sees while deciding.
  // Only the draft in the input is local: the codes actually in force belong
  // to the cart, so the charge bar outside this drawer reads the same total.
  const [promoCode, setPromoCode] = useState("");
  const rules = useDiscountRulesStore((state) => state.rules);
  const setActiveCartDiscountCodes = useCartStore(
    (state) => state.setActiveCartDiscountCodes,
  );
  const { discountTotal, finalTotal, applied, unitCount, discountCodes } =
    useCartTotals();

  // The draft must not outlive the account it was typed for. On desktop this
  // drawer stays mounted while accounts are switched, so a code left in the
  // box would sit there over a cart it no longer discounts — the same trap the
  // applied codes just stopped falling into, one layer up. Read imperatively:
  // the effect fires on the switch, not on every edit of the codes it reads.
  useEffect(() => {
    const codes =
      useCartStore.getState().carts.find((c) => c.id === activeCartId)
        ?.discountCodes ?? [];
    setPromoCode(codes[0] ?? "");
  }, [activeCartId]);

  // Applying a code is now just adding it to the set the memo above reads.
  // It still tells the cashier when a code matched nothing, which is the one
  // piece of feedback the old round-trip actually provided.
  const handleBackToCart = useCallback(() => goToStep("cart"), [goToStep]);

  const handleApplyPromoCode = useCallback(() => {
    const code = promoCode.trim();
    if (!code) {
      setActiveCartDiscountCodes([]);
      return;
    }
    setActiveCartDiscountCodes([code]);
    const matches = rules.some((rule) => {
      const ruleCode = (rule.conditions as { code?: unknown } | null)?.code;
      return (
        typeof ruleCode === "string" &&
        ruleCode.toLowerCase() === code.toLowerCase()
      );
    });
    if (!matches) {
      showMessage("El código de descuento no es válido", "warning");
    }
  }, [promoCode, rules, showMessage, setActiveCartDiscountCodes]);

  /**
   * Fired at the point a sale actually submits — never inferred from cart
   * contents, so it cannot false-positive when switching carts/accounts
   * while the cart is pinned and therefore never unmounts.
   */
  const handleSaleComplete = (saleReceipt: SaleReceipt) => {
    setReceipt(saleReceipt);
    goToStep("done");
    setPromoCode("");
    setActiveCartDiscountCodes([]);
    // Bumps `checkoutKey`, so the next sale starts from a clean checkout
    // rather than inheriting this one's payment lines.
    setSaleCount((count) => count + 1);
  };

  // The sale could not be saved after all: back to the basket, which the
  // page has already emptied, rather than a receipt for nothing.
  const handleSaleFailed = () => {
    setReceipt(null);
    goToStep("cart");
  };

  // «Nueva venta»: on a phone the drawer closes and the POS is right there;
  // on a desktop the panel simply goes back to the (new, empty) basket.
  const handleNewSale = () => {
    setReceipt(null);
    if (props.variant === "drawer") props.onClose();
    else goToStep("cart");
  };

  // Shared with the charge bar's own line list, which has to answer «−» and
  // «+» exactly the same way — including removing the line on the last unit.
  const onRemoveUnavailable = useCallback(
    () => showMessage("No puede elminar completamente el producto", "warning"),
    [showMessage],
  );
  const { decrease: decreaseQty, increase: increaseQty } = useCartLineActions({
    updateQuantity,
    removeItem,
    onRemoveUnavailable,
  });

  const handleClearCart = () => {
    if (clear && cart.length > 0) {
      confirmDialog(
        `¿Estás seguro de que deseas vaciar el carrito? Se eliminarán ${cart.length} producto${cart.length !== 1 ? "s" : ""}.`,
        () => clear(),
      );
    }
  };

  return (
    <Box
      sx={{
        // In "panel" the real width comes from the wrapping Box that
        // page.tsx renders around this component (single source of truth
        // for the panel's width) — this just fills it. "drawer" is only
        // ever mounted on mobile, so it fills the full viewport width.
        width: variant === "panel" ? "100%" : "100vw",
        // Drawn edge to edge: tabs, headings, rows and the charge bar each
        // carry their own side padding, as the redesign measures them against
        // the panel's border, and the bar takes the home-indicator edge itself.
        p: 0,
        pt: variant === "drawer" ? "env(safe-area-inset-top)" : 0,
        display: "flex",
        flexDirection: "column",
        height: variant === "panel" ? "100%" : "100dvh",
        maxHeight: variant === "panel" ? "100%" : "100dvh",
        boxSizing: "border-box",
        ...(variant === "panel" && { overflow: "hidden" }),
      }}
    >
      {step === "cart" && (
        <CartAccountTabs
          onRenamingChange={onRenamingCart}
          onClearCart={clear ? handleClearCart : undefined}
          canClearCart={cart.length > 0}
          endAdornment={
            props.variant === "drawer" ? (
              <IconButton onClick={props.onClose} aria-label="Cerrar">
                <Close />
              </IconButton>
            ) : undefined
          }
        />
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
              sx={CART_SCROLLBAR_SX}
            >
              {/* «En la venta · 5 artículos». The basket used to open with the
                  word "Venta" and a green chip carrying a bare number, which
                  never said how many of what. */}
              <PosListHeading sx={CART_LIST_HEADER_SX}>
                {`En la venta · ${unitCount} ${unitCount === 1 ? "artículo" : "artículos"}`}
              </PosListHeading>
              {cart.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onDecrease={decreaseQty}
                  onIncrease={increaseQty}
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
              cartName={activeCartName}
              unitCount={unitCount}
              onCodeChange={setPromoCode}
              onApply={handleApplyPromoCode}
              onCheckout={() => goToStep("checkout")}
            />
          </Box>
        </Fade>

        {/*
          Deliberately NOT unmountOnExit: stepping back to the cart to check
          the basket must not throw away a half-entered payment. `checkoutKey`
          is what forces a clean remount, and only when it should happen — a
          completed sale, or a switch to another cart.
        */}
        <Fade in={step === "checkout"} timeout={200}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              // The Fade only sets visibility:hidden once the exit transition
              // finishes, so without this the outgoing checkout stays
              // hit-testable above the cart for the whole 200ms.
              pointerEvents: step === "checkout" ? "auto" : "none",
            }}
          >
            {/* Frozen while the cashier is on the basket step. The checkout
                stays mounted (see the note above) but it is 800 lines with two
                hooks full of chained memos, and it was re-rendering on every
                `+` and `−` behind an invisible panel. It picks up the current
                basket the moment the checkout is opened. */}
            <Frozen active={step === "checkout"}>
              <CheckoutView
                key={checkoutKey}
                finalTotal={finalTotal}
                discountTotal={discountTotal}
                discountCodes={discountCodes}
                transferDestinations={transferDestinations}
                tiendaId={tiendaId}
                cierreId={cierreId}
                itemCount={cart.length}
                onBack={handleBackToCart}
                makePay={makePay}
                onSaleComplete={handleSaleComplete}
                onSaleFailed={handleSaleFailed}
              />
            </Frozen>
          </Box>
        </Fade>

        {/* The close of the sale, over everything else. Mounted only while
            it is shown: it has nothing to keep between sales. */}
        <Fade in={step === "done" && receipt !== null} timeout={200} unmountOnExit>
          <Box sx={{ position: "absolute", inset: 0, bgcolor: "background.paper" }}>
            {receipt && (
              <SaleDoneView
                receipt={receipt}
                onNewSale={handleNewSale}
                onPrint={onPrintLastSale}
              />
            )}
          </Box>
        </Fade>
      </Box>

      {ConfirmDialogComponent}
    </Box>
  );
};
