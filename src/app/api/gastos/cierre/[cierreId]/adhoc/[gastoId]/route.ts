import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cierreId: string; gastoId: string }> }
) {
  try {
    const { cierreId, gastoId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tienda: { negocioId: user.negocio.id } },
    });
    if (!cierre) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }
    if (cierre.fechaFin) {
      return NextResponse.json({ error: "No se puede eliminar un gasto de un período ya cerrado" }, { status: 400 });
    }

    const gasto = await prisma.gastoCierre.findFirst({
      where: { id: gastoId, cierreId, esAdHoc: true },
    });
    if (!gasto) {
      return NextResponse.json({ error: "Gasto ad-hoc no encontrado" }, { status: 404 });
    }

    await prisma.gastoCierre.delete({ where: { id: gastoId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar gasto ad-hoc:", error);
    return NextResponse.json({ error: "Error al eliminar gasto" }, { status: 500 });
  }
}
