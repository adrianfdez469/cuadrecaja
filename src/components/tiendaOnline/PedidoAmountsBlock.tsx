"use client";

import { Stack } from "@mui/material";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderAmount,
  isZeroAmount,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoFieldRow } from "@/components/tiendaOnline/PedidoFieldRow";
import { TIENDA_ONLINE_ORDER_AMOUNT_KIND } from "@/constants/tiendaOnline";
import type { ITiendaOnlineOrderAmounts } from "@/schemas/tiendaOnline";

export interface PedidoAmountsBlockProps {
  amounts: ITiendaOnlineOrderAmounts;
  currencyCode: string;
}

/**
 * Subtotal, discount, delivery and total of one order.
 *
 * The delivery row and the total row branch on `amounts.kind` and on nothing
 * else. With PENDING_QUOTE there is no `deliveryFee` key to print and no `total`
 * key to call final: the row says `Por cotizar` and the total is labelled
 * `Total parcial`.
 *
 * The discount row carries no injected sign: its label already says what it
 * does, and fabricating a `-` in front of an amount whose sign the contract does
 * not fix is how a screen ends up printing `--150,00`.
 */
export function PedidoAmountsBlock({
  amounts,
  currencyCode,
}: Readonly<PedidoAmountsBlockProps>) {
  const quoted = amounts.kind === TIENDA_ONLINE_ORDER_AMOUNT_KIND.quoted;

  return (
    <Stack spacing={1}>
      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelSubtotal}>
        {formatOrderAmount(amounts.subtotal, currencyCode)}
      </PedidoFieldRow>

      {!isZeroAmount(amounts.discountTotal) && (
        <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelDescuento}>
          {formatOrderAmount(amounts.discountTotal, currencyCode)}
        </PedidoFieldRow>
      )}

      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelEnvio}>
        {!quoted
          ? TIENDA_ONLINE_ORDER_COPY.envioPorCotizarValue
          : isZeroAmount(amounts.deliveryFee)
            ? TIENDA_ONLINE_ORDER_COPY.envioGratisValue
            : formatOrderAmount(amounts.deliveryFee, currencyCode)}
      </PedidoFieldRow>

      {quoted ? (
        <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelTotal} emphasis>
          {formatOrderAmount(amounts.total, currencyCode)}
        </PedidoFieldRow>
      ) : (
        <PedidoFieldRow
          label={TIENDA_ONLINE_ORDER_COPY.labelTotalParcial}
          emphasis
        >
          {formatOrderAmount(amounts.partialTotal, currencyCode)}
        </PedidoFieldRow>
      )}
    </Stack>
  );
}

export default PedidoAmountsBlock;
