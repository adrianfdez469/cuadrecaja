"use client";

import { Box, Stack } from "@mui/material";
import type { IMovimiento } from "@/schemas/movimiento";
import { MovimientoCard } from "./MovimientoCard";

interface MovimientosMobileListProps {
  movimientos: IMovimiento[];
  /** Passed straight to every card; see `MovimientoCard`. */
  hideProductName?: boolean;
}

/**
 * The stack of movement cards, with the vertical rhythm both lists share.
 *
 * It deliberately decides nothing about loading or emptiness: each screen owns
 * its own copy for those. What it owns is the spacing — if every screen mounts
 * its own `Stack`, the gap between cards diverges again on the first edit,
 * which is the drift this component exists to close.
 */
export function MovimientosMobileList({
  movimientos,
  hideProductName = false,
}: Readonly<MovimientosMobileListProps>) {
  return (
    <Box sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        {movimientos.map((movimiento, i) => (
          <MovimientoCard
            key={movimiento.id ?? i}
            movimiento={movimiento}
            hideProductName={hideProductName}
          />
        ))}
      </Stack>
    </Box>
  );
}
