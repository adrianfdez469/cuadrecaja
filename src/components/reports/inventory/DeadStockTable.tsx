"use client";

import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatDate, formatNumber } from "@/utils/formatters";
import type { IDeadStockRow } from "@/schemas/reports/inventoryReport";

type DeadStockTableProps = {
  rows: IDeadStockRow[];
  format: (amountInBase: number) => string;
  total: number;
};

/** Stock that sold nothing in the period — cash sitting on the shelf. */
export function DeadStockTable({ rows, format, total }: DeadStockTableProps) {
  const columns: ReportColumn<IDeadStockRow>[] = [
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
      label: "Existencia",
      align: "right",
      render: (row) => formatNumber(row.existenciaActual),
      sortValue: (row) => row.existenciaActual,
    },
    {
      key: "capital",
      label: "Capital inmovilizado",
      align: "right",
      render: (row) => format(row.capitalInmovilizado),
      sortValue: (row) => row.capitalInmovilizado,
    },
    {
      key: "vence",
      label: "Vence",
      align: "right",
      render: (row) =>
        row.expiresAt ? formatDate(new Date(row.expiresAt)) : "—",
      sortValue: (row) =>
        row.expiresAt
          ? new Date(row.expiresAt).getTime()
          : Number.MAX_SAFE_INTEGER,
    },
  ];

  return (
    <ContentCard
      title="Capital inmovilizado"
      subtitle={`${rows.length} producto(s) sin ventas en el período — ${format(total)}`}
    >
      <ReportDataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.storeProductId}
        exportName="Capital inmovilizado"
        initialSortKey="capital"
        emptyMessage="Todos los productos con stock tuvieron ventas en el período"
      />
    </ContentCard>
  );
}
