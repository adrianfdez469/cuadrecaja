"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { StatusPill } from "@/components/StatusPill";
import {
  SALES_CUTOFF_DEFERRED_PILL,
  SALES_CUTOFF_ROW_HEIGHT,
} from "@/constants/cierre";
import { formatTimeShort } from "@/utils/formatters";
import type { IVenta } from "@/schemas/venta";

interface Props {
  venta: IVenta;
  /** Whether this sale is on the side the close takes. */
  included: boolean;
  onSelect: () => void;
}

/**
 * One sale in the cutoff dialog, and the gesture that moves the cut: tapping it
 * means "close up to here" — this sale and every earlier one enter, the later
 * ones are deferred. The boundary is inclusive, so the sale that is tapped is
 * INSIDE; to leave it out the operator taps the one before it.
 *
 * The whole row is a single button. It borrows the anatomy of the sale card of
 * `/ventas` but not its shell: that one opens a detail and nests two icon
 * buttons, and here the row's only effect is moving the cut.
 *
 * The two sides are told apart by three carriers, not by colour alone: the
 * surface, the ink, and — on the deferred side — a rail plus a pill.
 */
export default function SalesCutoffSaleRow({
  venta,
  included,
  onSelect,
}: Readonly<Props>) {
  return (
    <ButtonBase
      onClick={onSelect}
      sx={{
        width: "100%",
        minHeight: SALES_CUTOFF_ROW_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        textAlign: "left",
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: included
          ? "semantic.surface.raised"
          : "semantic.surface.sunken",
        borderLeft: 3,
        borderLeftStyle: "solid",
        borderLeftColor: included ? "transparent" : "semantic.hue.info.main",
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            color: included
              ? "semantic.text.primary"
              : "semantic.text.secondary",
          }}
        >
          {formatTimeShort(venta.createdAt)}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "semantic.text.secondary",
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {`#${venta.id.slice(-8)} · ${venta.usuario?.nombre ?? "Sin usuario"}`}
        </Typography>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0.5,
        }}
      >
        {/* `venta.total` already comes in base currency, same as in /ventas. */}
        <MultiCurrencyAmount
          amount={venta.total}
          variant="compact"
          align="right"
          color={included ? "semantic.text.primary" : "semantic.text.secondary"}
        />
        {!included && (
          <StatusPill label={SALES_CUTOFF_DEFERRED_PILL} hue="info" />
        )}
      </Box>
    </ButtonBase>
  );
}
