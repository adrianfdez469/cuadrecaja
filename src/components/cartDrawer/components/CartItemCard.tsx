"use client";

import { memo, useState } from "react";
import type { MouseEvent } from "react";
import { Remove, Add, DeleteOutline } from "@mui/icons-material";
import {
  Box,
  Button,
  ButtonBase,
  Divider,
  Typography,
  Chip,
  IconButton,
  Popover,
  Stack,
  Tooltip,
} from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";
import { formatQuantity } from "@/utils/formatters";
import { shape, touch } from "@/theme";
import { POS_CATALOG_ROW_HEIGHT } from "@/constants/pos";

/**
 * A line of the basket, as the redesign draws it: a row, not a card.
 *
 * Every line used to be a bordered card carrying a name, an expiry chip, a
 * red bin, a grouped stepper and an amount — five objects, one of them the
 * only destructive control on the screen, repeated per product. A basket of
 * six products was six boxes stacked inside a seventh.
 *
 * The row is the same information laid out flat: how many, of what, for how
 * much, and the two buttons that change it (the name wraps to a second line
 * rather than truncate, so the row's height is a minimum, not a fixed one).
 * No bin sits on the row itself —
 * a red icon per row spent the palette's loudest colour on the most routine
 * correction there is, and «−» to zero already removes the line one unit at
 * a time. Dropping a line outright (skipping the countdown on a high
 * quantity) lives one tap deeper, in the same popover that already shows the
 * unit price and subtotal — reachable from either the name or the amount, so
 * the whole row is the target, not just its right edge.
 *
 * The foreign-currency equivalents stay off the row by default, same as the
 * catalogue's price — see `useShowAlternativeCurrencies`, the same toggle the
 * POS toolbar drives. When on, each currency prints on its own line under
 * the price (`MultiCurrencyAmount`'s `stackAlternatives`) instead of one wide
 * line next to it, so it never has to compete with the name for width.
 * Turning it on doesn't shrink the popover away: unlike the catalogue card,
 * this popover's real job is the "Quitar" button, which stays reachable
 * either way.
 */

// Hoisted out of the render: this component is mounted once per line of the
// basket and re-renders on every `+` and `−`, so an object literal here means
// Emotion re-serializing the same styles for every line, every time.
// 60px is a minimum, not a fixed height: the same as a catalogue row when the
// name fits on one line, but a wrapped name grows the row past it. The first
// line has no rule above it — the heading already separates it (see
// cartContent).
const ROW_SX = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  minHeight: POS_CATALOG_ROW_HEIGHT,
  px: 1.75,
  borderTop: "1px solid",
  borderColor: "divider",
  "&:first-of-type": { borderTop: "none" },
} as const;

const QUANTITY_SX = {
  flexShrink: 0,
  fontSize: "0.875rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "text.secondary",
} as const;

// 14.5px, the same step as the catalogue's name.
const NAME_SX = {
  flex: 1,
  minWidth: 0,
  fontSize: "0.90625rem",
  lineHeight: 1.3,
} as const;

// Wraps freely instead of truncating: a one-line ellipsis was hiding enough
// of the name that the cashier couldn't tell two similar products apart on
// the basket. No line clamp — the name shows in full, however many lines
// that takes, and the row (a `minHeight`, not a fixed height) grows with it.
const NAME_TEXT_SX = {
  flex: 1,
  minWidth: 0,
  whiteSpace: "normal",
  wordBreak: "break-word",
} as const;

// `component="div"` — a `ButtonBase` defaults to a `<button>`, and the expiry
// chip beside the name renders its own `<div>`; nesting one inside the other
// is invalid HTML (the amount button next to it has the same shape, wrapping
// `MultiCurrencyAmount`'s own `<div>` root).
const NAME_BUTTON_SX = {
  ...NAME_SX,
  justifyContent: "flex-start",
  alignItems: "center",
  textAlign: "left",
  borderRadius: `${shape.radius.sm}px`,
  cursor: "pointer",
  py: 0.5,
} as const;

const AMOUNT_BUTTON_SX = {
  flexShrink: 0,
  borderRadius: `${shape.radius.sm}px`,
  px: 0.5,
  justifyContent: "flex-end",
  cursor: "pointer",
} as const;

