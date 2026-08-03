import { Close, Delete, Remove, Add } from "@mui/icons-material";
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
  Collapse,
  TextField,
} from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useEffect, useState } from "react";
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
import {
  QuickPayFields,
  type QuickPayValues,
} from "@/app/pos/components/QuickPayFields";
import { MultiCurrencyPaymentPanel } from "@/app/pos/components/MultiCurrencyPaymentPanel";

function ExpiryChip({ fechaVencimiento }: { fechaVencimiento: string }) {
  const ahora = new Date();
  const fecha = new Date(fechaVencimiento);
  const dias = Math.ceil(
    (fecha.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias <= 0) {
    return (
      <Tooltip title="Este producto está vencido">
        <Chip
          label="Vencido"
          color="error"
          size="small"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  if (dias <= 7) {
    return (
      <Tooltip title={`Vence en ${dias} día(s)`}>
        <Chip
          label={`Vence en ${dias}d`}
          color="error"
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  if (dias <= 30) {
    return (
      <Tooltip title={`Vence en ${dias} día(s)`}>
        <Chip
          label={`Vence en ${dias}d`}
          color="warning"
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  return null;
}

interface CartItemCardProps {
  item: ICartItem;
  onDecrease: (id: string) => void;
  onIncrease: (id: string) => void;
  onRemove?: (item: ICartItem) => void;
  canUpdateQuantity: boolean;
}

function CartItemCard({
  item,
  onDecrease,
  onIncrease,
  onRemove,
  canUpdateQuantity,
}: CartItemCardProps) {
  const theme = useTheme();
  // Use priceBase (monedaBase equivalent) for MultiCurrencyAmount display; fall back to raw price if not set
  const lineTotal = (item.priceBase ?? item.price) * item.quantity;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        mb: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Fila 1: nombre + eliminar */}
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        mb={1}
      >
        <Box flex={1} minWidth={0}>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.name}
          </Typography>
          {item.fechaVencimiento && (
            <Box mt={0.5}>
              <ExpiryChip fechaVencimiento={item.fechaVencimiento} />
            </Box>
          )}
        </Box>

        {onRemove && (
          <IconButton
            onClick={() => onRemove(item)}
            size="small"
            aria-label={`Eliminar ${item.name}`}
            sx={{
              flexShrink: 0,
              color: "error.main",
              mt: -0.25,
              "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.08) },
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Fila 2: precios en dos columnas */}
      <Box
        display="grid"
        gridTemplateColumns="1fr 1fr"
        gap={1}
        mb={1.25}
        sx={{
          borderTop: "1px dashed",
          borderColor: "divider",
          pt: 1,
        }}
      >
        <Box minWidth={0}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{
              mb: 0.25,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Unitario
          </Typography>
          <MultiCurrencyAmount
            amount={item.priceBase ?? item.price}
            variant="compact"
          />
        </Box>

        <Box minWidth={0}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            align="right"
            sx={{
              mb: 0.25,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Subtotal
          </Typography>
          <MultiCurrencyAmount
            amount={lineTotal}
            variant="compact"
            align="right"
            color="success.main"
          />
        </Box>
      </Box>

      {/* Fila 3: cantidad centrada a ancho completo */}
      {canUpdateQuantity && (
        <Box display="flex" justifyContent="center">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              width: "100%",
              maxWidth: 200,
              bgcolor: "action.hover",
              borderRadius: 2,
              px: 0.5,
              py: 0.25,
            }}
          >
            <IconButton
              size="small"
              onClick={() => onDecrease(item.id)}
              aria-label={`Reducir cantidad de ${item.name}`}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Remove />
            </IconButton>
            <Typography
              variant="body1"
              fontWeight={700}
              sx={{ minWidth: 32, textAlign: "center" }}
            >
              {item.quantity}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onIncrease(item.id)}
              aria-label={`Aumentar cantidad de ${item.name}`}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Add />
            </IconButton>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

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

  // ─── Fast-path payment fields ──────────────────────────────────────────────
  const initialQuickPay: QuickPayValues = {
    cash: 0,
    transferEnabled: false,
    transfer: 0,
    transferDestId: "",
  };
  const [quickPay, setQuickPay] = useState<QuickPayValues>(initialQuickPay);

  // ─── Drawer cash balance (for fast-path change validation) ─────────────────
  const [drawerBalance, setDrawerBalance] = useState<Record<string, number>>(
    {},
  );
  const fetchDrawerBalance = () => {
    if (!tiendaId || !cierreId) return;
    fetch(`/api/cierre/${tiendaId}/${cierreId}/cash-balance`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((bal: Record<string, number>) => setDrawerBalance(bal))
      .catch(() => setDrawerBalance({}));
  };
  useEffect(() => {
    fetchDrawerBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaId, cierreId]);

  // ─── Reset checkout state after a completed sale (pinned cart never unmounts;
  // triggered explicitly at the point a sale actually submits, never inferred
  // from cart contents so it can't false-positive on cart/account switching) ──
  const [saleResetKey, setSaleResetKey] = useState(0);
  const resetCheckoutState = () => {
    setPaymentMode("cart");
    setPromoCode("");
    setDiscountTotal(0);
    setApplied([]);
    setQuickPay(initialQuickPay);
    setSaleResetKey((k) => k + 1);
    fetchDrawerBalance();
  };

  // El efectivo ya viene siempre precargado con un monto correcto desde
  // QuickPayFields (igual que "Efectivo" en el panel de multimoneda), así
  // que no hace falta distinguir "tocado" de "sin tocar" — se compara
  // directo contra el total, igual que totalPagado/falta en
  // MultiCurrencyPaymentPanel.
  const totalPaidFast = quickPay.cash + quickPay.transfer;
  const fastFalta =
    Math.round(totalPaidFast * 100) < Math.round(finalTotal * 100);
  const fastCambio = Math.max(0, totalPaidFast - finalTotal);
  const fastVueltoAvailable = (drawerBalance[monedaBase] ?? 0) + quickPay.cash;
  const fastVueltoError =
    fastCambio > fastVueltoAvailable + 0.001
      ? `Disponible en caja: ${fastVueltoAvailable.toFixed(2)} ${monedaBase}`
      : null;
  const needsTransferDest =
    quickPay.transferEnabled &&
    quickPay.transfer > 0 &&
    !quickPay.transferDestId;
  const canSellFast =
    cart.length > 0 && !fastFalta && !needsTransferDest && !fastVueltoError;

  const handleFastSell = async () => {
    const pagosDetalle: IPagoLinea[] = [];
    if (quickPay.cash > 0) {
      pagosDetalle.push({
        tipo: "cash",
        moneda: monedaBase,
        monto: quickPay.cash,
        equivalenteBase: quickPay.cash,
      });
    }
    if (quickPay.transfer > 0) {
      pagosDetalle.push({
        tipo: "transfer",
        moneda: monedaBase,
        monto: quickPay.transfer,
        equivalenteBase: quickPay.transfer,
        transferDestinationId: quickPay.transferDestId || undefined,
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
      quickPay.cash,
      quickPay.transfer,
      quickPay.transferDestId || undefined,
      promoCode ? [promoCode] : [],
      multimoneda,
    );
    resetCheckoutState();
  };

  const handleRemoveItem = (item: ICartItem) => {
    if (removeItem) {
      removeItem(item.id);
    }
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
        () => {
          clear();
        },
      );
    }
  };

  const handlePinCart = () => {
    if (!isMobile) {
      setIsCartPinned(!isCartPinned);
    }
  };

  // Calcular ancho dinámico según el estado y pantalla
  const getContainerWidth = () => {
    if (isCartPinned) {
      // Cuando está pineado, usar 100% del contenedor padre que ya está limitado
      return "100%";
    }
    return 360; // Ancho estándar para drawer
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
          maxWidth: isMobile ? "100%" : isTablet ? "40vw" : "35vw",
          minWidth: 360,
          position: "sticky",
          top: 0,
          overflow: "hidden",
        }),
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={2}
      >
        <Box display={"flex"} flexDirection={"column"} flex={1}>
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
                  onClick={() => handlePinCart()}
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

        <Box display={"flex"} flexDirection={"row"} alignItems={"flex-start"}>
          {clear && (
            <Button
              startIcon={<Delete />}
              variant="contained"
              onClick={handleClearCart}
              disabled={cart.length === 0}
              size={isCartPinned && !isTablet ? "medium" : "small"}
              sx={{
                mr: 1,
                ...(isCartPinned &&
                  !isTablet && {
                    minWidth: "auto",
                    px: 2,
                  }),
              }}
            >
              Vaciar{" "}
            </Button>
          )}
          <IconButton onClick={onClose} disabled={isCartPinned}>
            <Close color={isCartPinned ? "disabled" : "error"} />
          </IconButton>
        </Box>
      </Box>

      {/* Scrollable region: product list + footer content share a single scroll
          container so the confirm button is always reachable, even when the
          multi-currency panel or the bill-breakdown collapse grow tall. */}
      <Box
        flex={1}
        minWidth={0}
        overflow="auto"
        sx={{
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "rgba(0,0,0,0.05)",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(0,0,0,0.2)",
            borderRadius: "3px",
            "&:hover": {
              background: "rgba(0,0,0,0.3)",
            },
          },
        }}
      >
        {/* Productos */}
        {paymentMode === "cart" && (
          <Box>
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
        )}

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
                sx={{
                  mb: 0.25,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                Total venta
              </Typography>
              {discountTotal > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    textDecoration: "line-through",
                    color: "text.disabled",
                  }}
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

          {applied.length > 0 && (
            <Typography
              variant="body2"
              fontWeight={600}
              color="success.main"
              sx={{ mb: 0.5 }}
            >
              Descuento aplicado: -{discountTotal.toFixed(2)} {monedaBase}
            </Typography>
          )}
          <Button
            variant="text"
            size="small"
            onClick={() => setShowDiscount((v) => !v)}
            startIcon={showDiscount ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              textTransform: "none",
              color: "text.secondary",
              mb: showDiscount ? 1 : 1.5,
            }}
          >
            {applied.length > 0
              ? "Cambiar código de descuento"
              : "¿Tienes un código de descuento?"}
          </Button>
          <Collapse in={showDiscount}>
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
                key={saleResetKey}
                finalTotal={finalTotal}
                transferDestinations={transferDestinations}
                onChange={setQuickPay}
              />

              <Typography
                variant="body2"
                fontWeight={600}
                color={fastFalta ? "error.main" : "success.main"}
                sx={{ mt: 1, mb: fastVueltoError ? 0.5 : 1 }}
              >
                {fastFalta
                  ? `Falta: ${(finalTotal - totalPaidFast).toFixed(2)} ${monedaBase}`
                  : fastCambio > 0
                    ? `Cambio: ${fastCambio.toFixed(2)} ${monedaBase}`
                    : "Pago exacto"}
              </Typography>

              {fastVueltoError && (
                <Typography
                  variant="caption"
                  color="error"
                  display="block"
                  sx={{ mb: 1 }}
                >
                  {fastVueltoError}
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
              onSaleComplete={resetCheckoutState}
            />
          )}
        </Box>
      </Box>

      {ConfirmDialogComponent}
    </Box>
  );
};
