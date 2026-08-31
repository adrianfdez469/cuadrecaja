"use client";

import { StatStrip } from "@/components/StatStrip";
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
    <StatStrip
      variant="card"
      stats={cards
        .filter((card) => card.show)
        .map((card) => ({ label: card.title, value: card.value }))}
    />
  );
}
