"use client";

import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatAmount } from "@/utils/numberFormat";

interface PaymentLineRowProps {
  /** «Efectivo CUP», «Transferencia USD». */
  title: string;
  /** The amount in its own currency, and where a transfer goes. */
  hint: string;
  /** What this line covers, in the base currency. */
  amountBase: number;
  onOpen: () => void;
  onRemove: () => void;
}

/**
 * One form of payment already taken, on a mixed payment: a 60px row with
 * the method, its amount in its own currency, what that covers in the base
 * currency, and a grey «✕» of 44px to take it back. No red per line — the
 * palette's loudest colour is kept for what is still missing.
 */

const ROW_SX = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  minHeight: 60,
  pl: 2,
  pr: 0.5,
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

const BODY_SX = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  minHeight: 60,
  textAlign: "left",
} as const;

const TEXT_SX = { flex: 1, minWidth: 0 } as const;

const TITLE_SX = {
  fontSize: "0.90625rem",
  fontWeight: 600,
  lineHeight: 1.25,
} as const;

const HINT_SX = {
  fontSize: "0.71875rem",
  color: "text.secondary",
  lineHeight: 1.3,
  fontVariantNumeric: "tabular-nums",
} as const;

const AMOUNT_SX = {
  flex: "0 0 auto",
  fontSize: "1rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
} as const;

const REMOVE_SX = {
  flex: "0 0 44px",
  width: 44,
  height: 44,
  color: "text.secondary",
} as const;

export function PaymentLineRow({
  title,
  hint,
  amountBase,
  onOpen,
  onRemove,
}: PaymentLineRowProps) {
  return (
    <Box sx={ROW_SX}>
      <ButtonBase onClick={onOpen} sx={BODY_SX} aria-label={`Editar ${title}`}>
        <Box sx={TEXT_SX}>
          <Typography sx={TITLE_SX} noWrap>
            {title}
          </Typography>
          <Typography sx={HINT_SX} noWrap>
            {hint}
          </Typography>
        </Box>
        <Typography sx={AMOUNT_SX}>{formatAmount(amountBase)}</Typography>
      </ButtonBase>
      <IconButton
        onClick={onRemove}
        aria-label={`Quitar ${title}`}
        sx={REMOVE_SX}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
