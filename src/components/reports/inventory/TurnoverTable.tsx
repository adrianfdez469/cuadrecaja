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

/**
 * Render the Estado column.
 * Shows a pill ONLY when there is something actionable:
 * - Sin stock (existenciaActual === 0) → red error chip
 * - Sin ventas (diasCobertura === null) → amber warning chip
 * - Sobrestock (diasCobertura >= 90) → blue info chip
 * - Normal products → empty ("–")
 */
function renderEstadoCell(row: ITurnoverRow): React.ReactNode {
  // Sin stock
  if (row.existenciaActual === 0) {
    return (
      <Chip size="small" label="Sin stock" color="error" variant="outlined" />
    );
  }

  // Sin ventas (never sold in the period)
  if (row.diasCobertura === null) {
    return (
      <Chip
        size="small"
        label="Sin ventas"
        color="warning"
        variant="outlined"
      />
    );
  }

  // Sobrestock (coverage >= 90 days)
  if (row.diasCobertura >= 90) {
    return (
      <Chip size="small" label="Sobrestock" color="info" variant="outlined" />
    );
  }

  // Normal rotation — no pill
  return "—";
}

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
      render: (row) => renderEstadoCell(row),
      sortValue: (row) => {
        if (row.existenciaActual === 0) return 0; // Sin stock first
        if (row.diasCobertura === null) return 1; // Sin ventas next
        if (row.diasCobertura >= 90) return 2; // Sobrestock after
        return 3; // Normal last
      },
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
