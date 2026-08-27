"use client";

import { Alert, Stack } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import { StatStrip } from "@/components/StatStrip";
import type { PillHue } from "@/components/StatusPill";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatDate, formatNumber } from "@/utils/formatters";
import type {
  IExpiryBucket,
  IExpiryRiskRow,
} from "@/schemas/reports/inventoryReport";

type ExpiryRiskBucketsProps = {
  buckets: IExpiryBucket[];
  rows: IExpiryRiskRow[];
  format: (amountInBase: number) => string;
  total: number;
};

/** Tone by urgency: already expired is a loss, 30 days is a heads-up. */
function bucketTone(dias: number): PillHue {
  if (dias === 0) return "negative";
  if (dias <= 7) return "caution";
  return "info";
}

/**
 * Money at risk from expiry, bucketed by urgency.
 *
 * The existing alert only lists which products expire; putting a value on each
 * bucket is what turns it into a decision about what to discount first.
 */
export function ExpiryRiskBuckets({
  buckets,
  rows,
  format,
  total,
}: ExpiryRiskBucketsProps) {
  const columns: ReportColumn<IExpiryRiskRow>[] = [
    {
      key: "nombre",
      label: "Producto",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "existencia",
      label: "Existencia",
      align: "right",
      render: (row) => formatNumber(row.existenciaActual),
      sortValue: (row) => row.existenciaActual,
    },
    {
      key: "vence",
      label: "Vence",
      align: "right",
      render: (row) => formatDate(new Date(row.expiresAt)),
      sortValue: (row) => new Date(row.expiresAt).getTime(),
    },
    {
      key: "dias",
      label: "Días restantes",
      align: "right",
      render: (row) => (row.diasRestantes < 0 ? "Vencido" : row.diasRestantes),
      sortValue: (row) => row.diasRestantes,
    },
    {
      key: "valor",
      label: "Valor en riesgo",
      align: "right",
      render: (row) => format(row.valorEnRiesgo),
      sortValue: (row) => row.valorEnRiesgo,
    },
  ];

  return (
    <ContentCard
      title="Valor en riesgo por vencimiento"
      subtitle={`Total en riesgo (próximos 30 días): ${format(total)}`}
    >
      <Stack spacing={2}>
        <StatStrip
          variant="card"
          stats={buckets.map((bucket) => ({
            label: bucket.etiqueta,
            value: format(bucket.valorEnRiesgo),
            note: `${bucket.productos} producto(s)`,
            tone: bucketTone(bucket.dias),
          }))}
        />

        {rows.length === 0 ? (
          <Alert severity="success">
            No hay productos que venzan en los próximos 30 días
          </Alert>
        ) : (
          <ReportDataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.storeProductId}
            exportName="Valor en riesgo por vencimiento"
            initialSortKey="dias"
            initialSortDirection="asc"
          />
        )}
      </Stack>
    </ContentCard>
  );
}
