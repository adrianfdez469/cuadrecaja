import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextResponse } from "next/server";

// GET - Obtener notificaciones activas para el usuario actual
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 });
    }

    const userId = session.user.id;
    const ahora = new Date();

    // Obtener todas las notificaciones activas
    const notificacionesActivas = await prisma.notificacion.findMany({
      where: {
        fechaInicio: {
          lte: ahora
        },
        fechaFin: {
          gte: ahora
        }
      },
      // orderBy: {
      //   nivelImportancia: 'desc',
      //   // createdAt: 'desc'
      // }
    });

    // Filtrar las notificaciones que puede ver el usuario
    const notificacionesFiltradas = await Promise.all(
      notificacionesActivas.map(async (notificacion) => {
        const puedeVer = await verificarAccesoUsuario(notificacion, userId);
        if (puedeVer) {
          // Verificar si ya fue leída
          const leidoPor = notificacion.leidoPor ? notificacion.leidoPor.split(',') : [];
          const yaLeida = leidoPor.includes(userId);
          
          return {
            ...notificacion,
            yaLeida
          };
        }
        return null;
      })
    );

    // Filtrar las notificaciones nulas y ordenar por importancia y fecha
    const notificacionesFinales = notificacionesFiltradas
      .filter(notificacion => notificacion !== null)
      .sort((a, b) => {
        // Primero por nivel de importancia
        const importanciaOrder = { 'CRITICA': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
        const importanciaA = importanciaOrder[a.nivelImportancia as keyof typeof importanciaOrder] || 0;
        const importanciaB = importanciaOrder[b.nivelImportancia as keyof typeof importanciaOrder] || 0;
        
        if (importanciaA !== importanciaB) {
          return importanciaB - importanciaA;
        }
        
        // Luego por fecha de creación (más recientes primero)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return NextResponse.json(notificacionesFinales);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al cargar las notificaciones activas' }, { status: 500 });
  }
}

// Función auxiliar para verificar si un usuario puede ver una notificación
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
