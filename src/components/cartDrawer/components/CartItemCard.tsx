"use client";

import { memo, useState } from "react";
import type { MouseEvent } from "react";
import { Delete, Remove, Add } from "@mui/icons-material";
import {
  Box,
  ButtonBase,
  Divider,
  Typography,
  Chip,
  IconButton,
  Paper,
  Popover,
  Stack,
  Tooltip,
  alpha,
} from "@mui/material";
import type { Theme } from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { formatQuantity } from "@/utils/formatters";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";

// Hoisted out of the render: this component is mounted once per line of the
// basket and re-renders on every `+` and `−`, so an object literal here means
// Emotion re-serializing the same styles for every line, every time.
const ROOT_SX = {
  p: { xs: 1, sm: 1.25 },
  mb: 1,
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
} as const;
const NAME_SX = {
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;
// Callback form instead of `useTheme()`: the hook was being called once per
// basket line purely to read one palette colour.
const REMOVE_BUTTON_SX = {
  flexShrink: 0,
  color: "error.main",
  mt: -0.25,
  "@media (hover: hover)": {
    "&:hover": {
      bgcolor: (theme: Theme) => alpha(theme.palette.error.main, 0.08),
    },
  },
} as const;
const STEPPER_SX = {
  bgcolor: "action.hover",
  borderRadius: 2,
  px: 0.5,
  py: 0.25,
  flexShrink: 0,
} as const;
const STEP_BUTTON_SX = { minWidth: 44, minHeight: 44 } as const;
const QUANTITY_SX = { minWidth: 28, textAlign: "center" } as const;
const AMOUNT_BUTTON_BASE_SX = {
  borderRadius: 1.5,
  px: 0.75,
  py: 0.5,
  minHeight: 44,
} as const;
const AMOUNT_BUTTON_SX = {
  ...AMOUNT_BUTTON_BASE_SX,
  cursor: "pointer",
} as const;
const AMOUNT_BUTTON_STATIC_SX = {
  ...AMOUNT_BUTTON_BASE_SX,
  cursor: "default",
} as const;
const CHIP_SX = { height: 18, fontSize: "0.65rem" } as const;
const DETAIL_SX = { p: 1.5, minWidth: 200 } as const;
const DETAIL_LABEL_SX = {
  mb: 0.25,
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: 0.4,
} as const;
const POPOVER_ANCHOR_ORIGIN = { vertical: "top", horizontal: "right" } as const;
const POPOVER_TRANSFORM_ORIGIN = {
  vertical: "bottom",
  horizontal: "right",
} as const;

function ExpiryChip({ fechaVencimiento }: { fechaVencimiento: string }) {
  const ahora = new Date();
  const fecha = new Date(fechaVencimiento);
  const dias = Math.ceil(
    (fecha.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias <= 0) {
    return (
      <Tooltip title="Este producto está vencido">
        <Chip label="Vencido" color="error" size="small" sx={CHIP_SX} />
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
          sx={CHIP_SX}
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
          sx={CHIP_SX}
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

function CartItemCardComponent({
  item,
  onDecrease,
  onIncrease,
  onRemove,
  canUpdateQuantity,
}: CartItemCardProps) {
  const { show: showAlternatives } = useShowAlternativeCurrencies();
  const [detailAnchor, setDetailAnchor] = useState<HTMLElement | null>(null);
  // Use priceBase (monedaBase equivalent) for MultiCurrencyAmount display; fall back to raw price if not set
  const unitPrice = item.priceBase ?? item.price;
  const lineTotal = unitPrice * item.quantity;

  const openDetail = (event: MouseEvent<HTMLElement>) =>
    setDetailAnchor(event.currentTarget);
  const closeDetail = () => setDetailAnchor(null);

  return (
    <Paper elevation={0} sx={ROOT_SX}>
      {/* Fila 1: nombre + eliminar */}
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        mb={0.75}
      >
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={700} sx={NAME_SX}>
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
            sx={REMOVE_BUTTON_SX}
          >
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Fila 2: cantidad y subtotal en una sola línea; el detalle (precio
          unitario + conversiones) queda oculto hasta que se toca el monto,
          en vez de ocupar espacio siempre. */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        {canUpdateQuantity ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={STEPPER_SX}
          >
            <IconButton
              size="small"
              onClick={() => onDecrease(item.id)}
              aria-label={`Reducir cantidad de ${item.name}`}
              sx={STEP_BUTTON_SX}
            >
              <Remove />
            </IconButton>
            <Typography variant="body1" fontWeight={700} sx={QUANTITY_SX}>
              {formatQuantity(item.quantity)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onIncrease(item.id)}
              aria-label={`Aumentar cantidad de ${item.name}`}
              sx={STEP_BUTTON_SX}
            >
              <Add />
            </IconButton>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            ×{formatQuantity(item.quantity)}
          </Typography>
        )}

        {/* Same rule as the product card: the popover exists because the
            equivalents are hidden, so it stops being a target once they are
            on the card. The unit price it also carries stays reachable from
            the product card in the grid. */}
        <ButtonBase
          onClick={showAlternatives ? undefined : openDetail}
          disableRipple={showAlternatives}
          component={showAlternatives ? "div" : "button"}
          aria-label={
            showAlternatives
              ? undefined
              : `Ver detalle de precio de ${item.name}`
          }
          sx={showAlternatives ? AMOUNT_BUTTON_STATIC_SX : AMOUNT_BUTTON_SX}
        >
          <MultiCurrencyAmount
            amount={lineTotal}
            color="success.main"
            align="right"
            showAlternatives={showAlternatives}
          />
        </ButtonBase>
      </Box>

      {/* Mounted only once opened, as in the product card: a closed Popover
          paints nothing, but its element and prop tree were still being built
          for every line of the basket on every render. */}
      {detailAnchor && (
        <Popover
          open
          anchorEl={detailAnchor}
          onClose={closeDetail}
          anchorOrigin={POPOVER_ANCHOR_ORIGIN}
          transformOrigin={POPOVER_TRANSFORM_ORIGIN}
        >
          <Stack gap={1} sx={DETAIL_SX}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={DETAIL_LABEL_SX}
              >
                Unitario
              </Typography>
              <MultiCurrencyAmount amount={unitPrice} variant="compact" />
            </Box>
            <Divider />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={DETAIL_LABEL_SX}
              >
                Subtotal ({item.quantity} ×)
              </Typography>
              <MultiCurrencyAmount
                amount={lineTotal}
                variant="compact"
                color="success.main"
              />
            </Box>
          </Stack>
        </Popover>
      )}
    </Paper>
  );
}

export const CartItemCard = memo(CartItemCardComponent);
