import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { calcularEfectivoDisponiblePorMoneda } from "@/lib/movimiento/caja";

// Efectivo disponible en caja por moneda, para el período abierto de la
// tienda — usado por el frontend para avisar ANTES de registrar una compra
// en EFECTIVO_CAJA que supere lo disponible (ver FormaPagoCompra.MIXTO).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.movimientos.crear.compra",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

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

    const disponible = await calcularEfectivoDisponiblePorMoneda(
      tiendaId,
      monedaBase,
    );

    return NextResponse.json({ disponible });
  } catch (error) {
    console.error("Error al calcular efectivo disponible en caja:", error);
    return NextResponse.json(
      { error: "Error al calcular efectivo disponible" },
      { status: 500 },
    );
  }
}
