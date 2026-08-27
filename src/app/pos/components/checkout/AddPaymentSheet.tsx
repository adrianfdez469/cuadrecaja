"use client";

import { Box, ButtonBase, Drawer, Typography } from "@mui/material";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { PaymentLineKind } from "@/app/pos/utils/paymentMath";
import { shape } from "@/theme";

export interface PaymentOption {
  kind: PaymentLineKind;
  currency: string;
  /** What this option would have to cover, in its own currency. */
  suggested: number;
}

interface AddPaymentSheetProps {
  open: boolean;
  options: PaymentOption[];
  onClose: () => void;
  onPick: (option: PaymentOption) => void;
}

/**
 * One more form of payment on a mixed sale: the same sheet as the POS's own
 * actions, one 64px row per option with what it would still have to cover.
 */

const PAPER_SX = {
  borderTopLeftRadius: `${shape.radius.lg}px`,
  borderTopRightRadius: `${shape.radius.lg}px`,
  pb: "calc(8px + env(safe-area-inset-bottom))",
} as const;

const HEAD_SX = {
  display: "flex",
  justifyContent: "space-between",
  px: 2,
  pt: 2,
  pb: 1.5,
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "text.secondary",
} as const;

const ROW_SX = {
  width: "100%",
  minHeight: 64,
  px: 2,
  gap: 1.625,
  justifyContent: "space-between",
  textAlign: "left",
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

const TITLE_SX = {
  fontSize: "0.9375rem",
  fontWeight: 600,
  lineHeight: 1.25,
} as const;

const AMOUNT_SX = {
  flex: "0 0 auto",
  fontSize: "0.875rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
} as const;

export function AddPaymentSheet({
  open,
  options,
  onClose,
  onPick,
}: AddPaymentSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // The pinned cart sidebar and the mobile CartDrawer sit at
      // theme.zIndex.drawer + 1, and this Drawer portals to document.body
      // regardless of nesting, so it needs an explicit zIndex above them.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      PaperProps={{ sx: PAPER_SX }}
    >
      <Box sx={HEAD_SX}>
        <span>Agregar forma de pago</span>
        <span>{options.length}</span>
      </Box>

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
            sx={ROW_SX}
          >
            <Typography sx={TITLE_SX} noWrap>
              {option.kind === "cash" ? "Efectivo" : "Transferencia"}{" "}
              {option.currency}
            </Typography>
            <Typography sx={AMOUNT_SX}>
              {option.suggested > 0
                ? formatMontoEnMoneda(option.suggested, option.currency)
                : "Cubierto"}
            </Typography>
          </ButtonBase>
        ))
      )}
    </Drawer>
  );
}
