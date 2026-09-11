"use client";

import type { JSX } from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { CREDIT_CHECKOUT_COPY, CREDIT_DOM } from "@/constants/creditoVenta";
import { shape, touch } from "@/theme";

export interface ICreditBlockProps {
  /** The debt this sale is going to leave, in base currency. */
  amount: number;
  currency: string;
  clienteNombre: string;
  /**
   * The customer does not exist yet: an offline sale naming someone new, whose row is written
   * when the sale syncs. The block says so; without it the cashier who lends to a stranger with
   * no connection has nowhere to see that the customer is not there yet.
   *
   * The caller computes it as `creditSelection.clienteId === null`. Optional so that omitting it
   * simply drops the line rather than changing anything else.
   */
  clienteEsNuevo?: boolean;
  /** Reopens the customer selector. */
  onChangeCliente: () => void;
  /** Turns credit off and goes back to an ordinary sale. */
  onClear: () => void;
}

/**
 * What this sale leaves as a debt: sibling of `MissingBlock` and `ChangeBlock`, in the same
 * place of the tree and with the same outer box.
 *
 * It is NOT red, and the distinction matters. The red of `MissingBlock` means "this sale
 * cannot be closed yet". A credit sale CAN be closed: there is no error, there is a debt.
 * Painting the two the same would tell the cashier they did something wrong. Nor is it
 * violet: `accent` is reserved for action and selection, and this block is not tappable as
 * a whole.
 *
 * It COMPUTES NOTHING: `amount` and `clienteEsNuevo` arrive already resolved (E-013).
 */

const BLOCK_SX = {
  mx: 2,
  mt: 1.5,
  px: 1.75,
  py: 1.5,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.caution.surface",
  border: "1px solid",
  borderColor: (theme: Theme) =>
    alpha(theme.palette.semantic.hue.caution.main, 0.25),
} as const;

const HEAD_SX = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 1,
} as const;

const LABEL_SX = {
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "semantic.hue.caution.main",
} as const;

const AMOUNT_SX = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "semantic.hue.caution.main",
  fontVariantNumeric: "tabular-nums",
} as const;

const ROW_SX = {
  mt: 1,
  display: "flex",
  alignItems: "center",
  gap: 0.75,
} as const;

const PICK_SX = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 1,
  minHeight: touch.min,
  textAlign: "left",
  borderRadius: `${shape.radius.sm}px`,
} as const;

const NOMBRE_SX = {
  flex: 1,
  minWidth: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "semantic.text.primary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const CHANGE_SX = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "semantic.hue.caution.main",
  whiteSpace: "nowrap",
} as const;

const CLEAR_SX = { color: "semantic.hue.caution.main" } as const;

const NUEVO_SX = { mt: 0.5, color: "semantic.text.secondary" } as const;

export function CreditBlock({
  amount,
  currency,
  clienteNombre,
  clienteEsNuevo,
  onChangeCliente,
  onClear,
}: Readonly<ICreditBlockProps>): JSX.Element {
  return (
    <Box sx={BLOCK_SX} role="status" className={CREDIT_DOM.block}>
      <Box sx={HEAD_SX}>
        <Box component="span" sx={LABEL_SX}>
          {CREDIT_CHECKOUT_COPY.blockTitle}
        </Box>
        <Box component="span" sx={AMOUNT_SX} className={CREDIT_DOM.blockAmount}>
          {formatMontoEnMoneda(amount, currency)}
        </Box>
      </Box>

      <Box sx={ROW_SX}>
        <ButtonBase
          className={CREDIT_DOM.blockPick}
          onClick={onChangeCliente}
          aria-label={CREDIT_CHECKOUT_COPY.blockChangeCliente}
          sx={PICK_SX}
        >
          <Box
            component="span"
            sx={NOMBRE_SX}
            className={CREDIT_DOM.blockCliente}
          >
            {clienteNombre}
          </Box>
          <Box component="span" sx={CHANGE_SX}>
            {CREDIT_CHECKOUT_COPY.blockChangeCliente}
          </Box>
        </ButtonBase>
        <IconButton
          className={CREDIT_DOM.blockClear}
          onClick={onClear}
          aria-label={CREDIT_CHECKOUT_COPY.blockClearLabel}
          sx={CLEAR_SX}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {clienteEsNuevo && (
        <Typography
          variant="body2"
          className={CREDIT_DOM.blockClienteNuevo}
          sx={NUEVO_SX}
        >
          {CREDIT_CHECKOUT_COPY.blockClienteNuevo}
        </Typography>
      )}
    </Box>
  );
}
