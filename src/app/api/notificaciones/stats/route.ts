import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";

// GET - Obtener estadísticas de notificaciones (solo SUPER_ADMIN)
export async function GET() {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const ahora = new Date();

    // Obtener todas las notificaciones
    const todasLasNotificaciones = await prisma.notificacion.findMany();

    // Notificaciones activas
    const notificacionesActivas = todasLasNotificaciones.filter(
      notif => ahora >= notif.fechaInicio && ahora <= notif.fechaFin
    );

    // Notificaciones expiradas
    const notificacionesExpiradas = todasLasNotificaciones.filter(
      notif => ahora > notif.fechaFin
    );

    // Notificaciones programadas (futuras)
    const notificacionesProgramadas = todasLasNotificaciones.filter(
      notif => ahora < notif.fechaInicio
    );

    // Estadísticas por tipo
    const statsPorTipo = {
      ALERTA: 0,
      NOTIFICACION: 0,
      PROMOCION: 0,
      MENSAJE: 0
    };

    todasLasNotificaciones.forEach(notif => {
      statsPorTipo[notif.tipo as keyof typeof statsPorTipo]++;
    });

    // Estadísticas por nivel de importancia
    const statsPorImportancia = {
      BAJA: 0,
      MEDIA: 0,
      ALTA: 0,
      CRITICA: 0
    };

    todasLasNotificaciones.forEach(notif => {
      statsPorImportancia[notif.nivelImportancia as keyof typeof statsPorImportancia]++;
    });

    // Notificaciones leídas vs no leídas
    const notificacionesLeidas = todasLasNotificaciones.filter(
      notif => notif.leidoPor && notif.leidoPor.trim() !== ''
    );

    const notificacionesNoLeidas = todasLasNotificaciones.filter(
      notif => !notif.leidoPor || notif.leidoPor.trim() === ''
    );

    // Notificaciones por rango de fechas (últimos 30 días)
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const notificacionesUltimos30Dias = todasLasNotificaciones.filter(
      notif => notif.createdAt >= hace30Dias
    );

    const estadisticas = {
      total: todasLasNotificaciones.length,
      activas: notificacionesActivas.length,
      expiradas: notificacionesExpiradas.length,
      programadas: notificacionesProgramadas.length,
      porTipo: statsPorTipo,
      porImportancia: statsPorImportancia,
      leidas: notificacionesLeidas.length,
      noLeidas: notificacionesNoLeidas.length,
      ultimos30Dias: notificacionesUltimos30Dias.length,
      porcentajeLeidas: todasLasNotificaciones.length > 0 
        ? Math.round((notificacionesLeidas.length / todasLasNotificaciones.length) * 100)
        : 0
    };

    return NextResponse.json(estadisticas);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al cargar las estadísticas' }, { status: 500 });
  }
}
