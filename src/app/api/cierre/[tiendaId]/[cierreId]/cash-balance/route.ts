import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { calcularEfectivoDisponiblePorMoneda } from "@/lib/movimiento/caja";

// Returns real cash available per currency for the currently open period of
// this store: ventas en efectivo - vueltos - gastos - compras/devoluciones +
// fondo inicial. Única fuente de verdad — antes este endpoint tenía su propio
// cálculo simplificado (solo pagos - vueltos), inconsistente con el resto del
// sistema porque no restaba gastos ni compras en efectivo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      select: { negocio: { select: { monedaBase: true } } },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }
    const monedaBase = tienda.negocio?.monedaBase ?? "CUP";

    const balance = await calcularEfectivoDisponiblePorMoneda(
      tiendaId,
      monedaBase,
    );

    return NextResponse.json(balance, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el balance de caja" },
      { status: 500 },
    );
  }
}
