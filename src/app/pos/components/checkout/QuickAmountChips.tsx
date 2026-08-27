"use client";

import { memo } from "react";
import { Box, ButtonBase } from "@mui/material";
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

interface QuickAmountChipsProps {
  /** Smallest payable amount covering the pending total. */
  exact: number;
  suggestions: number[];
  /** Amount the line currently holds, used to highlight the active chip. */
  value: number;
  onSelect: (amount: number) => void;
}

/**
 * «Exacto» and the two or three roundings most likely to be handed over:
 * 44px pills on the neutral wash, the chosen one in violet. They spare the
 * cashier six digits on most sales.
 */

const ROW_SX = { display: "flex", gap: 1, mt: 1.125 } as const;

const CHIP_SX = {
  flex: 1,
  minWidth: 0,
  height: touch.min,
  borderRadius: `${shape.radius.sm}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.primary",
  fontSize: "0.84375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  px: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const CHIP_ACTIVE_SX = {
  ...CHIP_SX,
  bgcolor: "primary.main",
  color: "primary.contrastText",
} as const;

function QuickAmountChipsComponent({
  exact,
  suggestions,
  value,
  onSelect,
}: QuickAmountChipsProps) {
  const chips: Array<{ label: string; amount: number }> = [
    ...(exact > 0 ? [{ label: "Exacto", amount: exact }] : []),
    ...suggestions.map((amount) => ({
      label: formatBareAmount(amount),
      amount,
    })),
  ];

  if (chips.length === 0) return null;

  return (
    <Box sx={ROW_SX}>
      {chips.map(({ label, amount }) => {
        const active = Math.round(amount * 100) === Math.round(value * 100);
        return (
          <ButtonBase
            key={label}
            onClick={() => onSelect(amount)}
            aria-pressed={active}
            sx={active ? CHIP_ACTIVE_SX : CHIP_SX}
          >
            {label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export const QuickAmountChips = memo(QuickAmountChipsComponent);
