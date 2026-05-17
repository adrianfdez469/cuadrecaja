import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";

type Params = { tiendaId: string; cierreId: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { tiendaId, cierreId } = await params;
    await getSession();

    const cierre = await prisma.cierrePeriodo.findUnique({
      where: { id: cierreId, tiendaId },
      select: { fechaFin: true, tienda: { select: { negocioId: true } } },
    });

    if (!cierre) return NextResponse.json({}, { status: 200 });

    const atDate = cierre.fechaFin ?? new Date();

    // Latest tasa per monedaCode at or before the closing date
    const tasas = await prisma.tasaCambio.findMany({
      where: { negocioId: cierre.tienda.negocioId, createdAt: { lte: atDate } },
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
