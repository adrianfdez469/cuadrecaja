import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";

// GET - Obtener una notificación específica por ID (solo SUPER_ADMIN)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;

    const notificacion = await prisma.notificacion.findUnique({
      where: {
        id: id
      }
    });

    if (!notificacion) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    return NextResponse.json(notificacion);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al cargar la notificación' }, { status: 500 });
  }
}

// PUT - Actualizar una notificación específica por ID (solo SUPER_ADMIN)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;

    const {
      titulo,
      descripcion,
      fechaInicio,
      fechaFin,
      nivelImportancia,
      tipo,
      negociosDestino,
      usuariosDestino
    } = await request.json();

    // Verificar que la notificación existe
    const notificacionExistente = await prisma.notificacion.findUnique({
      where: { id: id }
    });

    if (!notificacionExistente) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    // Validaciones básicas
    if (!titulo || !descripcion || !fechaInicio || !fechaFin || !tipo) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: titulo, descripcion, fechaInicio, fechaFin, tipo' 
      }, { status: 400 });
    }

    // Validar que fechaInicio sea anterior a fechaFin
    if (new Date(fechaInicio) >= new Date(fechaFin)) {
      return NextResponse.json({ 
        error: 'La fecha de inicio debe ser anterior a la fecha de fin' 
      }, { status: 400 });
    }

    const notificacionActualizada = await prisma.notificacion.update({
      where: { id: id },
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        nivelImportancia: nivelImportancia || 'MEDIA',
        tipo,
        negociosDestino: negociosDestino || "",
        usuariosDestino: usuariosDestino || "",
        updatedAt: new Date()
      },
    });

    return NextResponse.json(notificacionActualizada);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al actualizar la notificación' }, { status: 500 });
  }
}

// DELETE - Eliminar una notificación específica por ID (solo SUPER_ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que la notificación existe
    const notificacionExistente = await prisma.notificacion.findUnique({
      where: { id: id }
    });

    if (!notificacionExistente) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    await prisma.notificacion.delete({
      where: { id: id }
    });

    return NextResponse.json({ message: 'Notificación eliminada correctamente' });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al eliminar la notificación' }, { status: 500 });
  }
}
