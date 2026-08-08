"use client";

import { Alert, Chip, Stack, Typography } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import type { IAbcRow } from "@/schemas/reports/inventoryReport";

type ParetoAbcChartProps = {
  rows: IAbcRow[];
  format: (amountInBase: number) => string;
};

const CLASS_COLOR: Record<IAbcRow["clase"], "success" | "warning" | "default"> =
  {
    A: "success",
    B: "warning",
    C: "default",
  };

/**
 * ABC classification by cumulative profit: which products carry the margin.
 * Class A is the short list worth never running out of.
 */
export function ParetoAbcChart({ rows, format }: ParetoAbcChartProps) {
  if (rows.length === 0) {
    return (
      <ContentCard title="Análisis ABC (Pareto)">
        <Alert severity="info">
          No hay productos con ganancia positiva en el período
        </Alert>
      </ContentCard>
    );
  }

  const counts = { A: 0, B: 0, C: 0 };
  for (const row of rows) counts[row.clase] += 1;

  const columns: ReportColumn<IAbcRow>[] = [
    {
      key: "clase",
      label: "Clase",
      align: "center",
      render: (row) => (
        <Chip size="small" label={row.clase} color={CLASS_COLOR[row.clase]} />
      ),
      sortValue: (row) => row.clase,
    },
    {
      key: "nombre",
      label: "Producto",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "ganancia",
      label: "Ganancia",
      align: "right",
      render: (row) => format(row.ganancia),
      sortValue: (row) => row.ganancia,
    },
    {
      key: "ventas",
      label: "Ventas netas",
      align: "right",
      render: (row) => format(row.ventasNetas),
      sortValue: (row) => row.ventasNetas,
    },
    {
      key: "acumulado",
      label: "% acumulado",
      align: "right",
      render: (row) => `${row.gananciaAcumuladaPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.gananciaAcumuladaPorcentaje,
    },
  ];

  return (
    <ContentCard
      title="Análisis ABC (Pareto)"
      subtitle="Clasificación por ganancia acumulada: A hasta 80%, B hasta 95%, C el resto"
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">
            <strong>{counts.A}</strong> producto(s) clase A generan el 80% de la
            ganancia
          </Typography>
          <Typography variant="body2" color="text.secondary">
            B: <strong>{counts.B}</strong> · C: <strong>{counts.C}</strong>
          </Typography>
        </Stack>

        <ReportDataTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.storeProductId}
          exportName="Analisis ABC"
          initialSortKey="ganancia"
          emptyMessage="Sin datos"
        />
      </Stack>
    </ContentCard>
  );
}
