"use client";

import { Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatCard } from "@/components/StatCard";
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
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Total cobrado"
                value={currency.format(data.pagos.totalBase)}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Efectivo"
                value={currency.format(efectivo ?? 0)}
                subtitle={
                  data.pagos.totalBase > 0
                    ? `${(((efectivo ?? 0) / data.pagos.totalBase) * 100).toFixed(1)}% del total`
                    : undefined
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Transferencia"
                value={currency.format(transferencia ?? 0)}
                subtitle={
                  data.pagos.totalBase > 0
                    ? `${(((transferencia ?? 0) / data.pagos.totalBase) * 100).toFixed(1)}% del total`
                    : undefined
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Vendedores activos"
                value={formatNumber(data.vendedores.length)}
              />
            </Grid>
          </Grid>

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
