import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";

// 1. Obtiene el último período
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    // No permission: same POS start-up call as `transfer-destinations` (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope(
        "cierrePeriodo",
        { tiendaId: scope.tiendaId },
        scope.negocioId,
      ),
      orderBy: { fechaInicio: "desc" },
    });

    // Retornar null explícitamente si no hay períodos
    return NextResponse.json(ultimoPeriodo || null);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al obtener el estado del período" }, { status: 500 });
  }
}
