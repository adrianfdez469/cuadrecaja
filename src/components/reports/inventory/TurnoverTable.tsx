"use client";

import { Chip } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { ITurnoverRow } from "@/schemas/reports/inventoryReport";

type TurnoverTableProps = {
  rows: ITurnoverRow[];
  format: (amountInBase: number) => string;
};

const STATE_LABELS: Record<
  ITurnoverRow["estado"],
  { label: string; color: "default" | "error" | "warning" | "success" | "info" }
> = {
  sin_stock: { label: "Sin stock", color: "default" },
  critico: { label: "Crítico", color: "error" },
  bajo: { label: "Bajo", color: "warning" },
  saludable: { label: "Saludable", color: "success" },
  sobrestock: { label: "Sobrestock", color: "info" },
};

/**
 * Days of coverage per product — how long current stock lasts at the pace it
 * actually sells, replacing the old fixed "5 units is low" threshold.
 */
export function TurnoverTable({ rows, format }: TurnoverTableProps) {
  const columns: ReportColumn<ITurnoverRow>[] = [
    {
      key: "nombre",
      label: "Producto",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "categoria",
      label: "Categoría",
      render: (row) => row.categoryName,
      sortValue: (row) => row.categoryName,
    },
    {
      key: "existencia",
      label: "Existencia actual",
      align: "right",
      render: (row) => formatNumber(row.existenciaActual),
      sortValue: (row) => row.existenciaActual,
    },
    {
      key: "vendidas",
      label: "Vendidas",
      align: "right",
      render: (row) => formatNumber(row.unidadesVendidas),
      sortValue: (row) => row.unidadesVendidas,
    },
    {
      key: "promedio",
      label: "Venta diaria",
      align: "right",
      render: (row) => row.ventaDiariaPromedio.toFixed(2),
      sortValue: (row) => row.ventaDiariaPromedio,
    },
    {
      key: "cobertura",
      label: "Días de cobertura",
      align: "right",
      render: (row) =>
        row.diasCobertura === null ? "—" : Math.round(row.diasCobertura),
      // Products that never sold sort last rather than as "infinite coverage".
      sortValue: (row) => row.diasCobertura ?? Number.MAX_SAFE_INTEGER,
    },
    {
      key: "valor",
      label: "Valor stock",
      align: "right",
      render: (row) => format(row.valorStock),
      sortValue: (row) => row.valorStock,
    },
    {
      key: "estado",
      label: "Estado",
      align: "center",
      render: (row) => (
        <Chip
          size="small"
          label={STATE_LABELS[row.estado].label}
          color={STATE_LABELS[row.estado].color}
          variant="outlined"
        />
      ),
      sortValue: (row) => row.estado,
    },
  ];

  return (
    <ContentCard
      title="Rotación y días de cobertura"
      subtitle="Existencia actual frente al ritmo de venta del período"
    >
      <ReportDataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.storeProductId}
        exportName="Rotacion de inventario"
        initialSortKey="cobertura"
        initialSortDirection="asc"
        emptyMessage="No hay productos con existencia registrada"
      />
    </ContentCard>
  );
}
