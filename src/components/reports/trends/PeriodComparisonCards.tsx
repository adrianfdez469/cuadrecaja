"use client";

import Grid from "@mui/material/Grid2";
import { Alert, Stack } from "@mui/material";
import { StatCard } from "@/components/StatCard";
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

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ventas netas"
            value={format(actual.ventasNetas)}
            subtitle={`Anterior: ${format(anterior.ventasNetas)}`}
            delta={comparable ? { value: variacion.ventasNetas } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ganancia"
            value={format(actual.ganancia)}
            subtitle={`Anterior: ${format(anterior.ganancia)}`}
            delta={comparable ? { value: variacion.ganancia } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ventas por día de operación"
            value={format(actual.ventasPorDia)}
            subtitle={`${formatNumber(actual.diasOperacion)} días vs ${formatNumber(anterior.diasOperacion)}`}
            delta={comparable ? { value: variacion.ventasPorDia } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Transacciones"
            value={formatNumber(actual.transacciones)}
            subtitle={`Anterior: ${formatNumber(anterior.transacciones)}`}
            delta={comparable ? { value: variacion.transacciones } : undefined}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
