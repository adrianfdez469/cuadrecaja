"use client";

import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useMonedasAlternativas } from "./useMonedasAlternativas";

type MultiCurrencyVariant = "default" | "compact" | "emphasized" | "hero";

interface MultiCurrencyAmountProps {
  amount: number;
  variant?: MultiCurrencyVariant;
  color?: string;
  align?: "left" | "right" | "center";
  /**
   * "stacked" (default) puts the alternate-currency line below the primary
   * amount — the right call in narrow columns (item rows, unit prices).
   * "inline" runs them on the same line, wrapping only if they don't fit —
   * for standalone totals with room to breathe, so the total doesn't read
   * as two disconnected numbers.
   */
  layout?: "stacked" | "inline";
  /** Set false to show only the base-currency amount, e.g. a compact row
   * where the conversions belong behind a tap instead of always on screen. */
  showAlternatives?: boolean;
  sx?: SxProps<Theme>;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonedaLabel(
  amount: number,
  simbolo: string | undefined,
  code: string,
): string {
  const formatted = formatAmount(amount);
  return simbolo ? `${simbolo}${formatted}` : `${formatted} ${code}`;
}

const VARIANT_STYLES: Record<
  MultiCurrencyVariant,
  { primary: string; secondary: string; primaryWeight: number }
> = {
  compact: {
    primary: "caption",
    secondary: "caption",
    primaryWeight: 600,
  },
  default: {
    primary: "body2",
    secondary: "caption",
    primaryWeight: 600,
  },
  emphasized: {
    primary: "body1",
    secondary: "caption",
    primaryWeight: 700,
  },
  // The sale's bottom-line total: the one number the cashier and the
  // customer both actually look at, so it gets real weight on screen
  // instead of reading like any other line item. No caption sits above it
  // at either call site, so it can afford to be this big.
  hero: {
    primary: "h4",
    secondary: "body2",
    primaryWeight: 800,
  },
};

export function MultiCurrencyAmount({
  amount,
  variant = "default",
  color,
  align = "left",
  layout = "stacked",
  showAlternatives = true,
  sx,
}: MultiCurrencyAmountProps) {
  const { monedasAlternativas, hasAlternativas, monedaBase, convertToMoneda } =
    useMonedasAlternativas();

  const styles = VARIANT_STYLES[variant];

  const alternativas = useMemo(
    () =>
      monedasAlternativas.map((m) => ({
        code: m.monedaCode,
        label: formatMonedaLabel(
          convertToMoneda(amount, m.monedaCode),
          m.moneda?.simbolo,
          m.monedaCode,
        ),
      })),
    [monedasAlternativas, amount, convertToMoneda],
  );

  const isInline = layout === "inline";
  const justify =
    align === "right"
      ? "flex-end"
      : align === "center"
        ? "center"
        : "flex-start";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isInline ? "row" : "column",
        flexWrap: isInline ? "wrap" : "nowrap",
        alignItems: isInline ? "baseline" : justify,
        justifyContent: isInline ? justify : undefined,
        columnGap: isInline ? 0.75 : 0,
        rowGap: isInline ? 0.25 : 0.25,
        minWidth: 0,
        maxWidth: "100%",
        ...sx,
      }}
    >
      <Typography
        variant={styles.primary as "body2"}
        fontWeight={styles.primaryWeight}
        color={color ?? "text.primary"}
        sx={{
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {formatAmount(amount)} {monedaBase}
      </Typography>

      {hasAlternativas && showAlternatives && (
        <Typography
          variant={styles.secondary as "caption"}
          color="text.secondary"
          component="span"
          sx={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 0.5,
            lineHeight: 1.35,
            justifyContent: isInline ? "flex-start" : justify,
            maxWidth: "100%",
          }}
        >
          {alternativas.map((alt, index) => (
            <Box
              key={alt.code}
              component="span"
              sx={{ whiteSpace: { xs: "normal", sm: "nowrap" } }}
            >
              {index > 0 && (
                <Box component="span" sx={{ mr: 0.5, opacity: 0.6 }}>
                  ·
                </Box>
              )}
              ≈ {alt.label}
            </Box>
          ))}
        </Typography>
      )}
    </Box>
  );
}
