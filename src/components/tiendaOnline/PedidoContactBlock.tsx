"use client";

import { Stack, Typography } from "@mui/material";

import { TIENDA_ONLINE_ORDER_COPY } from "@/components/tiendaOnline/orderPresentation";
import { PedidoFieldRow } from "@/components/tiendaOnline/PedidoFieldRow";
import type { ITiendaOnlineOrder } from "@/schemas/tiendaOnline";

export interface PedidoContactBlockProps {
  order: ITiendaOnlineOrder;
}

/**
 * Who the buyer is, as selectable text and WITHOUT links: contacting them —
 * WhatsApp, `tel:`, `mailto:` — belongs to F-012.
 *
 * When all four fields are empty the block draws ONE sentence instead of four
 * dashes: four dashes in a row read as a broken screen, a sentence reads as a
 * fact.
 *
 * `contactAddress` decides nothing. Reading it as «this order is a delivery, so
 * the shipping…» is one of the shapes of the shortcut acceptance criterion 4
 * exists to break.
 */
export function PedidoContactBlock({ order }: Readonly<PedidoContactBlockProps>) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: TIENDA_ONLINE_ORDER_COPY.labelNombre, value: order.contactName },
    { label: TIENDA_ONLINE_ORDER_COPY.labelTelefono, value: order.contactPhone },
    { label: TIENDA_ONLINE_ORDER_COPY.labelCorreo, value: order.contactEmail },
    {
      label: TIENDA_ONLINE_ORDER_COPY.labelDireccion,
      value: order.contactAddress,
    },
  ];

  if (rows.every((row) => row.value === null)) {
    return (
      <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
        {TIENDA_ONLINE_ORDER_COPY.sinContacto}
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {rows.map((row) => (
        <PedidoFieldRow key={row.label} label={row.label}>
          {row.value === null ? (
            <Typography
              component="span"
              variant="body2"
              sx={{ color: "semantic.text.disabled" }}
            >
              {TIENDA_ONLINE_ORDER_COPY.contactoVacio}
            </Typography>
          ) : (
            row.value
          )}
        </PedidoFieldRow>
      ))}
    </Stack>
  );
}

export default PedidoContactBlock;
