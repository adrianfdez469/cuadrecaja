"use client";

import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useMonedasAlternativas } from "./useMonedasAlternativas";

type MultiCurrencyVariant = "default" | "compact" | "emphasized";

interface MultiCurrencyAmountProps {
  amount: number;
  variant?: MultiCurrencyVariant;
  color?: string;
  align?: "left" | "right" | "center";
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
};

export function MultiCurrencyAmount({
  amount,
  variant = "default",
  color,
  align = "left",
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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems:
          align === "right"
            ? "flex-end"
            : align === "center"
              ? "center"
              : "flex-start",
        gap: 0.25,
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

      {hasAlternativas && (
        <Typography
          variant={styles.secondary as "caption"}
          color="text.secondary"
          component="span"
          sx={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 0.5,
            lineHeight: 1.35,
            justifyContent:
              align === "right"
                ? "flex-end"
                : align === "center"
                  ? "center"
                  : "flex-start",
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
