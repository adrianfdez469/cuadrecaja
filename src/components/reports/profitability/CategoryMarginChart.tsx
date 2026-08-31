"use client";

import { Alert, Stack } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { ICategoryMarginRow } from "@/schemas/reports/profitabilityReport";

type CategoryMarginChartProps = {
  rows: ICategoryMarginRow[];
  convert: (amountInBase: number) => number;
  format: (amountInBase: number) => string;
  /** Formats a value that is already in the display currency (chart series). */
  formatConverted: (amount: number) => string;
};

const CHART_LIMIT = 10;

/** Profit and margin per category, with each one's share of total profit. */
export function CategoryMarginChart({
  rows,
  convert,
  format,
  formatConverted,
}: CategoryMarginChartProps) {
  if (rows.length === 0) {
    return (
      <ContentCard title="Rentabilidad por categoría">
        <Alert severity="info">No hay datos disponibles para el período</Alert>
      </ContentCard>
    );
  }

  const top = rows.slice(0, CHART_LIMIT);

  const columns: ReportColumn<ICategoryMarginRow>[] = [
    {
      key: "categoria",
      label: "Categoría",
      render: (row) => row.categoryName,
      sortValue: (row) => row.categoryName,
    },
    {
      key: "unidades",
      label: "Unidades",
      align: "right",
      render: (row) => formatNumber(row.unidades),
      sortValue: (row) => row.unidades,
    },
    {
      key: "ventas",
      label: "Ventas netas",
      align: "right",
      render: (row) => format(row.ventasNetas),
      sortValue: (row) => row.ventasNetas,
    },
    {
      key: "ganancia",
      label: "Ganancia",
      align: "right",
      render: (row) => format(row.ganancia),
      sortValue: (row) => row.ganancia,
    },
    {
      key: "margen",
      label: "Margen",
      align: "right",
      render: (row) => `${row.margenPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.margenPorcentaje,
    },
    {
      key: "contribucion",
      label: "Contribución",
      align: "right",
      render: (row) => `${row.contribucionPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.contribucionPorcentaje,
    },
  ];

  return (
    <ContentCard title="Rentabilidad por categoría">
      <Stack spacing={1.5}>
        <BarChart
          height={Math.max(240, top.length * 36 + 80)}
          layout="horizontal"
          yAxis={[
            {
              scaleType: "band",
              data: top.map((row) => row.categoryName),
              width: 140,
            },
          ]}
          series={[
            {
              data: top.map((row) => convert(row.ganancia)),
              label: "Ganancia",
              valueFormatter: (value) =>
                value === null ? "—" : formatConverted(value as number),
            },
          ]}
          margin={{ left: 10, right: 20, top: 30, bottom: 30 }}
        />

        <ReportDataTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.categoryId ?? row.categoryName}
          exportName="Rentabilidad por categoria"
          initialSortKey="ganancia"
        />
      </Stack>
    </ContentCard>
  );
}
