"use client";

import type { KeyboardEvent } from "react";
import { alpha, Box, Button, Stack, Typography, useTheme } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatChangeSplit, formatMontoEnMoneda } from "@/utils/formatters";
import type { ChangeDistribution } from "@/app/pos/utils/changeMath";

interface ChangeSummaryProps {
  missing: boolean;
  /** How much is still owed, in base currency. */
  missingAmount: number;
  /** How much change to give, in base currency. */
  changeAmount: number;
  /** The split about to be handed over, main currency first. */
  distribution: ChangeDistribution;
  /** Whether there is more than one way to split it — gates the detail sheet. */
  hasAlternatives: boolean;
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
  distribution,
  hasAlternatives,
  base,
  error,
  canSell,
  onOpenDetail,
  onSell,
}: ChangeSummaryProps) {
  const theme = useTheme();
  const hasChange = !missing && changeAmount > 0;
  const tone = missing || error ? "error" : hasChange ? "success" : "neutral";
  // Only worth opening when there is something else to pick. A single
  // possible split makes the sheet a dead end.
  const interactive = hasChange && hasAlternatives;

  const label = missing ? "Falta" : hasChange ? "Cambio" : "Pago exacto";

  const split = formatChangeSplit(distribution);
  // The split is the number the cashier counts out; the base-currency total
  // is only a fallback for when there is no split to show (no cash taken, so
  // no currency to denominate the change in).
  const value = missing
    ? formatMontoEnMoneda(missingAmount, base)
    : hasChange
      ? split || formatMontoEnMoneda(changeAmount, base)
      : formatMontoEnMoneda(0, base);

  // Two currencies do not fit on one line at heading size on a phone.
  const compact = Object.keys(distribution).length > 1;

  return (
    <Stack gap={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        aria-live="polite"
        // Without the role, tabIndex and key handler this row is mouse-only,
        // and "focus visible on everything interactive" could never be
        // satisfied — there would be nothing to focus.
        {...(interactive
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
          cursor: interactive ? "pointer" : "default",
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
          sx={{ flexShrink: 0 }}
        >
          {label}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          gap={0.5}
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant={compact ? "subtitle1" : "h6"}
            fontWeight={700}
            align="right"
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
          {interactive && <ChevronRightIcon fontSize="small" />}
        </Stack>
      </Stack>

      {error && (
        <Typography variant="caption" color="error" fontWeight={600}>
          En caja hay {formatMontoEnMoneda(error.available, error.currency)}.
          {hasAlternatives
            ? " Elige otra forma de dar el cambio."
            : " Reparte el cambio en otra moneda."}
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
