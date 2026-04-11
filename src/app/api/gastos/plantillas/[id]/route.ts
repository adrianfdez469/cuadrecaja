import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { updateGastoPlantillaSchema } from "@/schemas/gastos";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.gastos.plantillas.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const plantilla = await prisma.gastoPlantilla.findFirst({
      where: { id, negocioId: user.negocio.id },
    });
    if (!plantilla) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateGastoPlantillaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.gastoPlantilla.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error al actualizar plantilla:", error);
    return NextResponse.json({ error: "Error al actualizar plantilla" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.gastos.plantillas.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const plantilla = await prisma.gastoPlantilla.findFirst({
      where: { id, negocioId: user.negocio.id },
    });
    if (!plantilla) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const asignacionesActivas = await prisma.gastoTienda.count({
      where: { plantillaId: id, activo: true },
    });
    if (asignacionesActivas > 0) {
      return NextResponse.json(
        { error: `Esta plantilla tiene ${asignacionesActivas} tienda(s) con gastos activos. Desactívalos antes de eliminarla.` },
        { status: 409 }
      );
    }

    await prisma.gastoPlantilla.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar plantilla:", error);
    return NextResponse.json({ error: "Error al eliminar plantilla" }, { status: 500 });
  }
}
