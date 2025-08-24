import { NotificationService } from "@/services/notificationService";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";

// POST - Ejecutar verificaciones automáticas de notificaciones (solo SUPER_ADMIN)
export async function POST(request: Request) {
  try {
    const { negocioId } = await request.json().catch(() => ({}));

    if (!negocioId && !(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    
    console.log('Iniciando verificaciones automáticas de notificaciones...');
    
    await NotificationService.runAutomaticChecks(negocioId);
    
    return NextResponse.json({ 
      message: 'Verificaciones automáticas completadas exitosamente',
      timestamp: new Date().toISOString(),
      negocioId: negocioId || 'todos'
    });
  } catch (error) {
    console.error('Error al ejecutar verificaciones automáticas:', error);
    return NextResponse.json({ 
      error: 'Error al ejecutar las verificaciones automáticas' 
    }, { status: 500 });
  }
}

// GET - Obtener información sobre las verificaciones automáticas (solo SUPER_ADMIN)
export async function GET() {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const info = {
      description: "Endpoint para ejecutar verificaciones automáticas de notificaciones",
      checks: [
        "Verificación de expiración de suscripciones",
        "Verificación de límites de productos",
        "Verificación de límites de usuarios"
      ],
      usage: "POST /api/notificaciones/auto-check para ejecutar las verificaciones",
      automaticTriggers: [
        "Expiración de suscripción (7, 3, 1 días antes)",
        "Límite de productos (90% y 95% del límite)",
        "Límite de usuarios (90% y 95% del límite)"
      ]
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error('Error al obtener información de verificaciones automáticas:', error);
    return NextResponse.json({ 
      error: 'Error al obtener información' 
    }, { status: 500 });
  }
}
