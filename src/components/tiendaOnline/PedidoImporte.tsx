"use client";

import { Box, Typography } from "@mui/material";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderAmount,
} from "@/components/tiendaOnline/orderPresentation";
import { TIENDA_ONLINE_ORDER_AMOUNT_KIND } from "@/constants/tiendaOnline";
import type { ITiendaOnlineOrderAmounts } from "@/schemas/tiendaOnline";

export interface PedidoImporteProps {
  amounts: ITiendaOnlineOrderAmounts;
  currencyCode: string;
}

/**
 * The single amount a listed order shows, and the word under it when that amount
 * is partial.
 *
 * The branch on `kind` lives HERE and nowhere else: the card and the table row
 * both mount this, so there is only one place that knows which key of the union
 * carries the number. `Parcial` is not a pill — a pill next to an amount
 * competes with the amount, and this word is an adjective of it.
 */
export function PedidoImporte({
  amounts,
  currencyCode,
}: Readonly<PedidoImporteProps>) {
  const partial = amounts.kind === TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote;
  const amount = partial ? amounts.partialTotal : amounts.total;

  return (
    <Box sx={{ textAlign: "right" }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          color: "semantic.text.primary",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatOrderAmount(amount, currencyCode)}
      </Typography>
      {partial && (
        <Typography
          sx={{ fontSize: "0.75rem", color: "semantic.hue.caution.main" }}
        >
          {TIENDA_ONLINE_ORDER_COPY.parcial}
        </Typography>
      )}
    </Box>
  );
}

export default PedidoImporte;
