import { prisma } from "@/lib/prisma";
import type { ReportScope } from "./scope";
import type { SalesStreamStats } from "./sales-stream";
import type { IDateRange, IReportMeta } from "@/schemas/reports/common";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClosingPeriodsSummary = {
  count: number;
  from: Date | null;
  to: Date | null;
  operatingDays: number;
  ids: string[];
};

/**
 * Summarizes the closings actually covered by a range.
 *
 * Reports are scoped to closings fully contained in the requested window, so
 * the window the user picked and the data behind the numbers routinely differ.
 * This is what lets the UI say "18 cierres, del 3/5 al 28/5" instead of leaving
 * the user to guess why a month looks short.
 */
export async function loadClosingPeriodsSummary(
  tiendaId: string,
  range: IDateRange,
): Promise<ClosingPeriodsSummary> {
  const closings = await prisma.cierrePeriodo.findMany({
    where: {
      tiendaId,
      fechaInicio: { gte: range.from },
      fechaFin: { lte: range.to },
    },
    select: { id: true, fechaInicio: true, fechaFin: true },
    orderBy: { fechaInicio: "asc" },
  });

  if (closings.length === 0) {
    return { count: 0, from: null, to: null, operatingDays: 0, ids: [] };
  }

  let operatingMs = 0;
  for (const closing of closings) {
    if (closing.fechaFin) {
      operatingMs += closing.fechaFin.getTime() - closing.fechaInicio.getTime();
    }
  }

  return {
    count: closings.length,
    from: closings[0].fechaInicio,
    to: closings[closings.length - 1].fechaFin,
    // Fractional days are kept: normalizing by them is what makes a
    // period-over-period comparison fair when the windows hold different
    // numbers of closings.
    operatingDays: Math.max(operatingMs / DAY_MS, 0),
    ids: closings.map((closing) => closing.id),
  };
}

/** Assembles the provenance block every report response must carry. */
export function buildReportMeta(
  scope: ReportScope,
  stats: SalesStreamStats,
  closings: ClosingPeriodsSummary,
  options: { includePrevious?: boolean } = {},
): IReportMeta {
  return {
    tiendaId: scope.tiendaId,
    monedaBase: scope.baseCurrency,
    from: scope.range.from,
    to: scope.range.to,
    previousFrom: options.includePrevious ? scope.previous.from : null,
    previousTo: options.includePrevious ? scope.previous.to : null,
    bucketing: scope.bucketing,
    closingPeriodsIncluded: {
      count: closings.count,
      from: closings.from,
      to: closings.to,
      operatingDays: closings.operatingDays,
    },
    salesScanned: stats.salesScanned,
    linesScanned: stats.linesScanned,
    salesWithoutRates: stats.salesWithoutRates,
    unknownProducts: stats.unknownProducts,
    truncated: stats.truncated,
    generatedAt: new Date(),
  };
}
