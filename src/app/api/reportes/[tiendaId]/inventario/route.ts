import { NextRequest, NextResponse } from "next/server";
import { resolveReportScope, wantsDetail } from "@/lib/reports/scope";
import { runAggregators } from "@/lib/reports/aggregators";
import { createProductSalesAggregator } from "@/lib/reports/aggregators/product-sales";
import { buildReportMeta, loadClosingPeriodsSummary } from "@/lib/reports/meta";
import { loadCurrentRates } from "@/lib/reports/rates";
import { rangeDays } from "@/lib/reports/period";
import {
  buildAbcReport,
  buildDeadStockReport,
  buildExpiryRiskReport,
  buildTurnoverReport,
} from "@/lib/reports/inventory";
import type { IInventoryReportResponse } from "@/schemas/reports/inventoryReport";

const SUMMARY_ROWS = 5;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IInventoryReportResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.reportes.inventario",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;
    const detail = wantsDetail(searchParams);

    const [{ results, stats, dimensions }, rates, closings] = await Promise.all(
      [
        runAggregators(scope, { productos: createProductSalesAggregator() }),
        // Stock is valued at today's rates because the stock itself is current.
        loadCurrentRates(scope.negocioId),
        loadClosingPeriodsSummary(scope.tiendaId, scope.range),
      ],
    );

    const days = rangeDays(scope.range);
    const rotacion = buildTurnoverReport(
      dimensions,
      results.productos,
      days,
      scope.baseCurrency,
      rates,
    );
    const capitalInmovilizado = buildDeadStockReport(
      dimensions,
      results.productos,
      scope.baseCurrency,
      rates,
    );
    const abc = buildAbcReport(results.productos);
    const vencimientos = buildExpiryRiskReport(
      dimensions,
      scope.baseCurrency,
      rates,
    );

    const activos = rotacion.filter((row) => row.existenciaActual > 0);

    const response: IInventoryReportResponse = {
      meta: buildReportMeta(scope, stats, closings),
      resumen: {
        productosActivos: activos.length,
        valorInventario: activos.reduce((acc, row) => acc + row.valorStock, 0),
        productosCriticos: rotacion.filter(
          (row) => row.estado === "critico" || row.estado === "bajo",
        ).length,
        productosSobrestock: rotacion.filter(
          (row) => row.estado === "sobrestock",
        ).length,
        capitalInmovilizado: capitalInmovilizado.reduce(
          (acc, row) => acc + row.capitalInmovilizado,
          0,
        ),
        productosSinMovimiento: capitalInmovilizado.length,
        valorEnRiesgoVencimiento: vencimientos.totalEnRiesgo,
        // Coverage mixes present-day stock with past flow, so a historical
        // range makes those columns fiction. Flag it instead of hiding it.
        stockDesalineado: scope.range.to.getTime() < Date.now() - 86_400_000,
      },
      rotacion: detail ? rotacion : rotacion.slice(0, SUMMARY_ROWS),
      capitalInmovilizado: detail
        ? capitalInmovilizado
        : capitalInmovilizado.slice(0, SUMMARY_ROWS),
      abc: detail ? abc : abc.slice(0, SUMMARY_ROWS),
      vencimientos: {
        buckets: vencimientos.buckets,
        productos: detail
          ? vencimientos.rows
          : vencimientos.rows.slice(0, SUMMARY_ROWS),
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Error en reportes/inventario:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
