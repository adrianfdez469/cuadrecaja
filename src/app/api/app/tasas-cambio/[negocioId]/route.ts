import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { assertNegocioAccess } from "@/lib/appNegocioAccess";
import { buildTasaSnapshotWithMeta } from "@/lib/currency";

/**
 * GET /api/app/tasas-cambio/[negocioId]
 *
 * Tasas vigentes para conversiones y snapshot de ventas (cache offline).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ negocioId: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    const { negocioId } = await params;

    const accessError = assertNegocioAccess(session, negocioId);
    if (accessError) return accessError;

    const negocio = await prisma.negocio.findUnique({
      where: { id: negocioId },
      select: { monedaBase: true },
    });

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 },
      );
    }

    const tasas = await prisma.tasaCambio.findMany({
      where: { negocioId },
      select: { monedaCode: true, tasa: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const monedaBase = negocio.monedaBase ?? "CUP";
    // One object, for everything the app does with rates — pricing the basket,
    // converting payments and the `tasaSnapshot` it persists with the sale. It
    // carries the business's own monedaBase: rates are anchored on CUP and a
    // USD-based business needs USD's CUP rate to value CUP/EUR payments. A
    // second, "complete" object (`tasasCup`) used to ship alongside a filtered
    // `vigentes`; two sources of truth is how snapshots without the base got
    // persisted, so there is deliberately only one now.
    const { vigentes, actualizadoEn } = buildTasaSnapshotWithMeta(tasas);

    return NextResponse.json({
      monedaBase,
      vigentes,
      ...(actualizadoEn && { actualizadoEn }),
    });
  } catch (error) {
    console.error("❌ [APP/TASAS-CAMBIO] Error:", error);
    return NextResponse.json(
      { error: "Error al cargar tasas de cambio" },
      { status: 500 },
    );
  }
}
