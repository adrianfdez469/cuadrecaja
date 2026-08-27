"use client";

import dynamic from "next/dynamic";
import { Alert, Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatStrip } from "@/components/StatStrip";
import { ShrinkageByProductTable } from "@/components/reports/shrinkage/ShrinkageByProductTable";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getShrinkageReport } from "@/services/reportsService";
import { formatDate } from "@/utils/formatters";
import type { IShrinkageReportResponse } from "@/schemas/reports/shrinkageReport";

// Fuera del bundle inicial: `@mui/x-charts` es la dependencia más
// pesada de esta pantalla y solo hace falta para pintar el gráfico.
const ShrinkageByReasonChart = dynamic(
  () => import("@/components/reports/shrinkage/ShrinkageByReasonChart").then((m) => m.ShrinkageByReasonChart),
  { ssr: false },
);

export default function MermasPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } =
    useReportData<IShrinkageReportResponse>(
      getShrinkageReport,
      filters.toQuery,
      filters.ready,
    );

  return (
    <ReportPageShell
      title="Mermas y devoluciones"
      subtitle="Pérdidas por producto y por causa"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && (
        <Stack spacing={3}>
          <Alert severity="info">
            Los movimientos de stock no están asociados a un cierre, así que
            este reporte cubre del {formatDate(new Date(data.ventana.from))} al{" "}
            {formatDate(new Date(data.ventana.to))} — el lapso que abarcan los
            cierres incluidos, para que cuadre con el estado de resultados.
          </Alert>

          <StatStrip
            variant="card"
            stats={[
              {
                label: "Pérdida total",
                value: currency.format(data.perdidaTotal),
                tone: "negative",
              },
              { label: "Merma", value: currency.format(data.totalMerma) },
              {
                label: "Devoluciones",
                value: currency.format(data.totalDevoluciones),
              },
            ]}
          />

          <ShrinkageByReasonChart
            rows={data.motivos}
            convert={currency.convert}
            format={currency.format}
            formatConverted={currency.formatConverted}
          />

          <ShrinkageByProductTable
            rows={data.productos}
            format={currency.format}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
