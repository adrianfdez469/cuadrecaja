"use client";

import Grid from "@mui/material/Grid2";
import { StatCard } from "@/components/StatCard";
import { formatNumber } from "@/utils/formatters";
import type { IDashboardSummary } from "@/schemas/reports/dashboardSummary";
import type { IReportPeriod } from "@/schemas/reports/common";

type DashboardKpiRowProps = {
  ventas: IDashboardSummary["ventas"];
  periodo: IReportPeriod;
  format: (amountInBase: number) => string;
};

function salesTitle(periodo: IReportPeriod): string {
  if (periodo === "dia") return "Ventas de hoy";
  if (periodo === "mes") return "Ventas del mes";
  return "Ventas del período";
}

/**
 * Headline KPIs. Deduction cards only appear when there is something to
 * deduct, so a clean period stays uncluttered.
 */
export function DashboardKpiRow({
  ventas,
  periodo,
  format,
}: DashboardKpiRowProps) {
  const cards = [
    {
      title: salesTitle(periodo),
      value: format(ventas.totalPeriodo),
      show: true,
    },
    {
      title: "Ganancia estimada",
      value: format(ventas.gananciaFinal ?? ventas.gananciaTotal),
      show: true,
    },
    {
      title: "Gastos",
      value: format(ventas.totalGastos),
      show: (ventas.totalGastos || 0) > 0,
    },
    {
      title: "Merma",
      value: format(ventas.totalMerma),
      show: (ventas.totalMerma || 0) > 0,
    },
    {
      title: "Devoluciones de venta",
      value: format(ventas.totalDevoluciones),
      show: (ventas.totalDevoluciones || 0) > 0,
    },
    {
      title: "Unidades vendidas",
      value: formatNumber(ventas.unidadesVendidas),
      show: true,
    },
  ];

  return (
    <Grid container columnSpacing={3}>
      {cards
        .filter((card) => card.show)
        .map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title={card.title} value={card.value} />
          </Grid>
        ))}
    </Grid>
  );
}
