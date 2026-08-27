"use client";

import { Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatStrip } from "@/components/StatStrip";
import { SellerPerformanceTable } from "@/components/reports/operations/SellerPerformanceTable";
import { PaymentMixChart } from "@/components/reports/operations/PaymentMixChart";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getOperationsReport } from "@/services/reportsService";
import { formatNumber } from "@/utils/formatters";
import type { IOperationsReportResponse } from "@/schemas/reports/operationsReport";

export default function OperacionPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } =
    useReportData<IOperationsReportResponse>(
      getOperationsReport,
      filters.toQuery,
      filters.ready,
    );

  const efectivo = data?.pagos.mix
    .filter((row) => row.tipo === "cash")
    .reduce((acc, row) => acc + row.montoBase, 0);
  const transferencia = data?.pagos.mix
    .filter((row) => row.tipo === "transfer")
    .reduce((acc, row) => acc + row.montoBase, 0);

  return (
    <ReportPageShell
      title="Operación"
      subtitle="Rendimiento por vendedor y composición de los cobros"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && (
        <Stack spacing={3}>
          <StatStrip
            variant="card"
            stats={[
              {
                label: "Total cobrado",
                value: currency.format(data.pagos.totalBase),
              },
              {
                label: "Efectivo",
                value: currency.format(efectivo ?? 0),
                note:
                  data.pagos.totalBase > 0
                    ? `${(((efectivo ?? 0) / data.pagos.totalBase) * 100).toFixed(1)}% del total`
                    : undefined,
              },
              {
                label: "Transferencia",
                value: currency.format(transferencia ?? 0),
                note:
                  data.pagos.totalBase > 0
                    ? `${(((transferencia ?? 0) / data.pagos.totalBase) * 100).toFixed(1)}% del total`
                    : undefined,
              },
              {
                label: "Vendedores activos",
                value: formatNumber(data.vendedores.length),
              },
            ]}
          />

          <SellerPerformanceTable
            rows={data.vendedores}
            format={currency.format}
          />

          <PaymentMixChart
            mix={data.pagos.mix}
            destinos={data.pagos.destinos}
            ventasEstimadas={data.pagos.ventasEstimadas}
            format={currency.format}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
