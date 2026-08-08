import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularGananciaFinal } from "@/lib/gastos";
import { resolveReportScope } from "@/lib/reports/scope";
import { runAggregators } from "@/lib/reports/aggregators";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import {
  createProductSalesAggregator,
  rentabilidadPorcentual,
} from "@/lib/reports/aggregators/product-sales";
import { loadClosingDeductions } from "@/lib/reports/closing-totals";
import type { IDashboardSummary } from "@/schemas/reports/dashboardSummary";

const TOP_LIMIT = 10;
const BOTTOM_LIMIT = 5;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IDashboardSummary | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.dashboard.acceder",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;

    const [{ results }, deductions, productosActivos] = await Promise.all([
      runAggregators(scope, {
        summary: createSummaryAggregator(),
        productos: createProductSalesAggregator(),
      }),
      loadClosingDeductions(scope.tiendaId, scope.range),
      prisma.productoTienda.count({
        where: {
          tiendaId: scope.tiendaId,
          existencia: { gt: 0 },
          deletedAt: null,
        },
      }),
    ]);

    const { summary, productos } = results;
    const gananciaFinal = calcularGananciaFinal(
      summary.gananciaTotal,
      deductions.totalGastos,
      deductions.totalMerma,
      deductions.totalDevoluciones,
    );

    const porUnidades = [...productos.rows].sort(
      (a, b) => b.unidades - a.unidades,
    );
    const porGanancia = [...productos.rows].sort(
      (a, b) => b.ganancia - a.ganancia,
    );

    const response: IDashboardSummary = {
      ventas: {
        totalPeriodo: summary.totalPeriodo,
        unidadesVendidas: summary.unidadesVendidas,
        gananciaTotal: summary.gananciaTotal,
        totalGastos: deductions.totalGastos,
        totalMerma: deductions.totalMerma,
        totalDevoluciones: deductions.totalDevoluciones,
        gananciaFinal,
        productosActivos,
      },
      topProductos: porUnidades
        .slice(0, TOP_LIMIT)
        .map(({ nombre, unidades }) => ({ nombre, unidades })),
      topGanancias: porGanancia
        .slice(0, TOP_LIMIT)
        .map(({ nombre, ganancia }) => ({ nombre, ganancia })),
      productosMenosVendidos: [...productos.rows]
        .sort((a, b) => a.unidades - b.unidades)
        .slice(0, BOTTOM_LIMIT)
        .map(({ nombre, unidades }) => ({ nombre, unidades })),
      productosMenosRentables: [...productos.rows]
        .map((row) => ({
          nombre: row.nombre,
          rentabilidad: parseFloat(rentabilidadPorcentual(row).toFixed(2)),
        }))
        .sort((a, b) => a.rentabilidad - b.rentabilidad)
        .slice(0, BOTTOM_LIMIT),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error en dashboard/resumen:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
