"use client";

import { Alert, Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { ContentCard } from "@/components/ContentCard";
import { StatCard } from "@/components/StatCard";
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

/** Colour by urgency: already expired is a loss, 30 days is a heads-up. */
function bucketColor(dias: number): string {
  if (dias === 0) return "error.main";
  if (dias <= 7) return "warning.main";
  return "info.main";
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
        <Grid container spacing={2}>
          {buckets.map((bucket) => (
            <Grid key={bucket.etiqueta} size={{ xs: 6, md: 3 }}>
              <StatCard
                title={bucket.etiqueta}
                value={format(bucket.valorEnRiesgo)}
                subtitle={`${bucket.productos} producto(s)`}
                color={bucketColor(bucket.dias)}
              />
            </Grid>
          ))}
        </Grid>

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
