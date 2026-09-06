"use client";

import { Stack, Typography } from "@mui/material";

import {
  TIENDA_ONLINE_ORDER_COPY,
  cancelledByLabel,
  formatOrderDateLong,
  orderStatusPresentation,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoFieldRow } from "@/components/tiendaOnline/PedidoFieldRow";
import type { ITiendaOnlineOrder } from "@/schemas/tiendaOnline";

export interface PedidoMetaBlockProps {
  order: ITiendaOnlineOrder;
}

/**
 * The part of an order that is almost never consulted: the local, the two dates,
 * the state as text and who cancelled it.
 *
 * The two dates are two different facts and both are shown, each under its own
 * label. `qabCreatedAt` is when the buyer placed the order; `createdAt` is when
 * this POS received it, and it is what sorts the listing. One is never painted
 * under the other's label, and `Sin dato` is what shows when the first one is
 * missing — not the second one in disguise.
 *
 * The `Cancelado por` row only exists when there is a value: a row that says
 * «nobody cancelled this» is a row of noise.
 */
export function PedidoMetaBlock({ order }: Readonly<PedidoMetaBlockProps>) {
  const estado = orderStatusPresentation(order.status);

  return (
    <Stack spacing={1}>
      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelLocal}>
        {order.tiendaNombre}
      </PedidoFieldRow>

      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelFechaPedido}>
        {formatOrderDateLong(order.qabCreatedAt)}
      </PedidoFieldRow>

      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelRecibidoPos}>
        {formatOrderDateLong(order.createdAt)}
      </PedidoFieldRow>

      <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelEstado}>
        {estado.label}
      </PedidoFieldRow>

      {/* Only in the detail, and only for a status this module cannot translate:
          the listing would repeat the explanation on every row. */}
      {!estado.known && (
        <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
          {TIENDA_ONLINE_ORDER_COPY.statusUnknownNote}
        </Typography>
      )}

      {order.cancelledBy !== null && (
        <PedidoFieldRow label={TIENDA_ONLINE_ORDER_COPY.labelCanceladoPor}>
          {cancelledByLabel(order.cancelledBy)}
        </PedidoFieldRow>
      )}
    </Stack>
  );
}

export default PedidoMetaBlock;
