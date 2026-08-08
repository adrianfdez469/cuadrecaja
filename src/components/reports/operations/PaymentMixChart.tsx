"use client";

import { Alert, Chip, Stack } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import { ReportDataTable } from "@/components/reports/ReportDataTable";
import type { ReportColumn } from "@/components/reports/ReportDataTable";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import type {
  IPaymentMixRow,
  ITransferDestinationRow,
} from "@/schemas/reports/operationsReport";

type PaymentMixChartProps = {
  mix: IPaymentMixRow[];
  destinos: ITransferDestinationRow[];
  ventasEstimadas: number;
  format: (amountInBase: number) => string;
};

const TYPE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

/**
 * Payment-method and currency mix, plus reconciliation by transfer destination.
 *
 * The original-currency column is deliberately *not* converted: it is the
 * amount physically taken in, which is what a cash count has to match.
 */
export function PaymentMixChart({
  mix,
  destinos,
  ventasEstimadas,
  format,
}: PaymentMixChartProps) {
  const mixColumns: ReportColumn<IPaymentMixRow>[] = [
    {
      key: "tipo",
      label: "Método",
      render: (row) => TYPE_LABELS[row.tipo] ?? row.tipo,
      sortValue: (row) => row.tipo,
    },
    {
      key: "moneda",
      label: "Moneda",
      render: (row) => <Chip size="small" label={row.moneda} />,
      sortValue: (row) => row.moneda,
    },
    {
      key: "original",
      label: "Monto cobrado",
      align: "right",
      render: (row) => `${formatCurrency(row.montoOriginal)} ${row.moneda}`,
      sortValue: (row) => row.montoOriginal,
    },
    {
      key: "base",
      label: "Equivalente",
      align: "right",
      render: (row) => format(row.montoBase),
      sortValue: (row) => row.montoBase,
    },
    {
      key: "participacion",
      label: "Participación",
      align: "right",
      render: (row) => `${row.participacionPorcentaje.toFixed(1)}%`,
      sortValue: (row) => row.participacionPorcentaje,
    },
    {
      key: "estimado",
      label: "",
      align: "center",
      render: (row) =>
        row.estimado ? (
          <Chip
            size="small"
            label="Estimado"
            color="warning"
            variant="outlined"
          />
        ) : null,
    },
  ];

  const destinoColumns: ReportColumn<ITransferDestinationRow>[] = [
    {
      key: "nombre",
      label: "Destino",
      render: (row) => row.nombre,
      sortValue: (row) => row.nombre,
    },
    {
      key: "monto",
      label: "Total recibido",
      align: "right",
      render: (row) => format(row.montoBase),
      sortValue: (row) => row.montoBase,
    },
    {
      key: "transacciones",
      label: "Transacciones",
      align: "right",
      render: (row) => formatNumber(row.transacciones),
      sortValue: (row) => row.transacciones,
    },
  ];

  return (
    <Stack spacing={3}>
      <ContentCard title="Mix de métodos de pago y monedas">
        <Stack spacing={2}>
          {ventasEstimadas > 0 && (
            <Alert severity="info">
              {formatNumber(ventasEstimadas)} venta(s) no tienen desglose de
              pagos registrado (anteriores al multimoneda). Su reparto se
              reconstruyó desde los totales de efectivo y transferencia y está
              marcado como estimado.
            </Alert>
          )}

          <ReportDataTable
            rows={mix}
            columns={mixColumns}
            getRowKey={(row) => `${row.tipo}-${row.moneda}`}
            exportName="Mix de metodos de pago"
            initialSortKey="base"
            emptyMessage="No hay cobros registrados en el período"
          />
        </Stack>
      </ContentCard>

      <ContentCard
        title="Conciliación por destino de transferencia"
        subtitle="Para cruzar contra los estados de cuenta"
      >
        <ReportDataTable
          rows={destinos}
          columns={destinoColumns}
          getRowKey={(row) => row.transferDestinationId ?? "sin-destino"}
          exportName="Conciliacion por destino"
          initialSortKey="monto"
          emptyMessage="No hubo cobros por transferencia en el período"
        />
      </ContentCard>
    </Stack>
  );
}
