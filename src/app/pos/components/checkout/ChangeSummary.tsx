"use client";

import type { KeyboardEvent } from "react";
import { alpha, Box, Button, Stack, Typography, useTheme } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatMontoEnMoneda } from "@/utils/formatters";

interface ChangeSummaryProps {
  missing: boolean;
  /** How much is still owed, in base currency. */
  missingAmount: number;
  /** How much change to give, in base currency. */
  changeAmount: number;
  base: string;
  /** Drawer balance shortfall, shown inline next to the disabled button. */
  error: { available: number; currency: string } | null;
  canSell: boolean;
  onOpenDetail: () => void;
  onSell: () => void;
}

export function ChangeSummary({
  missing,
  missingAmount,
  changeAmount,
  base,
  error,
  canSell,
  onOpenDetail,
  onSell,
}: ChangeSummaryProps) {
  const theme = useTheme();
  const hasChange = !missing && changeAmount > 0;
  const tone = missing || error ? "error" : hasChange ? "success" : "neutral";

  const label = missing ? "Falta" : hasChange ? "Cambio" : "Pago exacto";

  const value = missing
    ? formatMontoEnMoneda(missingAmount, base)
    : hasChange
      ? formatMontoEnMoneda(changeAmount, base)
      : formatMontoEnMoneda(0, base);

  return (
    <Stack gap={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        aria-live="polite"
        // Only interactive when there is a split to open. Without the role,
        // tabIndex and key handler this row is mouse-only, and "focus visible
        // on everything interactive" could never be satisfied — there would be
        // nothing to focus.
        {...(hasChange
          ? {
              role: "button",
              tabIndex: 0,
              onClick: onOpenDetail,
              onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenDetail();
                }
              },
            }
          : {})}
        sx={{
          p: 1.25,
          borderRadius: 2,
          cursor: hasChange ? "pointer" : "default",
          minHeight: 44,
          bgcolor:
            tone === "error"
              ? alpha(theme.palette.error.main, 0.12)
              : "action.hover",
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          color={tone === "error" ? "error.main" : "text.secondary"}
        >
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Typography
            variant="h6"
            fontWeight={700}
            color={
              tone === "error"
                ? "error.main"
                : tone === "success"
                  ? "success.main"
                  : "text.secondary"
            }
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </Typography>
          {hasChange && <ChevronRightIcon fontSize="small" />}
        </Stack>
      </Stack>

      {error && (
        <Typography variant="caption" color="error" fontWeight={600}>
          En caja hay {formatMontoEnMoneda(error.available, error.currency)}.
          Reparte el cambio en otra moneda.
        </Typography>
      )}

      <Box>
        <Button
          variant="contained"
          color="success"
          fullWidth
          size="large"
          disabled={!canSell}
          onClick={onSell}
          sx={{ fontWeight: "bold", py: 1.25, minHeight: 48 }}
        >
          VENDER
        </Button>
      </Box>
    </Stack>
  );
}
