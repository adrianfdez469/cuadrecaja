"use client";

import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

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

export interface PedidosTableProps {
  orders: ITiendaOnlineOrderListItem[];
}

/** The five columns, and the ONE place their widths are written. */
const RECIBIDO_WIDTH = 130;
const PEDIDO_WIDTH = 150;
const LOCAL_MIN_WIDTH = 170;
const ESTADO_WIDTH = 210;
const IMPORTE_WIDTH = 150;

/** Width of the "unattended" marker, carried by the first cell of the row. */
const UNATTENDED_MARKER_WIDTH = "3px";

/** One line with an ellipsis: free text the detail shows in full (§4.4). */
const ONE_LINE_ELLIPSIS = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/**
 * The order list from 900 px: a real table of five columns.
 *
 * `Recibido` is `createdAt` and not `qabCreatedAt`, and that is a decision:
 * `qabCreatedAt` is nullable and is not what orders the rows, so a list whose
 * only date column can be empty — and does not match the sort — reads as
 * unsorted. The detail shows both, each under its own label.
 *
 * The whole row navigates, and the `Pedido` cell carries a real link whose
 * accessible name is the code: the link is what makes the table operable with a
 * keyboard, the row click is the convenience.
 */
export function PedidosTable({ orders }: Readonly<PedidosTableProps>) {
  const router = useRouter();

  return (
    // The net, not the design: the width budget above never needs it.
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: RECIBIDO_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.columnRecibido}
            </TableCell>
            <TableCell sx={{ width: PEDIDO_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.columnPedido}
            </TableCell>
            <TableCell sx={{ minWidth: LOCAL_MIN_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.columnLocal}
            </TableCell>
            <TableCell sx={{ width: ESTADO_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.columnEstado}
            </TableCell>
            <TableCell align="right" sx={{ width: IMPORTE_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.columnImporte}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => {
            const href = `${TIENDA_ONLINE_ROUTES.pedidos}/${order.id}`;

            return (
              <TableRow
                key={order.id}
                hover
                onClick={() => router.push(href)}
                sx={{ cursor: "pointer", "& td": { height: touch.row } }}
              >
                <TableCell
                  sx={{
                    borderLeftStyle: "solid",
                    borderLeftWidth: order.unattended
                      ? UNATTENDED_MARKER_WIDTH
                      : "0px",
                    ...(order.unattended && {
                      borderLeftColor: "semantic.hue.caution.main",
                    }),
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary" }}
                  >
                    {formatOrderDateShort(order.createdAt)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Link
                    component={NextLink}
                    href={href}
                    underline="hover"
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: touch.min,
                      fontWeight: 700,
                      color: "semantic.text.primary",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {order.code}
                  </Link>
                  <Typography
                    sx={{ fontSize: "0.75rem", color: "semantic.text.secondary" }}
                  >
                    {lineCountLabel(order.lineCount)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary", ...ONE_LINE_ELLIPSIS }}
                  >
                    {order.tiendaNombre}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      color: "semantic.text.secondary",
                      ...ONE_LINE_ELLIPSIS,
                    }}
                  >
                    {order.contactName ?? TIENDA_ONLINE_ORDER_COPY.sinNombre}
                  </Typography>
                </TableCell>

                <TableCell>
                  <PedidoEstadoPills
                    status={order.status}
                    amounts={order.amounts}
                  />
                </TableCell>

                <TableCell align="right">
                  <PedidoImporte
                    amounts={order.amounts}
                    currencyCode={order.currencyCode}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export default PedidosTable;
