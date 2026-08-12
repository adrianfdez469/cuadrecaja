import { NextRequest, NextResponse } from "next/server";
import { resolveReportScope } from "@/lib/reports/scope";
import { loadProductDimensions } from "@/lib/reports/sales-stream";
import { buildReportMeta, loadClosingPeriodsSummary } from "@/lib/reports/meta";
import { loadShrinkageReport } from "@/lib/reports/shrinkage";
import type { IShrinkageReportResponse } from "@/schemas/reports/shrinkageReport";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IShrinkageReportResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.reportes.mermas",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;

    const [dimensions, closings] = await Promise.all([
      loadProductDimensions(scope.tiendaId),
      loadClosingPeriodsSummary(scope.tiendaId, scope.range),
    ]);

    // Stock movements have no closing reference, so align the window with the
    // closings actually included — otherwise this report would not reconcile
    // with the totalMerma the profitability statement reads from them.
    const window = {
      from: closings.from ?? scope.range.from,
      to: closings.to ?? scope.range.to,
    };

    const report = await loadShrinkageReport(
      scope.tiendaId,
      dimensions,
      window,
    );

    const response: IShrinkageReportResponse = {
      meta: buildReportMeta(
        scope,
        {
          salesScanned: 0,
          linesScanned: 0,
          salesWithoutRates: 0,
          unknownProducts: 0,
          truncated: false,
          closingPeriodIds: new Set<string>(),
        },
        closings,
      ),
      productos: report.productos,
      motivos: report.motivos,
      totalMerma: report.totalMerma,
      totalDevoluciones: report.totalDevoluciones,
      perdidaTotal: report.perdidaTotal,
      ventana: { from: report.from, to: report.to },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Error en reportes/mermas:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
