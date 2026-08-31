"use client";

import { memo } from "react";
import { Box, ButtonBase, Chip, Typography } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import { tallyBills } from "@/app/pos/utils/billMath";
import { formatNumberWith } from "@/utils/numberFormat";
import { shape, touch } from "@/theme";

/**
 * Bare amounts with no currency code beside them: es-ES grouping/decimal
 * convention, but a whole number stays whole (no forced ",00").
 */
const BARE_AMOUNT_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

const formatBareAmount = (amount: number): string =>
  formatNumberWith(amount, BARE_AMOUNT_OPTIONS);

interface BillPadProps {
  denominations: number[];
  bills: number[];
  onChange: (bills: number[]) => void;
}

const GRID_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 1,
  px: 2,
  pt: 1.5,
} as const;

// The same key as the digits next door, one size down: a bill is a key.
const KEY_SX = {
  height: touch.comfortable,
  borderRadius: `${shape.radius.sm}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.primary",
  fontSize: "1.125rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
} as const;

const TALLY_SX = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 0.5,
  minHeight: touch.min,
  mx: 2,
  mt: 1,
  px: 1,
  py: 0.5,
  borderRadius: `${shape.radius.sm}px`,
  bgcolor: "semantic.surface.sunken",
} as const;

const UNDO_SX = {
  ml: "auto",
  minHeight: touch.min,
  px: 1,
  gap: 0.5,
  borderRadius: `${shape.radius.sm}px`,
  color: "primary.main",
  fontSize: "0.8125rem",
  fontWeight: 600,
  "&.Mui-disabled": { color: "text.disabled" },
} as const;

/** Tap a denomination to add it; undo pops the last one tapped. */
function BillPadComponent({ denominations, bills, onChange }: BillPadProps) {
  const grouped = tallyBills(bills);

  return (
    <Box>
      <Box sx={GRID_SX}>
        {denominations.map((denomination) => (
          <ButtonBase
            key={denomination}
            onClick={() => onChange([...bills, denomination])}
            sx={KEY_SX}
          >
            {formatBareAmount(denomination)}
          </ButtonBase>
        ))}
      </Box>

      <Box sx={TALLY_SX}>
        {grouped.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Toca los billetes que recibes
          </Typography>
        ) : (
          grouped.map(({ denomination, count }) => (
            <Chip
              key={denomination}
              size="small"
              label={`${count}×${formatBareAmount(denomination)}`}
              variant="outlined"
            />
          ))
        )}
        <ButtonBase
          disabled={bills.length === 0}
          onClick={() => onChange(bills.slice(0, -1))}
          sx={UNDO_SX}
        >
          <UndoIcon fontSize="small" />
          Deshacer
        </ButtonBase>
      </Box>
    </Box>
  );
}

export const BillPad = memo(BillPadComponent);
