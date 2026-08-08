import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReportScope } from "@/lib/reports/scope";
import { runAggregators } from "@/lib/reports/aggregators";
import { createSellerPerformanceAggregator } from "@/lib/reports/aggregators/seller-performance";
import { createPaymentMixAggregator } from "@/lib/reports/aggregators/payment-mix";
import { buildReportMeta, loadClosingPeriodsSummary } from "@/lib/reports/meta";
import type { IOperationsReportResponse } from "@/schemas/reports/operationsReport";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IOperationsReportResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);

    const resolved = await resolveReportScope(
      searchParams,
      tiendaId,
      "recuperaciones.reportes.operacion",
    );
    if (!resolved.scope) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { scope } = resolved;

    const [{ results, stats }, closings] = await Promise.all([
      runAggregators(scope, {
        vendedores: createSellerPerformanceAggregator(),
        pagos: createPaymentMixAggregator(scope.baseCurrency),
      }),
      loadClosingPeriodsSummary(scope.tiendaId, scope.range),
    ]);

    // Resolve names only for the sellers and destinations actually observed.
    const sellerIds = results.vendedores.map((row) => row.sellerId);
    const destinationIds = results.pagos.destinos
      .map((row) => row.transferDestinationId)
      .filter((id): id is string => Boolean(id));

    const [usuarios, destinos] = await Promise.all([
      sellerIds.length
        ? prisma.usuario.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, nombre: true },
          })
        : [],
      destinationIds.length
        ? prisma.transferDestinations.findMany({
            where: { id: { in: destinationIds } },
            select: { id: true, nombre: true },
          })
        : [],
    ]);

    const usuarioById = new Map<string, string>(
      usuarios.map((u) => [u.id, u.nombre] as const),
    );
    const destinoById = new Map<string, string>(
      destinos.map((d) => [d.id, d.nombre] as const),
    );

    const response: IOperationsReportResponse = {
      meta: buildReportMeta(scope, stats, closings),
      vendedores: results.vendedores.map((row) => ({
        ...row,
        nombre: usuarioById.get(row.sellerId) ?? "Usuario eliminado",
      })),
      pagos: {
        mix: results.pagos.rows,
        destinos: results.pagos.destinos.map((row) => ({
          ...row,
          nombre: row.transferDestinationId
            ? (destinoById.get(row.transferDestinationId) ??
              "Destino eliminado")
            : "Sin destino asignado",
        })),
        totalBase: results.pagos.totalBase,
        ventasEstimadas: results.pagos.ventasEstimadas,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Error en reportes/operacion:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