// Two separate squares rather than the old grouped pill: the redesign puts
// the count on the left of the row, so the buttons no longer have a number
// between them to bind them into one control.
const STEP_BUTTON_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.md}px`,
  color: "text.secondary",
} as const;

const CHIP_SX = { height: 18, fontSize: "0.65rem", ml: 1 } as const;
const DETAIL_SX = { p: 1.5, minWidth: 200 } as const;
const REMOVE_BUTTON_SX = { justifyContent: "flex-start", px: 1 } as const;
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
  canUpdateQuantity: boolean;
  /** Absent where the caller is not allowed to drop a line outright. */
  onRemove?: (id: string) => void;
}

function CartItemCardComponent({
  item,
  onDecrease,
  onIncrease,
  canUpdateQuantity,
  onRemove,
}: CartItemCardProps) {
  const [detailAnchor, setDetailAnchor] = useState<HTMLElement | null>(null);
  // Use priceBase (monedaBase equivalent) for MultiCurrencyAmount display;
  // fall back to raw price if not set.
  const unitPrice = item.priceBase ?? item.price;
  const lineTotal = unitPrice * item.quantity;
  const { show: showAlternativeCurrencies } = useShowAlternativeCurrencies();

  const openDetail = (event: MouseEvent<HTMLElement>) =>
    setDetailAnchor(event.currentTarget);

  return (
    <Box sx={ROW_SX}>
      <Typography component="span" sx={QUANTITY_SX}>
        {formatQuantity(item.quantity)} ×
      </Typography>

      {/* Same target as the amount below it: either one opens the line's
          popover, which is where "Quitar del carrito" lives. */}
      <ButtonBase
        component="div"
        onClick={openDetail}
        aria-label={`Ver detalle de ${item.name}`}
        sx={NAME_BUTTON_SX}
      >
        <Typography
          component="span"
          fontWeight={600}
          fontSize="inherit"
          sx={NAME_TEXT_SX}
        >
          {item.name}
        </Typography>
        {item.fechaVencimiento && (
          <ExpiryChip fechaVencimiento={item.fechaVencimiento} />
        )}
      </ButtonBase>

      {/* The bare figure, as the redesign draws the line («9 × pepe 450,00»):
          no code — it's stated once, by the total under the list. The
          foreign-currency equivalents follow the POS-wide toggle; off by
          default so the name keeps the room a 354px row gives it. When on,
          `stackAlternatives` puts each currency on its own line rather than
          one wide "·"-joined line — that's what stops it competing with the
          name for width in the first place. */}
      <ButtonBase
        onClick={openDetail}
        aria-label={`Ver detalle de precio de ${item.name}`}
        sx={AMOUNT_BUTTON_SX}
      >
        <MultiCurrencyAmount
          amount={lineTotal}
          variant="line"
          align="right"
          showAlternatives={showAlternativeCurrencies}
          stackAlternatives
          showCode={false}
        />
      </ButtonBase>

      {canUpdateQuantity && (
        <>
          <IconButton
            onClick={() => onDecrease(item.id)}
            aria-label={`Reducir cantidad de ${item.name}`}
            sx={STEP_BUTTON_SX}
          >
            <Remove />
          </IconButton>
          <IconButton
            onClick={() => onIncrease(item.id)}
            aria-label={`Aumentar cantidad de ${item.name}`}
            sx={STEP_BUTTON_SX}
          >
            <Add />
          </IconButton>
        </>
      )}

      {/* Mounted only once opened: a closed Popover paints nothing, but its
          element and prop tree were still being built for every line of the
          basket on every render. */}
      {detailAnchor && (
        <Popover
          open
          anchorEl={detailAnchor}
          onClose={() => setDetailAnchor(null)}
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
              <MultiCurrencyAmount amount={lineTotal} variant="compact" />
            </Box>
            {onRemove && (
              <>
                <Divider />
                <Button
                  color="error"
                  size="small"
                  startIcon={<DeleteOutline fontSize="small" />}
                  sx={REMOVE_BUTTON_SX}
                  onClick={() => {
                    setDetailAnchor(null);
                    onRemove(item.id);
                  }}
                >
                  Quitar del carrito
                </Button>
              </>
            )}
          </Stack>
        </Popover>
      )}
    </Box>
  );
}

export const CartItemCard = memo(CartItemCardComponent);
