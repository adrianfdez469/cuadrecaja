"use client";

import { Box } from "@mui/material";
import { formatMontoEnMoneda } from "@/utils/formatters";

interface UndeliverableChangeNoteProps {
  /** The overpayment left over, in base currency. */
  amount: number;
  currency: string;
}

/**
 * Says why there is no change to hand back on an overpayment.
 *
 * The customer covered a 2,75 sale with 3 because no bill is smaller than 1,
 * so the 0,25 owed back cannot be handed over in any denomination and stays
 * in the drawer — where the cash count expects it. Without this line the
 * cashier only sees the green block vanish and has no way to tell that from
 * an exact payment.
 *
 * Deliberately quiet: it states a fact, it is not an error and needs no
 * action, so it gets neither the red of «Falta por cubrir» nor the green of
 * the change.
 */

const NOTE_SX = {
  mx: 2,
  mt: 1.5,
  fontSize: "0.75rem",
  color: "text.secondary",
  fontVariantNumeric: "tabular-nums",
} as const;

export function UndeliverableChangeNote({
  amount,
  currency,
}: UndeliverableChangeNoteProps) {
  return (
    <Box sx={NOTE_SX} role="status">
      Sin vuelto entregable · {formatMontoEnMoneda(amount, currency)} quedan en
      caja
    </Box>
  );
}
