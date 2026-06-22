import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { assertNegocioAccess } from "@/lib/appNegocioAccess";

/**
 * GET /api/app/monedas/[negocioId]
 *
 * Monedas activas del negocio con denominaciones de billetes para cache offline.
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
      select: { id: true },
    });

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 },
      );
    }

    const monedas = await prisma.negocioMoneda.findMany({
      where: { negocioId, activo: true },
      include: {
        moneda: {
          include: {
            denominaciones: {
              where: { activo: true },
              orderBy: { orden: "desc" },
            },
          },
        },
      },
      orderBy: { monedaCode: "asc" },
    });

    return NextResponse.json({ monedas });
  } catch (error) {
    console.error("❌ [APP/MONEDAS] Error:", error);
    return NextResponse.json(
      { error: "Error al cargar monedas del negocio" },
      { status: 500 },
    );
  }
}
