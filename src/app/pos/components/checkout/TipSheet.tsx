"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { BottomSheet } from "@/app/pos/components/checkout/BottomSheet";
import { ReceivedAmountField } from "@/app/pos/components/checkout/ReceivedAmountField";
import { AmountKeypadSheet } from "@/app/pos/components/checkout/AmountKeypadSheet";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { tipTotalFromAmounts, type TipAmounts } from "@/app/pos/utils/tipMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface TipSheetProps {
  open: boolean;
  /** Every currency the business takes — the tip need not be in the one paid. */
  currencies: string[];
  /** Amounts currently committed, so reopening resumes rather than resets. */
  value: TipAmounts;
  rates: ITasaSnapshot;
  base: string;
  onClose: () => void;
  onConfirm: (amounts: TipAmounts) => void;
}

/**
 * «Propina»: one amount per currency, «Quitar» and «Listo». A customer
 * paying in USD may leave the tip in CUP, or split it across both, and
 * guessing the currency from the payment would put the money in the wrong
 * pile at closing.
 */

const TOTAL_SX = {
  px: 2,
  pb: 0.5,
  fontSize: "0.78125rem",
  fontWeight: 600,
  color: "primary.main",
  fontVariantNumeric: "tabular-nums",
} as const;

const FIELD_SX = { px: 2, pt: 1 } as const;

const toDraft = (amount: number) =>
  amount > 0
    ? Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2)
    : "";

export function TipSheet({
  open,
  currencies,
  value,
  rates,
  base,
  onClose,
  onConfirm,
}: TipSheetProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [keypadFor, setKeypadFor] = useState<string | null>(null);

  // The sheet is mounted for the whole sale, so its state has to be seeded
  // each time it opens; otherwise it would still hold the previous edit.
  useEffect(() => {
    if (!open) return;
    setDrafts(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, monto]) => monto > 0)
          .map(([moneda, monto]) => [moneda, toDraft(monto)]),
      ),
    );
  }, [open, value]);

  const parsed: TipAmounts = Object.fromEntries(
    Object.entries(drafts).map(([moneda, text]) => {
      const amount = Number(text);
      return [moneda, Number.isFinite(amount) && amount > 0 ? amount : 0];
    }),
  );
  const totalBase = tipTotalFromAmounts(parsed, rates, base);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Propina"
      primaryLabel="Listo"
      onPrimary={() => {
        onConfirm(parsed);
        onClose();
      }}
      secondaryLabel="Quitar"
      onSecondary={() => {
        setDrafts({});
        onConfirm({});
        onClose();
      }}
    >
      {totalBase > 0 && (
        <Typography sx={TOTAL_SX}>
          {formatMontoEnMoneda(totalBase, base)} en total
        </Typography>
      )}

      {currencies.map((moneda) => (
        <Box key={moneda} sx={FIELD_SX}>
          <ReceivedAmountField
            variant="secondary"
            draft={drafts[moneda] ?? ""}
            label={moneda}
            ariaLabel={`Propina en ${moneda}`}
            keypadOpen={keypadFor === moneda}
            onOpenKeypad={() => setKeypadFor(moneda)}
            onDraftChange={(next) =>
              setDrafts((prev) => ({ ...prev, [moneda]: next }))
            }
          />
        </Box>
      ))}

      {keypadFor && (
        <AmountKeypadSheet
          open
          currency={keypadFor}
          denominations={[]}
          value={parsed[keypadFor] ?? 0}
          label={`Propina ${keypadFor}`}
          pendingLabel=""
          onClose={() => setKeypadFor(null)}
          onConfirm={(amount) => {
            setDrafts((prev) => ({ ...prev, [keypadFor]: toDraft(amount) }));
            setKeypadFor(null);
          }}
        />
      )}
    </BottomSheet>
  );
}
