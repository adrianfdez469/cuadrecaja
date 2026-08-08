"use client";

import { Alert, Stack } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatNumber } from "@/utils/formatters";
import type { IShrinkageReasonRow } from "@/schemas/reports/shrinkageReport";

type ShrinkageByReasonChartProps = {
  rows: IShrinkageReasonRow[];
  convert: (amountInBase: number) => number;
  format: (amountInBase: number) => string;
  /** Formats a value that is already in the display currency (chart series). */
  formatConverted: (amount: number) => string;
};

const CHART_LIMIT = 10;

/**
 * Losses grouped by the reason typed in at the movement — the free-text field
 * that explains *why* stock disappeared.
 */
export function ShrinkageByReasonChart({
  rows,
  convert,
  format,
  formatConverted,
}: ShrinkageByReasonChartProps) {
  if (rows.length === 0) {
    return (
      <ContentCard title="Pérdidas por causa">
        <Alert severity="info">No hay movimientos registrados</Alert>
      </ContentCard>
    );
  }

  const top = rows.slice(0, CHART_LIMIT);

  const columns: ReportColumn<IShrinkageReasonRow>[] = [
    {
      key: "motivo",
      label: "Causa",
      render: (row) => row.motivo,
      sortValue: (row) => row.motivo,
    },
    {
      key: "movimientos",
      label: "Movimientos",
      align: "right",
      render: (row) => formatNumber(row.movimientos),
      sortValue: (row) => row.movimientos,
    },
    {
      key: "unidades",
      label: "Unidades",
      align: "right",
      render: (row) => formatNumber(row.unidades),
      sortValue: (row) => row.unidades,
    },
    {
      key: "perdida",
      label: "Pérdida",
      align: "right",
      render: (row) => format(row.perdida),
      sortValue: (row) => row.perdida,
    },
  ];

  return (
    <ContentCard title="Pérdidas por causa">
      <Stack spacing={2}>
        <BarChart
          height={Math.max(240, top.length * 36 + 80)}
          layout="horizontal"
          yAxis={[
            {
              scaleType: "band",
              data: top.map((row) => row.motivo),
              width: 160,
            },
          ]}
          series={[
            {
              data: top.map((row) => convert(row.perdida)),
              label: "Pérdida",
              valueFormatter: (value) =>
                value === null ? "—" : formatConverted(value as number),
            },
          ]}
          margin={{ left: 10, right: 20, top: 30, bottom: 30 }}
        />

        <ReportDataTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.motivo}
          exportName="Perdidas por causa"
          initialSortKey="perdida"
        />
      </Stack>
    </ContentCard>
  );
}
