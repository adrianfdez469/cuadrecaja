"use client";

import { Alert, Stack } from "@mui/material";
import { StatStrip } from "@/components/StatStrip";
import { formatNumber } from "@/utils/formatters";
import type {
  ISalesTrendsResponse,
  ITrendComparison,
} from "@/schemas/reports/salesTrends";

type PeriodComparisonCardsProps = {
  actual: ITrendComparison;
  anterior: ITrendComparison;
  variacion: ISalesTrendsResponse["variacion"];
  format: (amountInBase: number) => string;
};

/**
 * Current vs previous window.
 *
 * Both the raw total and the per-operating-day figure are shown: under
 * closed-period scoping the two windows often contain different numbers of
 * closings, and comparing raw totals alone would read as growth or collapse
 * that never happened.
 */
export function PeriodComparisonCards({
  actual,
  anterior,
  variacion,
  format,
}: PeriodComparisonCardsProps) {
  const comparable = anterior.diasOperacion > 0;

  return (
    <Stack spacing={2}>
      {!comparable && (
        <Alert severity="info">
          El período anterior no tiene cierres completos, así que no hay base de
          comparación.
        </Alert>
      )}

      <StatStrip
        variant="card"
        stats={[
          {
            label: "Ventas netas",
            value: format(actual.ventasNetas),
            note: `Anterior: ${format(anterior.ventasNetas)}`,
            delta: comparable ? variacion.ventasNetas : undefined,
          },
          {
            label: "Ganancia",
            value: format(actual.ganancia),
            note: `Anterior: ${format(anterior.ganancia)}`,
            delta: comparable ? variacion.ganancia : undefined,
          },
          {
            label: "Ventas por día de operación",
            value: format(actual.ventasPorDia),
            note: `${formatNumber(actual.diasOperacion)} días vs ${formatNumber(anterior.diasOperacion)}`,
            delta: comparable ? variacion.ventasPorDia : undefined,
          },
          {
            label: "Transacciones",
            value: formatNumber(actual.transacciones),
            note: `Anterior: ${formatNumber(anterior.transacciones)}`,
            delta: comparable ? variacion.transacciones : undefined,
          },
        ]}
      />
    </Stack>
  );
}
