"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import {
  BottomSheet,
  SHEET_ROW_SX,
} from "@/app/pos/components/checkout/BottomSheet";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { PaymentLineKind } from "@/app/pos/utils/paymentMath";

export interface PaymentOption {
  kind: PaymentLineKind;
  currency: string;
  /** Pending amount expressed in this option's currency. */
  suggested: number;
  /** Base equivalent of `suggested`, or null when this is the base currency. */
  equivalentBase: number | null;
  /** The whole amount owed in this currency — what the row shows once the
   * payment is already covered and there is nothing left to suggest. */
  owed: number;
  owedBase: number | null;
}

interface AddPaymentSheetProps {
  open: boolean;
  options: PaymentOption[];
  base: string;
  /** The payment already reaches the total: the sheet says so in green. */
  covered: boolean;
  onClose: () => void;
  onPick: (option: PaymentOption) => void;
}

/**
 * One more currency or method for the sale: a 56px row per option with
 * what it would have to cover, already converted. When the payment already
 * reaches the total, the sheet says so in green instead of on every row.
 */

const NAME_SX = { fontWeight: 600 } as const;

const AMOUNT_SX = {
  ml: "auto",
  textAlign: "right",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.25,
} as const;

const EQUIVALENT_SX = {
  display: "block",
  fontSize: "0.6875rem",
  fontWeight: 400,
  color: "text.secondary",
} as const;

const COVERED_SX = {
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  minHeight: 48,
  px: 2,
  borderTop: "1px solid",
  borderColor: "divider",
  color: "semantic.hue.positive.main",
  fontSize: "0.84375rem",
  fontWeight: 600,
} as const;

export function AddPaymentSheet({
  open,
  options,
  base,
  covered,
  onClose,
  onPick,
}: AddPaymentSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Agregar forma de pago">
      <Box sx={{ mt: 0.75 }}>
        {options.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 2 }}
          >
            No hay otras formas de pago configuradas para este negocio.
          </Typography>
        ) : (
          options.map((option) => (
            <ButtonBase
              key={`${option.kind}-${option.currency}`}
              onClick={() => onPick(option)}
              sx={SHEET_ROW_SX}
            >
              <Box component="span" sx={NAME_SX}>
                {option.kind === "cash" ? "Efectivo" : "Transferencia"}{" "}
                {option.currency}
              </Box>
              <Box component="span" sx={AMOUNT_SX}>
                {formatMontoEnMoneda(
                  option.suggested > 0 ? option.suggested : option.owed,
                  option.currency,
                )}
                {(option.suggested > 0
                  ? option.equivalentBase
                  : option.owedBase) !== null && (
                  <Box component="span" sx={EQUIVALENT_SX}>
                    ≈{" "}
                    {formatMontoEnMoneda(
                      (option.suggested > 0
                        ? option.equivalentBase
                        : option.owedBase) as number,
                      base,
                    )}
                  </Box>
                )}
              </Box>
            </ButtonBase>
          ))
        )}
        {covered && options.length > 0 && (
          <Box sx={COVERED_SX}>
            <CheckIcon fontSize="small" />
            Ya está cubierto el total
          </Box>
        )}
      </Box>
    </BottomSheet>
  );
}
