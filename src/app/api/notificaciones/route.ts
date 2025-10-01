import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";

// GET - Obtener todas las notificaciones (solo SUPER_ADMIN)
export async function GET() {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const notificaciones = await prisma.notificacion.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(notificaciones);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al cargar las notificaciones' }, { status: 500 });
  }
}

// POST - Crear una nueva notificación (solo SUPER_ADMIN)
export async function POST(request: Request) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

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

    const nuevaNotificacion = await prisma.notificacion.create({
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        nivelImportancia: nivelImportancia || 'MEDIA',
        tipo,
        negociosDestino: negociosDestino || "",
        usuariosDestino: usuariosDestino || "",
        leidoPor: ""
      },
    });

    return NextResponse.json(nuevaNotificacion, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al crear la notificación' }, { status: 500 });
  }
}
