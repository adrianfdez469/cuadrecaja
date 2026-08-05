"use client";

import { useEffect, useState } from "react";
import { Close, Delete } from "@mui/icons-material";
import {
  Box,
  Typography,
  Button,
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
import { ICartItem, useCartStore } from "@/store/cartStore";
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

  // Payment lines belong to ONE basket. The checkout is remounted when the
  // sale is submitted or when the cashier switches to another cart/account,
  // because a pinned cart never unmounts on its own. Without this, lines
  // entered for cart A survive a switch to cart B and `missing`/`change` are
  // computed against B's total — the footer can show a plausible "Cambio" and
  // VENDER stays enabled, submitting mismatched cash/transfer figures.
  // The old fast path was safe only because it resynced the cash amount on
  // every total change; the `dirty` flag deliberately stops doing that.
  const activeCartId = useCartStore((state) => state.activeCartId);
  const [saleCount, setSaleCount] = useState(0);
  const checkoutKey = `${activeCartId}:${saleCount}`;

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
    // Bumps `checkoutKey`, so the next sale starts from a clean checkout
    // rather than inheriting this one's payment lines.
    setSaleCount((count) => count + 1);
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
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="h6">Venta</Typography>
                <Chip
                  icon={
                    <ShoppingCartIcon sx={{ fontSize: "1rem !important" }} />
                  }
                  label={cart.length}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 24, fontWeight: 700 }}
                />
              </Stack>
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
                "&::-webkit-scrollbar-track": {
                  background: "rgba(0,0,0,0.05)",
                },
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
            <CheckoutView
              key={checkoutKey}
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
