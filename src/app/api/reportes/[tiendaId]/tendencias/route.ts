import { NextRequest, NextResponse } from "next/server";
import { resolveReportScope } from "@/lib/reports/scope";
import { runAggregators } from "@/lib/reports/aggregators";
import { createTimeSeriesAggregator } from "@/lib/reports/aggregators/time-series";
import { createHourWeekdayAggregator } from "@/lib/reports/aggregators/hour-weekday";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import { buildReportMeta, loadClosingPeriodsSummary } from "@/lib/reports/meta";
import type { ISalesTrendsResponse } from "@/schemas/reports/salesTrends";
import type { SalesSummary } from "@/lib/reports/aggregators/summary";
import type { ClosingPeriodsSummary } from "@/lib/reports/meta";

/** Percentage change, guarding the zero-baseline case. */
function variation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function toComparison(summary: SalesSummary, closings: ClosingPeriodsSummary) {
  const dias = closings.operatingDays > 0 ? closings.operatingDays : 0;
  return {
    ventasNetas: summary.totalPeriodo,
    ganancia: summary.gananciaTotal,
    transacciones: summary.cantidadVentas,
    diasOperacion: dias,
    // Normalizing by operating days is what makes the comparison fair: the two
    // windows routinely contain different numbers of closings.
    ventasPorDia: dias > 0 ? summary.totalPeriodo / dias : 0,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<ISalesTrendsResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.reportes.tendencias",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;

    const current = await runAggregators(scope, {
      serie: createTimeSeriesAggregator(scope.bucketing),
      heatmap: createHourWeekdayAggregator(),
      summary: createSummaryAggregator(),
    });

    // Second pass over the comparison window, reusing the loaded catalog.
    const previous = await runAggregators(
      scope,
      { summary: createSummaryAggregator() },
      { range: scope.previous, dimensions: current.dimensions },
    );

    const [closingsActual, closingsPrevio] = await Promise.all([
      loadClosingPeriodsSummary(scope.tiendaId, scope.range),
      loadClosingPeriodsSummary(scope.tiendaId, scope.previous),
    ]);

    const actual = toComparison(current.results.summary, closingsActual);
    const anterior = toComparison(previous.results.summary, closingsPrevio);

    const response: ISalesTrendsResponse = {
      meta: buildReportMeta(scope, current.stats, closingsActual, {
        includePrevious: true,
      }),
      serie: current.results.serie,
      actual,
      anterior,
      variacion: {
        ventasNetas: variation(actual.ventasNetas, anterior.ventasNetas),
        ganancia: variation(actual.ganancia, anterior.ganancia),
        transacciones: variation(actual.transacciones, anterior.transacciones),
        ventasPorDia: variation(actual.ventasPorDia, anterior.ventasPorDia),
      },
      heatmap: current.results.heatmap,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Error en reportes/tendencias:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
