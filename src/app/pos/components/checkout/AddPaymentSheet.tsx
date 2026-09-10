"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import {
  BottomSheet,
  SHEET_ROW_SX,
} from "@/app/pos/components/checkout/BottomSheet";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { CREDIT_CHECKOUT_COPY, CREDIT_DOM } from "@/constants/creditoVenta";
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
  /** What would go on credit if the cashier picked it, in base currency. */
  creditAmount: number;
  /**
   * Whether the row can be picked. `canSellOnCredit(amountDue)` in the caller — NOT
   * `creditAmount > 0`: a payment that already covers the total leaves creditAmount at zero and
   * the row still has to be pickable, because criterion 7 needs credit on BEFORE the overpayment.
   */
  creditEnabled: boolean;
  /** The customer already chosen, when credit is on. null = not on yet. */
  creditClienteNombre: string | null;
  onClose: () => void;
  onPick: (option: PaymentOption) => void;
  /** Opens the customer selector. Picking a customer is what turns credit on. */
  onPickCredit: () => void;
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

/**
 * The credit row's second line: what it is when credit is not on yet, the customer's name
 * once it is. `0.6875rem`, one line with an ellipsis.
 */
const CREDIT_HINT_SX = {
  display: "block",
  fontSize: "0.6875rem",
  color: "semantic.text.secondary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/** Same line, once a customer is chosen: the caution ink the credit block also wears. */
const CREDIT_HINT_CHOSEN_SX = {
  ...CREDIT_HINT_SX,
  color: "semantic.hue.caution.main",
} as const;

/** Line 1 of the credit row: same weight and size as «Efectivo CUP», on its own line. */
const CREDIT_NAME_SX = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.9375rem",
} as const;

/**
 * Blocked, the row stays exactly where it was — dimmed, not hidden — and its reason lives
 * OUTSIDE the dimmed row, as a sibling at full opacity. `opacity: 1` there is not
 * decoration: inheriting the dimming would leave the text at `semantic.text.disabled` over
 * white, which measures 2.78:1 and fails AA.
 */
const CREDIT_DISABLED_SX = {
  color: "semantic.text.disabled",
  opacity: 0.6,
  cursor: "default",
} as const;

const CREDIT_REASON_SX = {
  mt: 1,
  px: 2,
  opacity: 1,
  color: "semantic.text.secondary",
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
  creditAmount,
  creditEnabled,
  creditClienteNombre,
  onClose,
  onPick,
  onPickCredit,
}: AddPaymentSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Agregar forma de pago">
      <Box sx={{ mt: 0.75 }} className={CREDIT_DOM.paySheet}>
        {/* The paragraph «No hay otras formas de pago configuradas para este negocio» was
            removed: with the credit row always present the sheet is never empty and that
            branch is unreachable. NOTHING may look for that string after this feature
            (E-016). */}
        {options.map((option) => (
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
        ))}

        {/* The credit row: ALWAYS the last one, after the options. No icon — no row of this
            sheet carries one, and giving one only to this row would take it off the grid.
            What tells it apart is its second line. No `≈` equivalence either: credit has no
            currency of its own, it is always the base one (ADR 0104). */}
        {creditEnabled ? (
          <ButtonBase
            className={CREDIT_DOM.addRow}
            onClick={onPickCredit}
            sx={SHEET_ROW_SX}
          >
            <Box component="span" sx={{ minWidth: 0, textAlign: "left" }}>
              <Box component="span" sx={{ ...NAME_SX, ...CREDIT_NAME_SX }}>
                {CREDIT_CHECKOUT_COPY.addPaymentRow}
              </Box>
              <Box
                component="span"
                className={CREDIT_DOM.addRowCliente}
                sx={
                  creditClienteNombre
                    ? CREDIT_HINT_CHOSEN_SX
                    : CREDIT_HINT_SX
                }
              >
                {creditClienteNombre ??
                  CREDIT_CHECKOUT_COPY.addPaymentRowHint}
              </Box>
            </Box>
            <Box component="span" sx={AMOUNT_SX}>
              {formatMontoEnMoneda(creditAmount, base)}
            </Box>
          </ButtonBase>
        ) : (
          <Box>
            <Box
              className={CREDIT_DOM.addRow}
              aria-disabled="true"
              sx={{ ...SHEET_ROW_SX, ...CREDIT_DISABLED_SX }}
            >
              <Box component="span" sx={{ ...NAME_SX, ...CREDIT_NAME_SX }}>
                {CREDIT_CHECKOUT_COPY.addPaymentRow}
              </Box>
              <Box component="span" sx={AMOUNT_SX}>
                {formatMontoEnMoneda(creditAmount, base)}
              </Box>
            </Box>
            <Typography
              variant="body2"
              className={CREDIT_DOM.addRowReason}
              sx={CREDIT_REASON_SX}
            >
              {CREDIT_CHECKOUT_COPY.addPaymentRowBlocked}
            </Typography>
          </Box>
        )}

        {covered && (
          <Box sx={COVERED_SX}>
            <CheckIcon fontSize="small" />
            Ya está cubierto el total
          </Box>
        )}
      </Box>
    </BottomSheet>
  );
}
