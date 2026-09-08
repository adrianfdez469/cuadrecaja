"use client";

import { Chip } from "@mui/material";
import type { ITipoMovimiento } from "@/schemas/movimiento";
import {
  TIPO_MOVIMIENTO_FLOW,
  TIPO_MOVIMIENTO_LABELS,
} from "@/constants/movimientos";

interface MovimientoTipoChipProps {
  tipo: ITipoMovimiento;
}

/**
 * What a stock movement is, as a tinted pill.
 *
 * The label comes from `TIPO_MOVIMIENTO_LABELS`: the raw enum
 * (`DESAGREGACION_ALTA`) used to reach the screen even though the filter
 * dropdown right above it already read in Spanish.
 *
 * The colour follows the movement's flow role rather than a rises/falls
 * boolean. Under that older rule the two halves of one disaggregation came out
 * green and red, reading as a success beside a failure when they are a single
 * operation: opening a box to sell its loose units.
 *
 * It lives here, and not inside a screen, because both movement lists paint it
 * — while it was a local function of `MovimientosView`, the inventory modal
 * could not reach it and grew its own `color="error"/"success"` version.
 */
export function MovimientoTipoChip({
  tipo,
}: Readonly<MovimientoTipoChipProps>) {
  const role = TIPO_MOVIMIENTO_FLOW[tipo];

  return (
    <Chip
      label={TIPO_MOVIMIENTO_LABELS[tipo] ?? tipo}
      size="small"
      variant="filled"
      sx={{
        fontWeight: 500,
        bgcolor: `semantic.flow.${role}.surface`,
        color: `semantic.flow.${role}.main`,
      }}
    />
  );
}
