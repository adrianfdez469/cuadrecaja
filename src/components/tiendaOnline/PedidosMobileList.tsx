"use client";

import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import NextLink from "next/link";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderDateShort,
  lineCountLabel,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoEstadoPills } from "@/components/tiendaOnline/PedidoEstadoPills";
import { PedidoImporte } from "@/components/tiendaOnline/PedidoImporte";
import { TIENDA_ONLINE_ROUTES } from "@/constants/tiendaOnline";
import type { ITiendaOnlineOrderListItem } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";

export interface PedidosMobileListProps {
  orders: ITiendaOnlineOrderListItem[];
}

/** Width of the "unattended" marker, and the ONE place it is written. */
const UNATTENDED_MARKER_WIDTH = "3px";

/**
 * The order list below 900 px: one outlined card per order, one column on a
 * phone and two from 600 px.
 *
 * The whole card is a single link to the detail, unlike the product card of
 * F-006 where a stray tap would publish something to the public: here the only
 * possible effect is navigating, which the back button undoes.
 *
 * The card carries no other control: F-011 has no action to offer.
 *
 * The left edge is the "unattended" marker. It replaces the card's own left
 * border rather than sitting next to it, so the marker is the only thing that
 * decides how thick that edge is — and a row without it reads as unmarked
 * instead of as marked-but-thinner.
 */
export function PedidosMobileList({ orders }: Readonly<PedidosMobileListProps>) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
      }}
    >
      {orders.map((order) => (
        <Card
          key={order.id}
          variant="outlined"
          sx={{
            borderLeftStyle: "solid",
            borderLeftWidth: order.unattended ? UNATTENDED_MARKER_WIDTH : "0px",
            ...(order.unattended && {
              borderLeftColor: "semantic.hue.caution.main",
            }),
          }}
        >
          <CardActionArea
            component={NextLink}
            href={`${TIENDA_ONLINE_ROUTES.pedidos}/${order.id}`}
            sx={{ display: "block", p: 1.5, minHeight: touch.rowLarge }}
          >
            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: "semantic.text.primary",
                    overflowWrap: "anywhere",
                  }}
                >
                  {order.code}
                </Typography>
                <PedidoImporte
                  amounts={order.amounts}
                  currencyCode={order.currencyCode}
                />
              </Stack>

              <PedidoEstadoPills status={order.status} amounts={order.amounts} />

              <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
                {`${order.contactName ?? TIENDA_ONLINE_ORDER_COPY.sinNombre} · ${lineCountLabel(order.lineCount)}`}
              </Typography>

              <Typography
                sx={{ fontSize: "0.75rem", color: "semantic.text.secondary" }}
              >
                {`${order.tiendaNombre} · ${formatOrderDateShort(order.createdAt)}`}
              </Typography>
            </Stack>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}

export default PedidosMobileList;
