import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Solo SUPER_ADMIN puede suspender negocios
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { forceManual = true } = await request.json().catch(() => ({}));

    await SubscriptionService.suspendBusiness(negocioId, forceManual);
    
    return NextResponse.json({
      message: `Negocio ${negocioId} suspendido exitosamente`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al suspender negocio:', error);
    return NextResponse.json(
      { error: 'Error al suspender negocio' },
      { status: 500 }
    );
  }
}
