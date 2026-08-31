"use client";

import { Box, ButtonBase } from "@mui/material";
import {
  BottomSheet,
  SHEET_ROW_SX,
  SheetRadio,
} from "@/app/pos/components/checkout/BottomSheet";
import { formatMontoEnMoneda } from "@/utils/formatters";

export interface CurrencyChoice {
  code: string;
  /** What is owed, expressed in this currency. */
  amount: number;
}

interface CurrencySheetProps {
  open: boolean;
  choices: CurrencyChoice[];
  selected: string;
  onClose: () => void;
  onSelect: (currency: string) => void;
}

/**
 * «Moneda del pago»: the currencies this card can be paid in, each with the
 * amount owed already converted, so the cashier picks by what the customer
 * is holding rather than by a code. Replaces the small dropdown the chip
 * used to open.
 */

const NAME_SX = { fontWeight: 600 } as const;

const AMOUNT_SX = {
  ml: "auto",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
} as const;

export function CurrencySheet({
  open,
  choices,
  selected,
  onClose,
  onSelect,
}: CurrencySheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Moneda del pago">
      <Box sx={{ mt: 0.75 }}>
        {choices.map((choice) => (
          <ButtonBase
            key={choice.code}
            role="radio"
            aria-checked={choice.code === selected}
            onClick={() => onSelect(choice.code)}
            sx={SHEET_ROW_SX}
          >
            <SheetRadio on={choice.code === selected} />
            <Box component="span" sx={NAME_SX}>
              {choice.code}
            </Box>
            <Box component="span" sx={AMOUNT_SX}>
              {formatMontoEnMoneda(choice.amount, choice.code)}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </BottomSheet>
  );
}
