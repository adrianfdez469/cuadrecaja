import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReportScope } from "@/lib/reports/scope";
import { runAggregators } from "@/lib/reports/aggregators";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import { createCategoryMarginAggregator } from "@/lib/reports/aggregators/category-margin";
import { createDiscountRulesAggregator } from "@/lib/reports/aggregators/discount-rules";
import { buildReportMeta, loadClosingPeriodsSummary } from "@/lib/reports/meta";
import { loadClosingDeductions } from "@/lib/reports/closing-totals";
import { buildIncomeStatement } from "@/lib/reports/income-statement";
import type { IProfitabilityReportResponse } from "@/schemas/reports/profitabilityReport";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IProfitabilityReportResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.reportes.rentabilidad",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;

    const [{ results, stats }, deductions, closings] = await Promise.all([
      runAggregators(scope, {
        summary: createSummaryAggregator(),
        categorias: createCategoryMarginAggregator(),
        descuentos: createDiscountRulesAggregator(),
      }),
      loadClosingDeductions(scope.tiendaId, scope.range),
      loadClosingPeriodsSummary(scope.tiendaId, scope.range),
    ]);

    const estadoResultados = await buildIncomeStatement(
      scope,
      results.summary,
      deductions,
      closings.ids,
    );

    // Resolve rule names only for the rules actually used in the range.
    const ruleIds = results.descuentos.rows
      .map((row) => row.discountRuleId)
      .filter(Boolean);
    const rules = ruleIds.length
      ? await prisma.discountRule.findMany({
          where: { id: { in: ruleIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

    const reglas = results.descuentos.rows.map((row) => {
      const rule = ruleById.get(row.discountRuleId);
      return {
        ...row,
        nombre: rule?.name ?? "Regla eliminada",
        tipo: rule?.type ?? null,
      };
    });

    const atribuido = reglas.reduce((acc, row) => acc + row.montoDescontado, 0);

    const response: IProfitabilityReportResponse = {
      meta: buildReportMeta(scope, stats, closings),
      estadoResultados,
      categorias: results.categorias,
      descuentos: {
        reglas,
        totalDescontado: results.descuentos.totalDescontado,
        ventasConDescuento: results.descuentos.ventasConDescuento,
        sinReglaAsociada: Math.max(
          0,
          results.descuentos.totalDescontado - atribuido,
        ),
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Error en reportes/rentabilidad:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
