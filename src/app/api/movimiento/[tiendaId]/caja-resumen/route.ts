import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { calcularResumenCajaPorMoneda } from "@/lib/movimiento/caja";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { IResumenCajaResponse } from "@/schemas/resumenCaja";

// Desglose de caja (fondo inicial vs. ventas reales) del período abierto de
// la tienda — usado por el widget de caja del POS.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<IResumenCajaResponse | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.cierre.acceder",
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
    const monedaBase = tienda.negocio?.monedaBase ?? DEFAULT_CURRENCY;

    const resumen = await calcularResumenCajaPorMoneda(tiendaId, monedaBase);

    return NextResponse.json({ monedaBase, resumen });
  } catch (error) {
    console.error("Error al calcular el resumen de caja:", error);
    return NextResponse.json(
      { error: "Error al calcular el resumen de caja" },
      { status: 500 },
    );
  }
}
