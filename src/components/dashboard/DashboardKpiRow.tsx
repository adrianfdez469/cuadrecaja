"use client";

import { StatStrip } from "@/components/StatStrip";
import {
  ENVIO_TIENDA_ONLINE_LABEL,
  ENVIO_TIENDA_ONLINE_NOTE,
  MERCANCIA_TIENDA_ONLINE_LABEL,
  tiendaOnlineNote,
} from "@/components/dashboard/dashboardKpiCopy";
import { formatNumber } from "@/utils/formatters";
import type { IDashboardSummary } from "@/schemas/reports/dashboardSummary";
import type { IReportPeriod } from "@/schemas/reports/common";

/** Names the KPI row as a region, so anything measuring it has a stable anchor. */
const KPI_REGION_LABEL = "Indicadores del período";

type DashboardKpiRowProps = {
  ventas: IDashboardSummary["ventas"];
  periodo: IReportPeriod;
  format: (amountInBase: number) => string;
};

/** One cell of the row. `note` is optional, and only some cards carry it. */
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
      title: MERCANCIA_TIENDA_ONLINE_LABEL,
      value: format(ventas.totalMercanciaTiendaOnline),
      note: tiendaOnlineNote(ventas.cantidadVentasTiendaOnline),
      // By COUNT, not by amount (ADR 0075): an online sale of zero is still a
      // sale the merchant wants to see counted.
      show: (ventas.cantidadVentasTiendaOnline || 0) > 0,
    },
    // By AMOUNT, and the difference with the cell above is deliberate: "zero
    // delivery" and "no delivery charged" are the same thing (ADR 0090).
    {
      title: ENVIO_TIENDA_ONLINE_LABEL,
      value: format(ventas.totalEnvioTiendaOnline),
      note: ENVIO_TIENDA_ONLINE_NOTE,
      show: (ventas.totalEnvioTiendaOnline || 0) > 0,
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
    // A named region and nothing else: no padding, no border, no background,
    // no margin. It exists so every measurement of this row can be scoped to
    // it instead of located by nesting or by computed style (E-011).
    <section aria-label={KPI_REGION_LABEL}>
      <StatStrip
        variant="card"
        stats={cards
          .filter((card) => card.show)
          .map((card) => ({
            label: card.title,
            value: card.value,
            // `note` has to travel: it is where the online-store count lives,
            // and the map used to drop it. `StatStrip` already renders it.
            ...(card.note !== undefined && { note: card.note }),
          }))}
      />
    </section>
  );
}
