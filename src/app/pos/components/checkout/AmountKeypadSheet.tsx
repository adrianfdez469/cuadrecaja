"use client";

import { memo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { BottomSheet } from "@/app/pos/components/checkout/BottomSheet";
import {
  InlineKeypad,
  type KeypadKey,
  type KeypadTab,
} from "@/app/pos/components/checkout/InlineKeypad";
import { breakdownGreedy, sumBills } from "@/app/pos/utils/billMath";
import { formatNumberWith } from "@/utils/numberFormat";

interface AmountKeypadSheetProps {
  open: boolean;
  /** Currency code shown beside the figure. */
  currency: string;
  /** Active denominations for this currency; empty hides the bills tab. */
  denominations: number[];
  /** Amount the field currently holds. */
  value: number;
  /** e.g. «Efectivo CUP» */
  label: string;
  /** e.g. «Falta 1.250,00 CUP» */
  pendingLabel: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

/**
 * The keypad a touch device gets when the amount is tapped: a sheet with
 * the figure at the top, the keys of the POS's own pad and — where the
 * currency has bills configured — the tally of bills received. A physical
 * keyboard never opens this; it types straight into the field.
 */

const GROUPED: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

const HEAD_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  px: 2,
  fontSize: "0.71875rem",
  color: "text.secondary",
} as const;

const FIGURE_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  mx: 2,
  mt: 0.5,
  pb: 0.75,
  borderBottom: "2px solid",
  borderColor: "primary.main",
} as const;

const toDraft = (amount: number) =>
  amount > 0
    ? Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2)
    : "";

function formatDraft(draft: string): string {
  if (draft === "") return "0";
  const [whole, decimals] = draft.split(".");
  const grouped = formatNumberWith(Number(whole || 0), GROUPED);
  return decimals === undefined ? grouped : `${grouped},${decimals}`;
}

function AmountKeypadSheetComponent({
  open,
  currency,
  denominations,
  value,
  label,
  pendingLabel,
  onClose,
  onConfirm,
}: AmountKeypadSheetProps) {
  const minDenomination =
    denominations.length > 0 ? Math.min(...denominations) : 0.01;
  const allowsDecimals = minDenomination < 1;

  const [tab, setTab] = useState<KeypadTab>("keys");
  const [draft, setDraft] = useState("");
  const [bills, setBills] = useState<number[]>([]);
  // A fresh entry replaces the preloaded value instead of appending to it.
  const [pristine, setPristine] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTab("keys");
    setDraft(toDraft(value));
    setBills([]);
    setPristine(true);
    // Only on open: a `value` resync while the sheet is open must not wipe
    // an in-progress draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const usingBills = tab === "bills" && bills.length > 0;
  const amount = usingBills ? sumBills(bills) : Number(draft || 0);

  const handleKey = (key: KeypadKey) => {
    const current = pristine ? "" : draft;
    setPristine(false);
    if (key === "backspace") {
      setDraft(current.slice(0, -1));
      return;
    }
    if (key === ",") {
      if (!allowsDecimals || current.includes(".")) return;
      setDraft(`${current || "0"}.`);
      return;
    }
    setDraft(`${current}${key}`);
  };

  const handleTab = (next: KeypadTab) => {
    if (next === tab) return;
    if (next === "bills") {
      setBills(breakdownGreedy(Number(draft || 0), denominations) ?? []);
    } else if (bills.length > 0) {
      setDraft(toDraft(sumBills(bills)));
      setPristine(true);
    }
    setTab(next);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={label}
      primaryLabel="Listo"
      onPrimary={() => onConfirm(amount)}
    >
      <Box sx={HEAD_SX}>
        <span>{currency}</span>
        <span>{pendingLabel}</span>
      </Box>
      <Box sx={FIGURE_SX}>
        <Typography
          sx={{
            fontSize: "1.875rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {usingBills
            ? formatNumberWith(sumBills(bills), GROUPED)
            : formatDraft(draft)}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.8125rem",
            color: "text.secondary",
            fontWeight: 600,
          }}
        >
          {currency}
        </Typography>
      </Box>
      <InlineKeypad
        allowsDecimals={allowsDecimals}
        denominations={denominations}
        tab={tab}
        onTabChange={handleTab}
        onPress={handleKey}
        bills={bills}
        onBillsChange={setBills}
      />
    </BottomSheet>
  );
}

export const AmountKeypadSheet = memo(AmountKeypadSheetComponent);
