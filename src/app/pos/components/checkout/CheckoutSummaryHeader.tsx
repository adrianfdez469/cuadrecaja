"use client";

import { Box, Typography } from "@mui/material";
import { BigFigure } from "@/app/pos/components/checkout/BigFigure";

interface CheckoutSummaryHeaderProps {
  /** «A cobrar», «A cobrar en CUP». */
  label: string;
  /** Right end of the label row — «3 productos · 44 unidades», «Tasa 670,00». */
  detail?: string;
  amount: number;
  currency: string;
  conversions?: string[];
  /** The arithmetic behind the amount, when it is not just the basket total. */
  breakdown?: string;
}

/**
 * What is being charged, said once and in full.
 *
 * The label row is the checkout's small monospace eyebrow with the count or
 * the rate at its right end; under it the figure at 40px with the code set
 * apart, then the equivalences, then — only when there is arithmetic to show
 * — the line that spells it out: «4.317,91 − 215,90 descuento + 400,00
 * propina». The cashier can explain the figure without opening anything.
 */

const HEAD_SX = {
  flex: "0 0 auto",
  px: 2,
  pt: 2,
  pb: 1.875,
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

const LABEL_ROW_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 1,
  mb: 0.75,
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "text.secondary",
} as const;

const BREAKDOWN_SX = {
  mt: 1.125,
  fontSize: "0.78125rem",
  lineHeight: 1.4,
  color: "text.secondary",
  fontVariantNumeric: "tabular-nums",
} as const;

export function CheckoutSummaryHeader({
  label,
  detail,
  amount,
  currency,
  conversions,
  breakdown,
}: CheckoutSummaryHeaderProps) {
  return (
    <Box sx={HEAD_SX}>
      <Box sx={LABEL_ROW_SX}>
        <span>{label}</span>
        {detail && <span>{detail}</span>}
      </Box>

      <BigFigure
        amount={amount}
        currency={currency}
        conversions={conversions}
      />

      {breakdown && <Typography sx={BREAKDOWN_SX}>{breakdown}</Typography>}
    </Box>
  );
}
