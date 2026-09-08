"use client";

import { Box, Typography } from "@mui/material";
import type { IMovimiento } from "@/schemas/movimiento";
import { TIPO_MOVIMIENTO_FLOW } from "@/constants/movimientos";
import {
  getStockAfterMovement,
  isMovimientoBaja,
} from "@/utils/tipoMovimiento";
import { formatQuantity } from "@/utils/formatters";

interface MovimientoCantidadProps {
  movimiento: IMovimiento;
  /** `card` is the headline figure on a phone; `table` is a cell in a row. */
  size?: "card" | "table";
}

/**
 * How much moved, and what the count went from and to.
 *
 * The two belong together: `12 → 7` means nothing apart from the `-5` that
 * produced it, and a table that puts them half a row apart makes the reader
 * pair them up again by hand. That is why the count is not a column of its own
 * on either table — it stacks under the quantity, the same way it stacks under
 * it on the card.
 *
 * One shared piece for all three surfaces (card, the `/movimientos` cell and
 * the modal's cell) so the null-stock rule and the flow ink cannot be written
 * three times and drift apart on the first edit.
 */
export function MovimientoCantidad({
  movimiento,
  size = "card",
}: Readonly<MovimientoCantidadProps>) {
  const isCard = size === "card";
  const role = TIPO_MOVIMIENTO_FLOW[movimiento.tipo];

  const stockBefore = movimiento.existenciaAnterior;
  const stockAfter = getStockAfterMovement(
    stockBefore,
    movimiento.cantidad,
    movimiento.tipo,
  );

  return (
    <Box sx={{ textAlign: isCard ? "right" : "center" }}>
      <Typography
        variant={isCard ? undefined : "body2"}
        sx={{
          fontWeight: 700,
          color: `semantic.flow.${role}.main`,
          ...(isCard && {
            fontSize: "1.375rem",
            letterSpacing: "-0.02em",
          }),
        }}
      >
        {isMovimientoBaja(movimiento.tipo) ? "-" : "+"}
        {formatQuantity(Math.abs(movimiento.cantidad))}
      </Typography>
      {/*
        No count before means the row predates the column, so there is nothing
        true to draw: a dash reads as "it did not move" and a zero as "there was
        none". The missing line is the signal.
      */}
      {stockAfter !== null && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.25 }}
          aria-label={`Existencia: ${formatQuantity(stockBefore)} antes, ${formatQuantity(stockAfter)} después`}
        >
          {formatQuantity(stockBefore)} → {formatQuantity(stockAfter)}
        </Typography>
      )}
    </Box>
  );
}
