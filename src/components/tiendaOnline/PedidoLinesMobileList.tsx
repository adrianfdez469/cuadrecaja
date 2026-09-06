"use client";

import { Divider, Stack, Typography } from "@mui/material";

import {
  formatOrderAmount,
  formatOrderQuantity,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoLineExtras } from "@/components/tiendaOnline/PedidoLineExtras";
import type { ITiendaOnlineOrderLine } from "@/schemas/tiendaOnline";

export interface PedidoLinesMobileListProps {
  lines: ITiendaOnlineOrderLine[];
}

/**
 * The lines of an order below 600 px: a block per line, separated by rules and
 * with NO table.
 *
 * The product name wraps and is never clipped: it is what the merchant is
 * looking for when they open the order.
 */
export function PedidoLinesMobileList({
  lines,
}: Readonly<PedidoLinesMobileListProps>) {
  return (
    <Stack divider={<Divider flexItem />} spacing={1.5}>
      {lines.map((line) => (
        <Stack key={line.id} spacing={0.5}>
          <Typography
            variant="body2"
            sx={{ color: "semantic.text.primary", overflowWrap: "anywhere" }}
          >
            {line.name}
          </Typography>

          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            <Typography
              variant="body2"
              sx={{ color: "semantic.text.secondary" }}
            >
              {`${formatOrderQuantity(line.quantity)} × ${formatOrderAmount(
                line.unitPrice,
                line.currencyCode,
              )}`}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: "semantic.text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatOrderAmount(line.lineTotal, line.currencyCode)}
            </Typography>
          </Stack>

          <PedidoLineExtras line={line} />
        </Stack>
      ))}
    </Stack>
  );
}

export default PedidoLinesMobileList;
