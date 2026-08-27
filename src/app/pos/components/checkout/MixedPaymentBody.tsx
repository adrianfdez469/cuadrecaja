"use client";

import type { ComponentProps } from "react";
import { Box, ButtonBase } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { PaymentLineRow } from "@/app/pos/components/checkout/PaymentLineRow";
import { ChangeBlock } from "@/app/pos/components/checkout/ChangeBlock";
import { MissingBlock } from "@/app/pos/components/checkout/MissingBlock";
import { AdjustmentRows } from "@/app/pos/components/checkout/PaymentMethodBody";
import { PosListHeading } from "@/app/pos/components/PosListHeading";

type ChangeBlockProps = ComponentProps<typeof ChangeBlock>;

export interface MixedLine {
  id: string;
  title: string;
  hint: string;
  amountBase: number;
}

interface MixedPaymentBodyProps {
  lines: MixedLine[];
  onOpenLine: (id: string) => void;
  onRemoveLine: (id: string) => void;
  /** There is still a form of payment to offer. */
  canAdd: boolean;
  onAdd: () => void;
  missingAmountBase: number | null;
  change: ChangeBlockProps | null;
  discountTotal: number;
  tipTotal: number;
  base: string;
  onOpenTip: () => void;
}

/**
 * Two or more forms of payment: the lines taken so far, the way to add one,
 * what is still missing in red, and the adjustments applied. The screen
 * keeps the count and does not let the sale confirm until the difference
 * reaches zero.
 */

const GROUP_HEADING_SX = {
  px: 2,
  pt: 1.75,
  pb: 0.5,
  letterSpacing: ".16em",
} as const;

const ADD_SX = {
  width: "100%",
  minHeight: 56,
  px: 2,
  gap: 1.25,
  justifyContent: "flex-start",
  borderTop: "1px solid",
  borderColor: "divider",
  color: "primary.main",
  fontSize: "0.9375rem",
  fontWeight: 600,
} as const;

const FOOT_SX = { pb: 2 } as const;

export function MixedPaymentBody({
  lines,
  onOpenLine,
  onRemoveLine,
  canAdd,
  onAdd,
  missingAmountBase,
  change,
  discountTotal,
  tipTotal,
  base,
  onOpenTip,
}: MixedPaymentBodyProps) {
  return (
    <Box>
      <PosListHeading sx={GROUP_HEADING_SX}>Formas de pago</PosListHeading>
      {lines.map((line) => (
        <PaymentLineRow
          key={line.id}
          title={line.title}
          hint={line.hint}
          amountBase={line.amountBase}
          onOpen={() => onOpenLine(line.id)}
          onRemove={() => onRemoveLine(line.id)}
        />
      ))}
      {canAdd && (
        <ButtonBase onClick={onAdd} sx={ADD_SX}>
          <AddIcon fontSize="small" />
          Agregar forma de pago
        </ButtonBase>
      )}

      {missingAmountBase !== null && (
        <MissingBlock amount={missingAmountBase} currency={base} />
      )}
      {change && <ChangeBlock {...change} />}

      <PosListHeading sx={GROUP_HEADING_SX}>Ajustes de la venta</PosListHeading>
      <Box sx={FOOT_SX}>
        <AdjustmentRows
          discountTotal={discountTotal}
          tipTotal={tipTotal}
          base={base}
          onOpenTip={onOpenTip}
        />
      </Box>
    </Box>
  );
}
