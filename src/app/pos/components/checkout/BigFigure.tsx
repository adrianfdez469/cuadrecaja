"use client";

import { Box, Typography } from "@mui/material";
import { formatAmount } from "@/utils/numberFormat";

/**
 * A figure the customer is told: the amount to collect, the change owed.
 *
 * Bold and tight, with the currency code set apart on the baseline — small,
 * regular and muted — so the number is read first and the code is never
 * mistaken for part of it. The same drawing the charge bar and the summary
 * block share on every screen of the checkout; the conversions under it are
 * equivalences, one step lighter, never the amount anyone is charged.
 */

interface BigFigureProps {
  amount: number;
  currency: string;
  /** Text after the code — «USD por cubrir». */
  codeSuffix?: string;
  /** «≈ 2.893.000,00 CUP», «= 4.317,91 USD». */
  conversions?: string[];
  /** 40px in the summary block, 34px on the charge bar. */
  size?: "lg" | "md";
  onInverse?: boolean;
}

const FIGURE_SX = {
  display: "flex",
  alignItems: "baseline",
  gap: "8px",
  fontWeight: 700,
  letterSpacing: "-0.025em",
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  wordBreak: "break-word",
} as const;

const CODE_SX = {
  fontSize: "0.9375rem",
  fontWeight: 400,
  letterSpacing: 0,
  whiteSpace: "nowrap",
} as const;

const CONVERSIONS_SX = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: 2,
  rowGap: 0.25,
  mt: 1,
  fontSize: "0.78125rem",
  lineHeight: 1.35,
  fontVariantNumeric: "tabular-nums",
} as const;

export function BigFigure({
  amount,
  currency,
  codeSuffix,
  conversions,
  size = "lg",
  onInverse = false,
}: BigFigureProps) {
  const muted = onInverse ? "semantic.text.onInverseMuted" : "text.secondary";
  return (
    <Box>
      <Typography
        component="div"
        color={onInverse ? "semantic.text.onInverse" : "text.primary"}
        sx={{ ...FIGURE_SX, fontSize: size === "lg" ? "2.5rem" : "2.125rem" }}
      >
        {formatAmount(amount)}
        <Box component="span" color={muted} sx={CODE_SX}>
          {codeSuffix ? `${currency} ${codeSuffix}` : currency}
        </Box>
      </Typography>
      {conversions && conversions.length > 0 && (
        <Box component="div" color={muted} sx={CONVERSIONS_SX}>
          {conversions.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </Box>
      )}
    </Box>
  );
}
