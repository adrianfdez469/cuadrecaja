"use client";

import { alpha, Box, Button, Stack, Typography, useTheme } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface ChangeSummaryProps {
  missing: boolean;
  /** How much is still owed, in base currency. */
  missingAmount: number;
  /** How much change to give, in base currency. */
  changeAmount: number;
  base: string;
  /** Drawer balance error, shown inline next to the disabled button. */
  error: string | null;
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
    ? `${missingAmount.toFixed(2)} ${base}`
    : hasChange
      ? `${changeAmount.toFixed(2)} ${base}`
      : `0.00 ${base}`;

  return (
    <Stack gap={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        aria-live="polite"
        onClick={hasChange ? onOpenDetail : undefined}
        sx={{
          p: 1.25,
          borderRadius: 2,
          cursor: hasChange ? "pointer" : "default",
          minHeight: 44,
          bgcolor:
            tone === "error"
              ? alpha(theme.palette.error.main, 0.12)
              : "action.hover",
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
          {error} Repartí el cambio en otra moneda.
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
