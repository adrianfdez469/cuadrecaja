"use client";

import { Box, Button } from "@mui/material";

/**
 * Bare amounts with no currency code beside them: es-ES grouping/decimal
 * convention, but a whole number stays whole (no forced ".00").
 */
const formatBareAmount = (amount: number): string =>
  amount.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

interface AmountChipsProps {
  /** Smallest payable amount covering the pending total. */
  exact: number;
  suggestions: number[];
  /** Amount the line currently holds, used to highlight the active chip. */
  value: number;
  onSelect: (amount: number) => void;
}

export function AmountChips({
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
