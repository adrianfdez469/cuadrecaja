"use client";

import { Box } from "@mui/material";
import { AdjustmentRow } from "@/app/pos/components/checkout/AdjustmentRow";
import { PaymentMethodTile } from "@/app/pos/components/checkout/PaymentMethodTile";
import { PosListHeading } from "@/app/pos/components/PosListHeading";
import { formatAmount } from "@/utils/numberFormat";
import type { PaymentLineKind } from "@/app/pos/utils/paymentMath";

export interface PaymentMethod {
  kind: PaymentLineKind | "mixed";
  currency?: string;
  title: string;
  hint: string;
}

interface PaymentMethodBodyProps {
  discountTotal: number;
  tipTotal: number;
  base: string;
  onOpenTip: () => void;
  methods: PaymentMethod[];
  onPick: (method: PaymentMethod) => void;
}

/**
 * The checkout's first state: the adjustments of the sale as two rows, and
 * the forms of payment as tiles. Nothing is chosen yet; the bar below says
 * so and waits.
 */

const GROUP_HEADING_SX = {
  px: 2,
  pt: 1.75,
  pb: 0.5,
  letterSpacing: ".16em",
} as const;

const TILES_SX = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1.125,
  px: 2,
  pt: 1,
  pb: 2,
} as const;

export function AdjustmentRows({
  discountTotal,
  tipTotal,
  base,
  onOpenTip,
}: Pick<
  PaymentMethodBodyProps,
  "discountTotal" | "tipTotal" | "base" | "onOpenTip"
>) {
  return (
    <>
      <AdjustmentRow
        title="Descuento"
        hint="Código de descuento"
        value={
          discountTotal > 0 ? `−${formatAmount(discountTotal)}` : "Ninguno"
        }
        valueCode={discountTotal > 0 ? base : undefined}
        active={discountTotal > 0}
      />
      <AdjustmentRow
        title="Propina"
        hint="Importe libre, se suma al total"
        value={tipTotal > 0 ? `+${formatAmount(tipTotal)}` : "Ninguna"}
        valueCode={tipTotal > 0 ? base : undefined}
        active={tipTotal > 0}
        onClick={onOpenTip}
      />
    </>
  );
}

export function PaymentMethodBody({
  discountTotal,
  tipTotal,
  base,
  onOpenTip,
  methods,
  onPick,
}: PaymentMethodBodyProps) {
  return (
    <Box>
      <PosListHeading sx={GROUP_HEADING_SX}>Ajustes de la venta</PosListHeading>
      <AdjustmentRows
        discountTotal={discountTotal}
        tipTotal={tipTotal}
        base={base}
        onOpenTip={onOpenTip}
      />

      <PosListHeading sx={GROUP_HEADING_SX}>Forma de pago</PosListHeading>
      <Box sx={TILES_SX}>
        {methods.map((method) => (
          <PaymentMethodTile
            key={`${method.kind}-${method.currency ?? ""}`}
            title={method.title}
            hint={method.hint}
            onClick={() => onPick(method)}
          />
        ))}
      </Box>
    </Box>
  );
}
