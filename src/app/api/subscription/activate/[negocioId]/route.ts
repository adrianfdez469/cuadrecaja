import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Solo SUPER_ADMIN puede activar negocios
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    await SubscriptionService.activateBusiness(negocioId);
    
    return NextResponse.json({
      message: `Negocio ${negocioId} activado exitosamente`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al activar negocio:', error);
    return NextResponse.json(
      { error: 'Error al activar negocio' },
      { status: 500 }
    );
  }
}
