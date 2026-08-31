"use client";

import { memo, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useMonedasAlternativas } from "./useMonedasAlternativas";
import { formatAmount } from "@/utils/numberFormat";

type MultiCurrencyVariant =
  | "default"
  | "compact"
  | "emphasized"
  | "hero"
  | "line"
  | "stat"
  | "total";

interface MultiCurrencyAmountProps {
  amount: number;
  variant?: MultiCurrencyVariant;
  color?: string;
  /**
   * Paint on `surface.inverse` — the charge bar and the checkout screen.
   *
   * The token layer carries a dedicated pair for exactly this (`text.onInverse`
   * and `text.onInverseMuted`), because the amount and its conversions need
   * different treatment on the flipped ground than they do on a card. Passing
   * `color` still wins, so a caller that needs something else is not blocked.
   */
  onInverse?: boolean;
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
  /**
   * Set false to print the bare figure, without the currency code. The
   * redesign does this on the lines of the basket only («9 × pepe 450,00»):
   * the code is already stated once, by the total under them.
   */
  showCode?: boolean;
  sx?: SxProps<Theme>;
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
  {
    primary: string;
    secondary: string;
    primaryWeight: number;
    /** Overrides the type step where the redesign asks for a size the scale has no name for. */
    primarySize?: string;
    /**
     * The currency code set apart from the figure — small, regular and muted,
     * on the baseline. The redesign draws the charge bar's total this way so
     * the amount is read first and the code is not mistaken for part of it.
     */
    detachedCode?: boolean;
  }
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
  // An amount on a row — a catalogue entry, a basket line. The redesign draws
  // it at 16px, one step above `body1`, so the price stays the second thing
  // read on a row whose name is now 14.5px.
  emphasized: {
    primary: "body1",
    secondary: "caption",
    primaryWeight: 700,
    primarySize: "1rem",
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
  // A line of the basket: 15px, one notch under the catalogue's price, and
  // in the redesign the only amount printed without its code.
  line: {
    primary: "body1",
    secondary: "caption",
    primaryWeight: 700,
    primarySize: "0.9375rem",
  },
  // A figure at the head of a management screen. 26px is the redesign's step
  // for these, and the conversions drop to 12px underneath: the equivalence is
  // a reference, never the amount anyone is charged.
  stat: {
    primary: "h3",
    secondary: "caption",
    primaryWeight: 700,
  },
  // The charge bar's total. `h1` is the only step that carries the
  // -0.025em the direction was already applying by hand; the redesign sets
  // it at 38px, and a six-digit total still clears the 390px screen with
  // room to spare.
  total: {
    primary: "h1",
    secondary: "body2",
    primaryWeight: 700,
    primarySize: "2.375rem",
    detachedCode: true,
  },
};

type Alternativa = { code: string; label: string };
const NO_ALTERNATIVAS: Alternativa[] = [];

/** Resolved through the theme so a scheme change carries them along. */
const INVERSE_PRIMARY = "semantic.text.onInverse";
const INVERSE_SECONDARY = "semantic.text.onInverseMuted";

// Hoisted: this component renders once or twice per product card, and these
// two never depend on props. The first is responsive, which Emotion charges
// several times a flat rule for.
const ALT_ITEM_SX = { whiteSpace: { xs: "normal", sm: "nowrap" } } as const;
const ALT_SEPARATOR_SX = { mr: 0.5, opacity: 0.6 } as const;

// The detached code: 15px, regular, muted, 7px off the figure's baseline.
const DETACHED_CODE_SX = {
  ml: "7px",
  fontSize: "0.9375rem",
  fontWeight: 400,
  letterSpacing: 0,
} as const;

function MultiCurrencyAmountComponent({
  amount,
  variant = "default",
  color,
  onInverse = false,
  align = "left",
  layout = "stacked",
  showAlternatives = true,
  showCode = true,
  sx,
}: MultiCurrencyAmountProps) {
  const { monedasAlternativas, hasAlternativas, monedaBase, convertToMoneda } =
    useMonedasAlternativas();

  const styles = VARIANT_STYLES[variant];

  // Guarded on `showAlternatives`: the POS renders this once (sometimes
  // twice) per product card with the equivalents turned off by default, and
  // converting plus formatting every business currency for a line that is
  // never painted was pure waste, multiplied by the whole catalog.
  const alternativas = useMemo(
    () =>
      showAlternatives
        ? monedasAlternativas.map((m) => ({
            code: m.monedaCode,
            label: formatMonedaLabel(
              convertToMoneda(amount, m.monedaCode),
              m.moneda?.simbolo,
              m.monedaCode,
            ),
          }))
        : NO_ALTERNATIVAS,
    [showAlternatives, monedasAlternativas, amount, convertToMoneda],
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
        color={color ?? (onInverse ? INVERSE_PRIMARY : "text.primary")}
        sx={{
          lineHeight: 1.3,
          wordBreak: "break-word",
          ...(styles.primarySize ? { fontSize: styles.primarySize } : null),
        }}
      >
        {formatAmount(amount)}
        {showCode && !styles.detachedCode && ` ${monedaBase}`}
        {showCode && styles.detachedCode && (
          <Box
            component="span"
            sx={DETACHED_CODE_SX}
            color={onInverse ? INVERSE_SECONDARY : "text.secondary"}
          >
            {monedaBase}
          </Box>
        )}
      </Typography>

      {hasAlternativas && showAlternatives && (
        <Typography
          variant={styles.secondary as "caption"}
          color={onInverse ? INVERSE_SECONDARY : "text.secondary"}
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
            <Box key={alt.code} component="span" sx={ALT_ITEM_SX}>
              {index > 0 && (
                <Box component="span" sx={ALT_SEPARATOR_SX}>
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

export const MultiCurrencyAmount = memo(MultiCurrencyAmountComponent);
