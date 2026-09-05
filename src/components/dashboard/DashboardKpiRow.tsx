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

/**
 * The note under the online-store figure, in its two written forms.
 *
 * It is not decoration: `totalTiendaOnline` is PART of `totalPeriodo`, and a
 * figure sitting next to another figure in a KPI row reads as summable. The
 * note is what stops somebody from counting it twice (ADR 0075).
 */
function tiendaOnlineNote(cantidad: number): string {
  if (cantidad === 1) return "1 venta, ya contada en el total de ventas";
  return `${formatNumber(cantidad)} ventas, ya contadas en el total de ventas`;
}

/** One cell of the row. `note` is optional, and only one card carries it. */
type KpiCard = {
  title: string;
  value: string;
  note?: string;
  show: boolean;
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
  const cards: KpiCard[] = [
    {
      title: salesTitle(periodo),
      value: format(ventas.totalPeriodo),
      show: true,
    },
    // Right after the sales of the period, because it qualifies that figure:
    // «part of this» has to sit next to «this».
    {
      title: "Ventas de tienda online",
      value: format(ventas.totalTiendaOnline),
      note: tiendaOnlineNote(ventas.cantidadVentasTiendaOnline),
      show: (ventas.cantidadVentasTiendaOnline || 0) > 0,
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
        .map((card) => ({
          label: card.title,
          value: card.value,
          // `note` has to travel: it is where the online-store count lives, and
          // the map used to drop it. `StatStrip` already renders it.
          ...(card.note !== undefined && { note: card.note }),
        }))}
    />
  );
}
