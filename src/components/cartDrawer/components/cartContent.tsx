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
} from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import PushPinIcon from "@mui/icons-material/PushPin";

import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";

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
              "&:hover": { bgcolor: "error.50" },
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
  onOkButtonClick: () => void;
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
  onOkButtonClick,
  setIsCartPinned,
}: IProps) => {
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const handleRemoveItem = (item: ICartItem) => {
    if (removeItem) {
      confirmDialog(
        `¿Estás seguro de que deseas eliminar "${item.name}" del carrito?`,
        () => {
          removeItem(item.id);
        },
      );
    }
  };

  const decreseQty = (id: string) => {
    const prevQuantity = cart.find((p) => p.id === id).quantity;
    if (prevQuantity === 1) {
      if (removeItem) {
        // Confirmar antes de eliminar completamente el producto
        const product = cart.find((p) => p.id === id);
        confirmDialog(
          `¿Estás seguro de que deseas eliminar "${product?.name}" del carrito?`,
          () => {
            removeItem(id);
          },
        );
      } else {
        showMessage("No puede elminar completamente el producto", "warning");
      }
    } else {
      updateQuantity(id, prevQuantity - 1);
    }
  };

  const increseQty = (id: string) => {
    const prevQuantity = cart.find((p) => p.id === id).quantity;
    updateQuantity(id, prevQuantity + 1);
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
              <IconButton
                onClick={() => handlePinCart()}
                size="small"
                sx={{
                  color: isCartPinned ? "primary.main" : "secondary.main",
                  "&:hover": {
                    backgroundColor: isCartPinned ? "primary.50" : "grey.100",
                  },
                }}
              >
                {isCartPinned ? <PushPinIcon /> : <PushPinIcon />}
              </IconButton>
            )}
          </Box>
          <Typography variant="body2" color="green">
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

      {/* Productos */}
      <Box
        flex={1}
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
        {cart.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onDecrease={decreseQty}
            onIncrease={increseQty}
            onRemove={removeItem ? handleRemoveItem : undefined}
            canUpdateQuantity={Boolean(updateQuantity)}
          />
        ))}
      </Box>

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
          mb={onOkButtonClick ? 1.5 : 0}
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
            <MultiCurrencyAmount
              amount={total}
              variant="emphasized"
              color="success.main"
            />
          </Box>
        </Box>

        {onOkButtonClick && (
          <Button
            variant="contained"
            color="success"
            disabled={cart.length === 0}
            onClick={onOkButtonClick}
            fullWidth
            size="large"
            sx={{
              fontWeight: "bold",
              py: 1.25,
              minHeight: 48,
            }}
          >
            VENDER
          </Button>
        )}
      </Box>

      {ConfirmDialogComponent}
    </Box>
  );
};
