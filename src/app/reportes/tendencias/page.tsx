"use client";

import { Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { SalesTrendChart } from "@/components/reports/trends/SalesTrendChart";
import { HourWeekdayHeatmap } from "@/components/reports/trends/HourWeekdayHeatmap";
import { PeriodComparisonCards } from "@/components/reports/trends/PeriodComparisonCards";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getSalesTrendsReport } from "@/services/reportsService";
import type { ISalesTrendsResponse } from "@/schemas/reports/salesTrends";

export default function TendenciasPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } = useReportData<ISalesTrendsResponse>(
    getSalesTrendsReport,
    filters.toQuery,
    filters.ready,
  );

  return (
    <ReportPageShell
      title="Tendencias"
      subtitle="Evolución de ventas y horarios de mayor actividad"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && (
        <Stack spacing={3}>
          <PeriodComparisonCards
            actual={data.actual}
            anterior={data.anterior}
            variacion={data.variacion}
            format={currency.format}
          />

          <SalesTrendChart
            serie={data.serie}
            bucketing={data.meta.bucketing}
            convert={currency.convert}
            formatConverted={currency.formatConverted}
            currencyLabel={currency.displayCurrency}
          />

          <HourWeekdayHeatmap
            cells={data.heatmap.cells}
            maxVentas={data.heatmap.maxVentas}
            pico={data.heatmap.pico}
            format={currency.format}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
