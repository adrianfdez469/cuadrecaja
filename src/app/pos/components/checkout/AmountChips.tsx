"use client";

import { Box, Button } from "@mui/material";

interface AmountChipsProps {
  /** Smallest payable amount covering the pending total. */
  exact: number;
  suggestions: number[];
  /** Amount the line currently holds, used to highlight the active chip. */
  value: number;
  onSelect: (amount: number) => void;
  onOther: () => void;
}

export function AmountChips({
  exact,
  suggestions,
  value,
  onSelect,
  onOther,
}: AmountChipsProps) {
  const chips: Array<{ label: string; amount: number }> = [
    ...(exact > 0 ? [{ label: "Exacto", amount: exact }] : []),
    ...suggestions.map((amount) => ({ label: String(amount), amount })),
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
      <Button
        variant="outlined"
        onClick={onOther}
        sx={{
          minHeight: 44,
          flex: "1 1 100%",
          textTransform: "none",
          borderStyle: "dashed",
          color: "text.secondary",
        }}
      >
        Otro monto…
      </Button>
    </Box>
  );
}
