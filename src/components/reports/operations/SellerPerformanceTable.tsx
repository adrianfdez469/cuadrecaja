"use client";

import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { ISellerPerformanceRow } from "@/schemas/reports/operationsReport";

type SellerPerformanceTableProps = {
  rows: ISellerPerformanceRow[];
  format: (amountInBase: number) => string;
};

/**
 * Per-seller performance, built on a field recorded on every sale but never
 * reported until now.
 */
export function SellerPerformanceTable({
  rows,
  format,
}: SellerPerformanceTableProps) {
  const columns: ReportColumn<ISellerPerformanceRow>[] = [
    {
      key: "nombre",
      label: "Vendedor",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "ventas",
      label: "Ventas netas",
      align: "right",
      render: (row) => format(row.ventasNetas),
      sortValue: (row) => row.ventasNetas,
    },
    {
      key: "participacion",
      label: "Participación",
      align: "right",
      render: (row) => `${row.participacionPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.participacionPorcentaje,
    },
    {
      key: "tickets",
      label: "Tickets",
      align: "right",
      render: (row) => formatNumber(row.tickets),
      sortValue: (row) => row.tickets,
    },
    {
      key: "ticketPromedio",
      label: "Ticket promedio",
      align: "right",
      render: (row) => format(row.ticketPromedio),
      sortValue: (row) => row.ticketPromedio,
    },
    {
      key: "unidadesTicket",
      label: "Unid./ticket",
      align: "right",
      render: (row) => row.unidadesPorTicket.toFixed(1),
      sortValue: (row) => row.unidadesPorTicket,
    },
    {
      key: "ganancia",
      label: "Ganancia",
      align: "right",
      render: (row) => format(row.ganancia),
      sortValue: (row) => row.ganancia,
    },
    {
      key: "descuento",
      label: "Descuento otorgado",
      align: "right",
      render: (row) =>
        `${format(row.descuentoOtorgado)} (${row.descuentoPorcentaje.toFixed(1)}%)`,
      sortValue: (row) => row.descuentoPorcentaje,
    },
  ];

  return (
    <ContentCard
      title="Rendimiento por vendedor"
      subtitle="Un descuento promedio muy por encima del resto merece revisarse"
    >
      <ReportDataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.sellerId}
        exportName="Rendimiento por vendedor"
        initialSortKey="ventas"
        emptyMessage="No hay ventas registradas en el período"
      />
    </ContentCard>
  );
}
