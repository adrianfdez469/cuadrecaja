import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { updateGastoTiendaSchema } from "@/schemas/gastos";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; gastoId: string }> }
) {
  try {
    const { tiendaId, gastoId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const gasto = await prisma.gastoTienda.findFirst({
      where: { id: gastoId, tiendaId, negocioId: user.negocio.id },
    });
    if (!gasto) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateGastoTiendaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.gastoTienda.update({
      where: { id: gastoId },
      data: parsed.data,
      include: { plantilla: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error al actualizar gasto:", error);
    return NextResponse.json({ error: "Error al actualizar gasto" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; gastoId: string }> }
) {
  try {
    const { tiendaId, gastoId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const gasto = await prisma.gastoTienda.findFirst({
      where: { id: gastoId, tiendaId, negocioId: user.negocio.id },
    });
    if (!gasto) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    const tieneHistorial = await prisma.gastoCierre.count({ where: { gastoTiendaId: gastoId } });

    if (tieneHistorial > 0) {
      // Soft delete: preserva el historial
      await prisma.gastoTienda.update({ where: { id: gastoId }, data: { activo: false } });
    } else {
      await prisma.gastoTienda.delete({ where: { id: gastoId } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar gasto:", error);
    return NextResponse.json({ error: "Error al eliminar gasto" }, { status: 500 });
  }
}
