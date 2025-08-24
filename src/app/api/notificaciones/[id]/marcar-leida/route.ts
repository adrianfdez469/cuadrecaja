import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextResponse } from "next/server";

// POST - Marcar una notificación como leída por el usuario actual
export async function POST(
  request: Request,
  // { params }: { params: { id: string } }
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 });
    }

    const userId = session.user.id;

    // Verificar que la notificación existe
    const notificacion = await prisma.notificacion.findUnique({
      where: { id }
    });

    if (!notificacion) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    // Verificar que la notificación está vigente
    const ahora = new Date();
    if (ahora < notificacion.fechaInicio || ahora > notificacion.fechaFin) {
      return NextResponse.json({ error: 'La notificación no está vigente' }, { status: 400 });
    }

    // Verificar que el usuario puede ver esta notificación
    const puedeVer = await verificarAccesoUsuario(notificacion, userId);
    if (!puedeVer) {
      return NextResponse.json({ error: 'No tienes acceso a esta notificación' }, { status: 403 });
    }

    // Verificar si ya fue marcada como leída
    const leidoPor = notificacion.leidoPor ? notificacion.leidoPor.split(',') : [];
    if (leidoPor.includes(userId)) {
      return NextResponse.json({ message: 'La notificación ya está marcada como leída' });
    }

    // Agregar el usuario a la lista de leídos
    leidoPor.push(userId);
    const nuevoLeidoPor = leidoPor.join(',');

    const notificacionActualizada = await prisma.notificacion.update({
      where: { id: id },
      data: {
        leidoPor: nuevoLeidoPor
      }
    });

    return NextResponse.json({ 
      message: 'Notificación marcada como leída',
      notificacion: notificacionActualizada 
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al marcar la notificación como leída' }, { status: 500 });
  }
}

// Función auxiliar para verificar si un usuario puede ver una notificación
async function verificarAccesoUsuario(notificacion: any, userId: string): Promise<boolean> {
  // Si la notificación está dirigida a usuarios específicos
  if (notificacion.usuariosDestino) {
    const usuariosDestino = notificacion.usuariosDestino.split(',');
    if (usuariosDestino.length > 0 && usuariosDestino[0] !== '') {
      return usuariosDestino.includes(userId);
    }
  }

  // Si la notificación está dirigida a negocios específicos
  if (notificacion.negociosDestino) {
    const negociosDestino = notificacion.negociosDestino.split(',');
    if (negociosDestino.length > 0 && negociosDestino[0] !== '') {
      // Obtener el negocio del usuario
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { negocioId: true }
      });
      
      if (!usuario) return false;
      
      return negociosDestino.includes(usuario.negocioId);
    }
  }

  // Si no hay restricciones específicas, todos pueden verla
  return true;
}
