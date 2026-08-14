"use client";

import { memo } from "react";

import { Box, Button } from "@mui/material";
import { formatNumberWith } from "@/utils/numberFormat";

/**
 * Bare amounts with no currency code beside them: es-ES grouping/decimal
 * convention, but a whole number stays whole (no forced ".00").
 */
const BARE_AMOUNT_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

const formatBareAmount = (amount: number): string =>
  formatNumberWith(amount, BARE_AMOUNT_OPTIONS);

interface AmountChipsProps {
  /** Smallest payable amount covering the pending total. */
  exact: number;
  suggestions: number[];
  /** Amount the line currently holds, used to highlight the active chip. */
  value: number;
  onSelect: (amount: number) => void;
}

function AmountChipsComponent({
  exact,
  suggestions,
  value,
  onSelect,
}: AmountChipsProps) {
  const chips: Array<{ label: string; amount: number }> = [
    ...(exact > 0 ? [{ label: "Exacto", amount: exact }] : []),
    ...suggestions.map((amount) => ({
      label: formatBareAmount(amount),
      amount,
    })),
  ];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {chips.map(({ label, amount }) => {
        const active = Math.round(amount * 100) === Math.round(value * 100);
        return (
          <Button
            key={label}
            variant={active ? "contained" : "outlined"}
            color={active ? "success" : "inherit"}
            onClick={() => onSelect(amount)}
            sx={{
              minHeight: 44,
              flex: "1 1 auto",
              textTransform: "none",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {label}
          </Button>
        );
      })}
    </Box>
  );
}

export const AmountChips = memo(AmountChipsComponent);
