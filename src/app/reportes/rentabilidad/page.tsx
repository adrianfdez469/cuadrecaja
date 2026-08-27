"use client";

import dynamic from "next/dynamic";
import { Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatStrip } from "@/components/StatStrip";
import { IncomeStatementTable } from "@/components/reports/profitability/IncomeStatementTable";
import { DiscountEffectivenessTable } from "@/components/reports/profitability/DiscountEffectivenessTable";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getProfitabilityReport } from "@/services/reportsService";
import type { IProfitabilityReportResponse } from "@/schemas/reports/profitabilityReport";

// Fuera del bundle inicial: `@mui/x-charts` es la dependencia más
// pesada de esta pantalla y solo hace falta para pintar el gráfico.
const CategoryMarginChart = dynamic(
  () =>
    import("@/components/reports/profitability/CategoryMarginChart").then(
      (m) => m.CategoryMarginChart,
    ),
  { ssr: false },
);

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
          <StatStrip
            variant="card"
            stats={[
              {
                label: "Ventas netas",
                value: currency.format(pnl.ventasNetas),
              },
              {
                label: "Margen bruto",
                value: currency.format(pnl.margenBruto),
                note: `${pnl.margenBrutoPorcentaje.toFixed(1)}% sobre ventas`,
              },
              {
                label: "Gastos operativos",
                value: currency.format(pnl.gastosOperativos),
                tone: "negative",
              },
              {
                label: "Ganancia final",
                value: currency.format(pnl.gananciaFinal),
                tone: pnl.gananciaFinal >= 0 ? "positive" : "negative",
              },
            ]}
          />

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
