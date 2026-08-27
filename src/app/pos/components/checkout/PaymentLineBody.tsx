"use client";

import { useState } from "react";
import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { ReceivedAmountField } from "@/app/pos/components/checkout/ReceivedAmountField";
import { QuickAmountChips } from "@/app/pos/components/checkout/QuickAmountChips";
import {
  InlineKeypad,
  type KeypadKey,
  type KeypadTab,
} from "@/app/pos/components/checkout/InlineKeypad";
import { ChangeBlock } from "@/app/pos/components/checkout/ChangeBlock";
import { MissingBlock } from "@/app/pos/components/checkout/MissingBlock";
import { breakdownGreedy, sumBills } from "@/app/pos/utils/billMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITransferDestination } from "@/schemas/transferDestination";
import type { ComponentProps } from "react";

type ChangeBlockProps = ComponentProps<typeof ChangeBlock>;

interface PaymentLineBodyProps {
  line: PaymentLine;
  denominations: number[];
  /** Smallest amount covering what is owed, and the roundings above it. */
  exact: number;
  suggestions: number[];
  onAmountChange: (amount: number) => void;
  transferDestinations: ITransferDestination[];
  onDestinationChange: (destinationId: string) => void;
  /** What is still not covered, in base — or null once it is. */
  missingAmountBase: number | null;
  base: string;
  /** The change block, once there is change to hand back. */
  change: ChangeBlockProps | null;
}

/**
 * Counting one form of payment: the amount received in a 64px field, the
 * roundings most likely to be handed over, the change as it is typed, and
 * the keypad drawn into the screen so nothing covers the change.
 */

const FIELD_WRAP_SX = { px: 2, pt: 1.25 } as const;

const DESTINATION_SX = {
  mt: 1.5,
  "& .MuiOutlinedInput-root": { minHeight: 44 },
} as const;

const KEYPAD_WRAP_SX = { pb: 2 } as const;

// Two decimals when there are any («11058.20»), none when there are none:
// what the cashier sees in the field is what the line holds.
const toDraft = (amount: number) =>
  amount > 0
    ? Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2)
    : "";

export function PaymentLineBody({
  line,
  denominations,
  exact,
  suggestions,
  onAmountChange,
  transferDestinations,
  onDestinationChange,
  missingAmountBase,
  base,
  change,
}: PaymentLineBodyProps) {
  const isCash = line.kind === "cash";
  const minDenomination =
    denominations.length > 0 ? Math.min(...denominations) : 0.01;
  // A transfer is not counted in bills: it can carry cents whatever the
  // denominations of its currency say.
  const allowsDecimals = !isCash || minDenomination < 1;

  // The text being typed, kept apart from the line's number: parsing on every
  // keystroke would erase a trailing comma the moment it is typed. It starts
  // pristine — the first key replaces the suggested amount instead of
  // appending to it, since "400" + "1234" is never what anyone meant.
  const [draft, setDraft] = useState(() => toDraft(line.amount));
  const [pristine, setPristine] = useState(true);
  const [tab, setTab] = useState<KeypadTab>("keys");
  const [bills, setBills] = useState<number[]>([]);

  const commit = (nextDraft: string) => {
    setDraft(nextDraft);
    const parsed = Number(nextDraft || 0);
    onAmountChange(Number.isFinite(parsed) ? parsed : 0);
  };

  const handleDraftChange = (nextDraft: string) => {
    setPristine(false);
    commit(nextDraft);
  };

  const handleKey = (key: KeypadKey) => {
    const current = pristine ? "" : draft;
    setPristine(false);
    if (key === "backspace") {
      commit(current.slice(0, -1));
      return;
    }
    if (key === ",") {
      if (!allowsDecimals || current.includes(".")) return;
      commit(`${current || "0"}.`);
      return;
    }
    commit(`${current}${key}`);
  };

  const handleChip = (amount: number) => {
    setPristine(true);
    setTab("keys");
    commit(toDraft(amount));
  };

  // To the bills tab the typed amount travels as a tally when the
  // denominations can build it; back to the keys it returns as a figure,
  // pristine again so the next key starts over.
  const handleTab = (next: KeypadTab) => {
    if (next === tab) return;
    if (next === "bills") {
      setBills(breakdownGreedy(Number(draft || 0), denominations) ?? []);
    } else {
      setPristine(true);
    }
    setTab(next);
  };

  const handleBills = (next: number[]) => {
    setBills(next);
    setPristine(true);
    commit(toDraft(sumBills(next)));
  };

  return (
    <Box>
      <Box sx={FIELD_WRAP_SX}>
        <ReceivedAmountField
          draft={draft}
          label={isCash ? "Recibido" : "Monto"}
          ariaLabel={`Monto en ${line.currency}`}
          onDraftChange={handleDraftChange}
        />
        <QuickAmountChips
          exact={exact}
          suggestions={isCash ? suggestions : []}
          value={line.amount}
          onSelect={handleChip}
        />

        {!isCash && transferDestinations.length > 1 && (
          <FormControl fullWidth size="small" sx={DESTINATION_SX}>
            <InputLabel>Destino</InputLabel>
            <Select
              label="Destino"
              value={line.transferDestinationId ?? ""}
              onChange={(event) => onDestinationChange(event.target.value)}
            >
              {transferDestinations.map((destination) => (
                <MenuItem key={destination.id} value={destination.id}>
                  {destination.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {missingAmountBase !== null && (
        <MissingBlock amount={missingAmountBase} currency={base} />
      )}
      {change && <ChangeBlock {...change} />}

      <Box sx={KEYPAD_WRAP_SX}>
        <InlineKeypad
          allowsDecimals={allowsDecimals}
          denominations={isCash ? denominations : []}
          tab={tab}
          onTabChange={handleTab}
          onPress={handleKey}
          bills={bills}
          onBillsChange={handleBills}
        />
      </Box>
    </Box>
  );
}
