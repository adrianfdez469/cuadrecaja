"use client";

import { ButtonBase, Typography } from "@mui/material";
import { shape } from "@/theme";

interface PaymentMethodTileProps {
  /** «Efectivo CUP», «Transferencia USD», «Pago mixto». */
  title: string;
  /** The amount owed in that currency, or what the option is. */
  hint: string;
  onClick: () => void;
}

/**
 * One form of payment, as a 76px tile in a two-column grid.
 *
 * Nothing is preselected: the tiles are the question the screen opens with,
 * and the charge button below waits until one is answered.
 */

const TILE_SX = {
  height: 76,
  border: "1.5px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.md}px`,
  px: 1.5,
  py: 1.375,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "space-between",
  textAlign: "left",
  minWidth: 0,
} as const;

const TITLE_SX = {
  fontSize: "0.90625rem",
  fontWeight: 600,
  lineHeight: 1.25,
  width: "100%",
} as const;

const HINT_SX = {
  fontSize: "0.71875rem",
  color: "text.secondary",
  fontVariantNumeric: "tabular-nums",
  width: "100%",
} as const;

export function PaymentMethodTile({
  title,
  hint,
  onClick,
}: PaymentMethodTileProps) {
  return (
    <ButtonBase onClick={onClick} sx={TILE_SX}>
      <Typography sx={TITLE_SX} noWrap>
        {title}
      </Typography>
      <Typography sx={HINT_SX} noWrap>
        {hint}
      </Typography>
    </ButtonBase>
  );
}
