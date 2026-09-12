import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { DEFAULT_TICKET_PLANTILLA } from "@/schemas/ticketPlantilla";

/**
 * GET /api/app/ticket-plantilla/[tiendaId]
 *
 * Plantilla del ticket de la tienda, para que la app Flutter la cachee y pueda
 * imprimir sin conexión: la plantilla viaja embebida dentro del payload del
 * ticket, así que quien imprime no necesita consultar al servidor.
 *
 * **Nunca devuelve 404 por falta de plantilla**: si el negocio no la configuró
 * desde la web, responde con los valores por defecto. Quedarse sin imprimir
 * porque nadie tocó la configuración sería el peor de los desenlaces.
 *
 * Ver `.claude/docs/IMPRESION.md` en el repo `cuadre_caja_app`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "tiendaId es requerido" },
        { status: 400 },
      );
    }

    // La tienda tiene que ser del negocio del token: el tiendaId llega del
    // cliente y no se puede confiar en él.
    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: session.user.negocio.id },
      select: { id: true },
    });

    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    const plantilla = await prisma.ticketPlantilla.findUnique({
      where: { tiendaId },
    });

    if (!plantilla) {
      return NextResponse.json({
        tiendaId,
        ...DEFAULT_TICKET_PLANTILLA,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ...plantilla,
      updatedAt: plantilla.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("❌ [APP/TICKET-PLANTILLA] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener la plantilla de ticket" },
      { status: 500 },
    );
  }
}
