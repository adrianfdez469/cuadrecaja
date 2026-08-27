"use client";

import { Alert, Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatStrip } from "@/components/StatStrip";
import { TurnoverTable } from "@/components/reports/inventory/TurnoverTable";
import { DeadStockTable } from "@/components/reports/inventory/DeadStockTable";
import { ParetoAbcChart } from "@/components/reports/inventory/ParetoAbcChart";
import { ExpiryRiskBuckets } from "@/components/reports/inventory/ExpiryRiskBuckets";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getInventoryReport } from "@/services/reportsService";
import { formatNumber } from "@/utils/formatters";
import type { IInventoryReportResponse } from "@/schemas/reports/inventoryReport";

export default function InventarioReportPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } =
    useReportData<IInventoryReportResponse>(
      getInventoryReport,
      filters.toQuery,
      filters.ready,
    );

  return (
    <ReportPageShell
      title="Inventario"
      subtitle="Rotación, capital inmovilizado y riesgo de vencimiento"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && (
        <Stack spacing={3}>
          {data.resumen.stockDesalineado && (
            <Alert severity="warning">
              El rango seleccionado termina en el pasado, pero la existencia
              mostrada es la actual. Los días de cobertura y la rotación no son
              representativos para períodos históricos.
            </Alert>
          )}

          <StatStrip
            variant="card"
            stats={[
              {
                label: "Valor del inventario",
                value: currency.format(data.resumen.valorInventario),
                note: `${formatNumber(data.resumen.productosActivos)} productos con stock`,
              },
              {
                label: "Productos por agotarse",
                value: formatNumber(data.resumen.productosCriticos),
                note: "Cobertura ≤ 7 días",
                tone: "caution",
              },
              {
                label: "Capital inmovilizado",
                value: currency.format(data.resumen.capitalInmovilizado),
                note: `${formatNumber(data.resumen.productosSinMovimiento)} sin ventas`,
                tone: "negative",
              },
              {
                label: "En riesgo por vencimiento",
                value: currency.format(data.resumen.valorEnRiesgoVencimiento),
                note: "Próximos 30 días",
                tone: "negative",
              },
            ]}
          />

          <TurnoverTable rows={data.rotacion} format={currency.format} />

          <DeadStockTable
            rows={data.capitalInmovilizado}
            format={currency.format}
            total={data.resumen.capitalInmovilizado}
          />

          <ParetoAbcChart rows={data.abc} format={currency.format} />

          <ExpiryRiskBuckets
            buckets={data.vencimientos.buckets}
            rows={data.vencimientos.productos}
            format={currency.format}
            total={data.resumen.valorEnRiesgoVencimiento}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
