import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.ver", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tienda: { negocioId: user.negocio.id } },
    });
    if (!cierre) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }

    const gastos = await prisma.gastoCierre.findMany({
      where: { cierreId },
      orderBy: [{ esAdHoc: "asc" }, { createdAt: "asc" }],
    });

    const totalGastos = gastos.reduce((s, g) => s + g.montoCalculado, 0);

    // Agrupar por categoría
    const agrupados: Record<string, typeof gastos> = {};
    for (const g of gastos) {
      if (!agrupados[g.categoria]) agrupados[g.categoria] = [];
      agrupados[g.categoria].push(g);
    }

    return NextResponse.json({ gastos, totalGastos, agrupados });
  } catch (error) {
    console.error("Error al obtener gastos del cierre:", error);
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 });
  }
}
