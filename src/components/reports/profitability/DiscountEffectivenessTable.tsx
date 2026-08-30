"use client";

import { Alert, Stack } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { IDiscountRuleRow } from "@/schemas/reports/profitabilityReport";

type DiscountEffectivenessTableProps = {
  rows: IDiscountRuleRow[];
  totalDescontado: number;
  ventasConDescuento: number;
  sinReglaAsociada: number;
  format: (amountInBase: number) => string;
};

/**
 * How much each discount rule gave away, and how deeply it cut into the sales
 * it touched.
 */
export function DiscountEffectivenessTable({
  rows,
  totalDescontado,
  ventasConDescuento,
  sinReglaAsociada,
  format,
}: DiscountEffectivenessTableProps) {
  const columns: ReportColumn<IDiscountRuleRow>[] = [
    {
      key: "nombre",
      label: "Regla",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (row) => row.tipo ?? "—",
      sortValue: (row) => row.tipo ?? "",
    },
    {
      key: "veces",
      label: "Aplicada",
      align: "right",
      render: (row) => formatNumber(row.vecesAplicado),
      sortValue: (row) => row.vecesAplicado,
    },
    {
      key: "monto",
      label: "Descontado",
      align: "right",
      render: (row) => format(row.montoDescontado),
      sortValue: (row) => row.montoDescontado,
    },
    {
      key: "afectadas",
      label: "Ventas afectadas",
      align: "right",
      render: (row) => format(row.ventasAfectadas),
      sortValue: (row) => row.ventasAfectadas,
    },
    {
      key: "erosion",
      label: "Erosión",
      align: "right",
      render: (row) => `${row.erosionPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.erosionPorcentaje,
    },
  ];

  return (
    <ContentCard
      title="Efectividad de descuentos"
      subtitle={`${format(totalDescontado)} descontados en ${formatNumber(ventasConDescuento)} venta(s)`}
    >
      <Stack spacing={1.5}>
        {sinReglaAsociada > 0 && (
          <Alert severity="info">
            {format(sinReglaAsociada)} en descuentos no tienen una regla
            asociada. Corresponden a ventas anteriores al motor de descuentos y
            se prorratean entre todas sus líneas.
          </Alert>
        )}

        <ReportDataTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.discountRuleId}
          exportName="Efectividad de descuentos"
          initialSortKey="monto"
          emptyMessage="No se aplicaron descuentos con reglas en el período"
        />
      </Stack>
    </ContentCard>
  );
}
