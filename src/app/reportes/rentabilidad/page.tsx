"use client";

import { Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatCard } from "@/components/StatCard";
import { IncomeStatementTable } from "@/components/reports/profitability/IncomeStatementTable";
import { CategoryMarginChart } from "@/components/reports/profitability/CategoryMarginChart";
import { DiscountEffectivenessTable } from "@/components/reports/profitability/DiscountEffectivenessTable";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getProfitabilityReport } from "@/services/reportsService";
import type { IProfitabilityReportResponse } from "@/schemas/reports/profitabilityReport";

export default function RentabilidadPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } =
    useReportData<IProfitabilityReportResponse>(
      getProfitabilityReport,
      filters.toQuery,
      filters.ready,
    );

  const pnl = data?.estadoResultados;

  return (
    <ReportPageShell
      title="Rentabilidad"
      subtitle="Estado de resultados, margen por categoría y descuentos"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && pnl && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Ventas netas"
                value={currency.format(pnl.ventasNetas)}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Margen bruto"
                value={currency.format(pnl.margenBruto)}
                subtitle={`${pnl.margenBrutoPorcentaje.toFixed(1)}% sobre ventas`}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Gastos operativos"
                value={currency.format(pnl.gastosOperativos)}
                color="error.main"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Ganancia final"
                value={currency.format(pnl.gananciaFinal)}
                color={pnl.gananciaFinal >= 0 ? "success.main" : "error.main"}
              />
            </Grid>
          </Grid>

          <IncomeStatementTable data={pnl} format={currency.format} />

          <CategoryMarginChart
            rows={data.categorias}
            convert={currency.convert}
            format={currency.format}
            formatConverted={currency.formatConverted}
          />

          <DiscountEffectivenessTable
            rows={data.descuentos.reglas}
            totalDescontado={data.descuentos.totalDescontado}
            ventasConDescuento={data.descuentos.ventasConDescuento}
            sinReglaAsociada={data.descuentos.sinReglaAsociada}
            format={currency.format}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
