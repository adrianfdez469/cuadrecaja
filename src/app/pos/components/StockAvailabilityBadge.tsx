"use client";

import { memo } from "react";
import { Stack, Typography } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { formatQuantity } from "@/utils/formatters";

const ROOT_SX = { flexShrink: 0 } as const;
const COUNT_SX = {
  fontSize: "0.82rem",
  fontWeight: 700,
  lineHeight: 1.6,
  fontVariantNumeric: "tabular-nums",
} as const;

interface StockAvailabilityBadgeProps {
  /** Sellable units, parents of a fraction included, before the cart. */
  disponible: number;
  esFraccion: boolean;
  /** Loose units of this product alone, quoted in the tooltip of a fraction. */
  existencia: number;
  /** Units of this product already in the cart, which are no longer available. */
  cartQty: number;
}

/**
 * How many units the cashier can still sell, on a product card.
 *
 * The box icon replaces the "Disp:" prefix rather than joining it: with the
 * icon carrying the meaning, the word was spending the card's scarcest
 * resource — horizontal space in the row it shares with the product name —
 * to say what the icon already says. What is left is the number, which is
 * what actually gets read, at a size that survives a glance.
 *
 * One number, always. A fractioned product used to show its loose stock
 * beside it, which read as a contradiction ("9 available, 3 in stock")
 * because the two counted different things; now the single figure is the
 * whole truth — loose units plus everything inside the unopened packs, which
 * the sale opens by itself.
 */
function StockAvailabilityBadgeComponent({
  disponible: total,
  esFraccion,
  existencia,
  cartQty,
}: StockAvailabilityBadgeProps) {
  const disponible = Math.max(0, total - cartQty);
  const sinStock = disponible === 0;
  const color = sinStock ? "error.main" : "text.secondary";

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={0.375}
      sx={ROOT_SX}
      // An icon is not self-describing the first time it is seen, and this
      // number decides whether a sale can happen. For a fraction it also
      // says where the units are, which is what the second figure used to be
      // there for.
      title={
        esFraccion
          ? `${formatQuantity(disponible)} disponibles para vender (${formatQuantity(existencia)} sueltas, el resto dentro de paquetes sin abrir)`
          : `${formatQuantity(disponible)} disponibles para vender`
      }
    >
      <Inventory2OutlinedIcon sx={{ fontSize: "0.95rem", color }} />
      <Typography variant="caption" color={color} noWrap sx={COUNT_SX}>
        {formatQuantity(disponible)}
      </Typography>
    </Stack>
  );
}

export const StockAvailabilityBadge = memo(StockAvailabilityBadgeComponent);
