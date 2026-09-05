"use client";

import { Stack } from "@mui/material";

import { StatusPill } from "@/components/StatusPill";
import {
  orderStatusPresentation,
  presentTiendaOnlineDelivery,
} from "@/components/tiendaOnline/orderPresentation";
import {
  TIENDA_ONLINE_DELIVERY_PRESENTATION,
  TIENDA_ONLINE_LABELS,
} from "@/constants/tiendaOnline";
import type { ITiendaOnlineOrderAmounts } from "@/schemas/tiendaOnline";

export interface PedidoEstadoPillsProps {
  status: string;
  amounts: ITiendaOnlineOrderAmounts;
}

/**
 * The status pill and the delivery pill of one order, in the one place that
 * decides what the pair looks like.
 *
 * Shared by the card, the table row and the detail header so that the same fact
 * does not take three shapes depending on where it is painted — the role
 * `ProductoPublicacionEstado` plays in F-006.
 *
 * A CHARGED delivery gets NO pill on purpose: it is the ordinary case, and its
 * amount is already the `Envío` row of the detail's amount block.
 */
export function PedidoEstadoPills({
  status,
  amounts,
}: Readonly<PedidoEstadoPillsProps>) {
  const estado = orderStatusPresentation(status);
  const envio = presentTiendaOnlineDelivery(amounts);

  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <StatusPill label={estado.label} hue={estado.hue} />
      {envio === TIENDA_ONLINE_DELIVERY_PRESENTATION.pendingQuote && (
        <StatusPill label={TIENDA_ONLINE_LABELS.envioPorCotizar} hue="caution" />
      )}
      {envio === TIENDA_ONLINE_DELIVERY_PRESENTATION.free && (
        <StatusPill label={TIENDA_ONLINE_LABELS.envioGratis} hue="positive" />
      )}
    </Stack>
  );
}

export default PedidoEstadoPills;
