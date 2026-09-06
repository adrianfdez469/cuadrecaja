import { NotificationService } from "@/services/notificationService";
import { getSession, hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";
import { sessionNegocioId, tenantForbiddenResponse } from "@/lib/tenantScope";

// POST - Ejecutar verificaciones automáticas de notificaciones
export async function POST(request: Request) {
  try {
    const { negocioId: negocioIdSolicitado } = await request
      .json()
      .catch(() => ({}));

    // F-021 removes the bypass. A SUPER_ADMIN may target a business (or none, and then it runs
    // over all of them); any other session runs ONLY over its own business, and the `negocioId`
    // of the body is ignored rather than rejected, so no existing caller breaks.
    const esSuperAdmin = await hasSuperAdminPrivileges();
    let alcance: string | undefined;

    if (esSuperAdmin) {
      alcance = negocioIdSolicitado || undefined;
    } else {
      const propio = sessionNegocioId(await getSession());
      if (!propio) return tenantForbiddenResponse();
      alcance = propio;
    }

    await NotificationService.runAutomaticChecks(alcance);

    return NextResponse.json({ 
      message: 'Verificaciones automáticas completadas exitosamente',
      timestamp: new Date().toISOString(),
      negocioId: alcance || 'todos'
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
