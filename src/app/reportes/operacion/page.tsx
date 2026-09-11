"use client";

import { Stack } from "@mui/material";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { StatStrip } from "@/components/StatStrip";
import type { Stat } from "@/components/StatStrip";
import { SellerPerformanceTable } from "@/components/reports/operations/SellerPerformanceTable";
import { PaymentMixChart } from "@/components/reports/operations/PaymentMixChart";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getOperationsReport } from "@/services/reportsService";
import { formatNumber } from "@/utils/formatters";
import {
  hasCreditKpi,
  mixSharePercent,
  sumMixByType,
  sumMixCredit,
} from "@/app/reportes/utils/creditoReportes";
import {
  REPORTS_CREDIT_COPY,
  REPORTS_CREDIT_TEST_IDS,
} from "@/constants/reportesCredito";
import type { IOperationsReportResponse } from "@/schemas/reports/operationsReport";

export default function OperacionPage() {
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } =
    useReportData<IOperationsReportResponse>(
      getOperationsReport,
      filters.toQuery,
      filters.ready,
    );

  const mix = data?.pagos.mix ?? [];
  const efectivo = sumMixByType(mix, "cash");
  const transferencia = sumMixByType(mix, "transfer");
  const credit = sumMixCredit(mix);
  const showCredit = hasCreditKpi(credit);

  // The percentage notes keep dividing by `totalBase` — credit included — so they
  // say exactly what the "Participación" column of the table below says (ADR 0132).
  const totalSold = data?.pagos.totalBase ?? 0;

  const stats: Stat[] = data
    ? [
        {
          label: "Total cobrado",
          value: (
            <span data-testid={REPORTS_CREDIT_TEST_IDS.kpiCollected}>
              {currency.format(data.pagos.totalCobradoBase)}
            </span>
          ),
          note: showCredit ? (
            <span data-testid={REPORTS_CREDIT_TEST_IDS.kpiCollectedNote}>
              {REPORTS_CREDIT_COPY.kpiCollectedNote}
            </span>
          ) : undefined,
        },
        ...(showCredit
          ? [
              {
                label: REPORTS_CREDIT_COPY.kpiCreditLabel,
                value: (
                  <span data-testid={REPORTS_CREDIT_TEST_IDS.kpiCredit}>
                    {currency.format(credit)}
                  </span>
                ),
                note: (
                  <span data-testid={REPORTS_CREDIT_TEST_IDS.kpiCreditNote}>
                    {REPORTS_CREDIT_COPY.kpiCreditNote(
                      mixSharePercent(credit, totalSold),
                    )}
                  </span>
                ),
              },
            ]
          : []),
        {
          label: "Efectivo",
          value: currency.format(efectivo),
          note:
            totalSold > 0
              ? REPORTS_CREDIT_COPY.kpiShareNote(
                  mixSharePercent(efectivo, totalSold),
                )
              : undefined,
        },
        {
          label: "Transferencia",
          value: currency.format(transferencia),
          note:
            totalSold > 0
              ? REPORTS_CREDIT_COPY.kpiShareNote(
                  mixSharePercent(transferencia, totalSold),
                )
              : undefined,
        },
        {
          label: "Vendedores activos",
          value: formatNumber(data.vendedores.length),
        },
      ]
    : [];

  return (
    <ReportPageShell
      title="Operación"
      subtitle="Rendimiento por vendedor y composición de los cobros"
      filters={filters}
      currency={currency}
      loading={loading}
      error={error}
      meta={data?.meta ?? null}
      onRefresh={refetch}
    >
      {data && (
        <Stack spacing={3}>
          <StatStrip variant="card" stats={stats} />

          <SellerPerformanceTable
            rows={data.vendedores}
            format={currency.format}
          />

          <PaymentMixChart
            mix={data.pagos.mix}
            destinos={data.pagos.destinos}
            ventasEstimadas={data.pagos.ventasEstimadas}
            format={currency.format}
          />
        </Stack>
      )}
    </ReportPageShell>
  );
}
