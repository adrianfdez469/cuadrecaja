"use client";

import { Box, Button, alpha } from "@mui/material";
import type { Theme } from "@mui/material";
import { BigFigure } from "@/app/pos/components/checkout/BigFigure";
import { shape, touch } from "@/theme";

interface CheckoutPayBarProps {
  /** Left of the label row — «Total a cobrar», «Cubierto 3.985,07 de 4.502,01». */
  status: string;
  /** Right of the label row — «Elige una forma de pago», «2 formas de pago». */
  detail?: string;
  /** The figure that matters right now: the total, or what is still missing. */
  amount: number;
  currency: string;
  /** «por cubrir», after the code, while the payment falls short. */
  codeSuffix?: string;
  conversions?: string[];
  canSell: boolean;
  submitting: boolean;
  onConfirm: () => void;
}

/**
 * The charge screen's floor, the same object as the sale screen's.
 *
 * The amount and the action that commits it belong together on the flipped
 * ground, at the bottom, where the thumb is. Which amount depends on the
 * moment — while the payment falls short, the number the cashier needs is the
 * difference, not the total. The bar also says what is still needed («Elige
 * una forma de pago») and the button stays dark until it is not.
 */

const BAR_SX = {
  flex: "0 0 auto",
  px: 1.75,
  pt: 1.75,
  pb: "calc(16px + env(safe-area-inset-bottom))",
  bgcolor: "semantic.surface.inverse",
} as const;

const LABEL_ROW_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 1,
  mb: 0.75,
  fontSize: "0.71875rem",
  lineHeight: 1.3,
  color: "semantic.text.onInverseMuted",
  "& > span": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
} as const;

// «Confirmar cobro» waits in a quieter ink while the payment is not ready:
// the redesign draws the disabled button as a darker band on the bar rather
// than as MUI's grey-on-white, which on this ground reads as a hole.
const CTA_SX = {
  mt: 1.625,
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  fontSize: "1.0625rem",
  fontWeight: 700,
  "&.Mui-disabled": {
    bgcolor: (theme: Theme) =>
      alpha(theme.palette.semantic.text.onInverse, 0.1),
    color: "semantic.text.onInverseMuted",
  },
} as const;

export function CheckoutPayBar({
  status,
  detail,
  amount,
  currency,
  codeSuffix,
  conversions,
  canSell,
  submitting,
  onConfirm,
}: CheckoutPayBarProps) {
  return (
    <Box sx={BAR_SX}>
      <Box sx={LABEL_ROW_SX}>
        <span>{status}</span>
        {detail && <span>{detail}</span>}
      </Box>

      <BigFigure
        amount={amount}
        currency={currency}
        codeSuffix={codeSuffix}
        conversions={conversions}
        size="md"
        onInverse
      />

      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        disabled={!canSell}
        onClick={onConfirm}
        sx={CTA_SX}
      >
        {submitting ? "Confirmando..." : "Confirmar cobro"}
      </Button>
    </Box>
  );
}
