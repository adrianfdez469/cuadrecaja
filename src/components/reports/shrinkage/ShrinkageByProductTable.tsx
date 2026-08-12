"use client";

import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { IShrinkageProductRow } from "@/schemas/reports/shrinkageReport";

type ShrinkageByProductTableProps = {
  rows: IShrinkageProductRow[];
  format: (amountInBase: number) => string;
};

/** Losses per product, splitting shrinkage from customer refunds. */
export function ShrinkageByProductTable({
  rows,
  format,
}: ShrinkageByProductTableProps) {
  const columns: ReportColumn<IShrinkageProductRow>[] = [
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
      key: "mermaUnidades",
      label: "Merma (unid.)",
      align: "right",
      render: (row) => formatNumber(row.merma.unidades),
      sortValue: (row) => row.merma.unidades,
    },
    {
      key: "mermaCosto",
      label: "Merma (costo)",
      align: "right",
      render: (row) => format(row.merma.costo),
      sortValue: (row) => row.merma.costo,
    },
    {
      key: "devUnidades",
      label: "Devol. (unid.)",
      align: "right",
      render: (row) => formatNumber(row.devoluciones.unidades),
      sortValue: (row) => row.devoluciones.unidades,
    },
    {
      key: "devPerdida",
      label: "Devol. (pérdida)",
      align: "right",
      render: (row) => format(row.devoluciones.perdida),
      sortValue: (row) => row.devoluciones.perdida,
    },
    {
      key: "total",
      label: "Pérdida total",
      align: "right",
      render: (row) => format(row.perdidaTotal),
      sortValue: (row) => row.perdidaTotal,
    },
  ];

  return (
    <ContentCard
      title="Pérdidas por producto"
      subtitle="La merma se valora al costo; una devolución cuesta lo reembolsado menos la mercancía recuperada"
    >
      <ReportDataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.storeProductId}
        exportName="Perdidas por producto"
        initialSortKey="total"
        emptyMessage="No hubo mermas ni devoluciones en el período"
      />
    </ContentCard>
  );
}
