"use client";

import { Box } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { shape } from "@/theme";

interface MissingBlockProps {
  amount: number;
  currency: string;
}

/**
 * What is still not covered. The one red object on the screen: the redesign
 * keeps the palette's loudest colour for this and takes it off every «✕».
 */

const BLOCK_SX = {
  mx: 2,
  mt: 1.5,
  px: 1.75,
  py: 1.5,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.negative.surface",
  border: "1px solid",
  borderColor: (theme: Theme) =>
    alpha(theme.palette.semantic.hue.negative.main, 0.25),
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 1,
} as const;

const LABEL_SX = {
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "semantic.hue.negative.main",
} as const;

const AMOUNT_SX = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "semantic.hue.negative.main",
  fontVariantNumeric: "tabular-nums",
} as const;

export function MissingBlock({ amount, currency }: MissingBlockProps) {
  return (
    <Box sx={BLOCK_SX} role="status">
      <Box component="span" sx={LABEL_SX}>
        Falta por cubrir
      </Box>
      <Box component="span" sx={AMOUNT_SX}>
        {formatMontoEnMoneda(amount, currency)}
      </Box>
    </Box>
  );
}
