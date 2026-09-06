import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { resolveTenantAxis, withTenantScope } from "@/lib/tenantScope";

type Params = { tiendaId: string; cierreId: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { tiendaId, cierreId } = await params;

    // F-021, gate B. No permission — the closing screen consumes this (ADR 0078).
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: null,
    });
    if (!negocioId) return response;

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope(
        "cierrePeriodo",
        { id: cierreId, tiendaId },
        negocioId,
      ),
      select: { fechaFin: true },
    });

    if (!cierre) return NextResponse.json({}, { status: 200 });

    const atDate = cierre.fechaFin ?? new Date();

    // Latest tasa per monedaCode at or before the closing date. The `negocioId` comes from the
    // SESSION, never from the row of the period.
    const tasas = await prisma.tasaCambio.findMany({
      where: withTenantScope(
        "tasaCambio",
        { createdAt: { lte: atDate } },
        negocioId,
      ),
      orderBy: { createdAt: "desc" },
      distinct: ["monedaCode"],
    });

    const snapshot: Record<string, number> = {};
    for (const t of tasas) snapshot[t.monedaCode] = t.tasa;

    return NextResponse.json(snapshot, { status: 200 });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
