"use client";

import { Fragment } from "react";
import { Typography } from "@mui/material";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderAmount,
} from "@/components/tiendaOnline/orderPresentation";
import type { ITiendaOnlineOrderLine } from "@/schemas/tiendaOnline";

export interface PedidoLineExtrasProps {
  line: ITiendaOnlineOrderLine;
}

/**
 * The two subordinate lines a product line can carry: where its price came from,
 * and — only when it does not add up — what the stored rate would have given.
 *
 * The recomputed amount is shown ONLY when `matchesStored` is false. Two
 * identical numbers side by side, up to a hundred times, inform of nothing.
 *
 * `conversion === null` is NOT an error and is not painted as one: it has four
 * legitimate causes enumerated in the schema, and a line with it looks exactly
 * like a line that adds up, minus the mismatch sentence it does not have.
 *
 * The stored `unitPrice` is always what the price column shows; the recomputed
 * one never replaces it, not even here (ADR 0060).
 */
export function PedidoLineExtras({ line }: Readonly<PedidoLineExtrasProps>) {
  const mismatch = line.conversion !== null && !line.conversion.matchesStored;

  return (
    <Fragment>
      {line.original !== null && (
        <Typography
          variant="body2"
          sx={{ color: "semantic.money.reference.main" }}
        >
          {`${TIENDA_ONLINE_ORDER_COPY.precioOriginalPrefix}${formatOrderAmount(
            line.original.unitPrice,
            line.original.currencyCode,
          )}`}
        </Typography>
      )}

      {mismatch && line.conversion !== null && (
        <Typography
          variant="body2"
          sx={{ color: "semantic.hue.caution.main" }}
        >
          {`${TIENDA_ONLINE_ORDER_COPY.conversionMismatchPrefix}${formatOrderAmount(
            line.conversion.recomputedUnitPrice,
            line.currencyCode,
          )}.`}
        </Typography>
      )}
    </Fragment>
  );
}

export default PedidoLineExtras;
