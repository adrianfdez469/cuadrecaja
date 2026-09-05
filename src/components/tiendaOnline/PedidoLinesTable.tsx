"use client";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderAmount,
  formatOrderQuantity,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoLineExtras } from "@/components/tiendaOnline/PedidoLineExtras";
import type { ITiendaOnlineOrderLine } from "@/schemas/tiendaOnline";

export interface PedidoLinesTableProps {
  lines: ITiendaOnlineOrderLine[];
}

/** The three fixed columns, and the ONE place their widths are written. */
const CANTIDAD_WIDTH = 90;
const PRECIO_WIDTH = 140;
const IMPORTE_WIDTH = 140;

/**
 * The lines of an order from 600 px: a real table of four short columns.
 *
 * The currency code is printed with EVERY amount. A line may be priced in a
 * currency other than the order's, and a bare number in the wrong currency is
 * the kind of noise that costs money.
 */
export function PedidoLinesTable({ lines }: Readonly<PedidoLinesTableProps>) {
  return (
    // The net, not the design: four short columns fit in 696 px without it.
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{TIENDA_ONLINE_ORDER_COPY.lineColumnProducto}</TableCell>
            <TableCell align="right" sx={{ width: CANTIDAD_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.lineColumnCantidad}
            </TableCell>
            <TableCell align="right" sx={{ width: PRECIO_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.lineColumnPrecioUnitario}
            </TableCell>
            <TableCell align="right" sx={{ width: IMPORTE_WIDTH }}>
              {TIENDA_ONLINE_ORDER_COPY.lineColumnImporte}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <Typography
                  variant="body2"
                  sx={{
                    color: "semantic.text.primary",
                    overflowWrap: "anywhere",
                  }}
                >
                  {line.name}
                </Typography>
                <PedidoLineExtras line={line} />
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatOrderQuantity(line.quantity)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatOrderAmount(line.unitPrice, line.currencyCode)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatOrderAmount(line.lineTotal, line.currencyCode)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export default PedidoLinesTable;
