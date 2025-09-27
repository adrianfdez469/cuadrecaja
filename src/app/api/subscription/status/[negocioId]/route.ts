import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import getUserFromRequest from '@/utils/getUserFromRequest';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Verificar permisos: SUPER_ADMIN puede ver cualquier negocio, usuarios normales solo el suyo
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const isSuperAdmin = await hasSuperAdminPrivileges();
    const userNegocioId = user.negocio?.id;

    if (!isSuperAdmin && userNegocioId !== negocioId) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const status = await SubscriptionService.getSubscriptionStatus(negocioId);
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error al obtener estado de suscripción:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado de suscripción' },
      { status: 500 }
    );
  }
}
