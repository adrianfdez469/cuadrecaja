import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Solo SUPER_ADMIN puede extender suscripciones
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { daysToAdd } = await request.json();
    
    if (!daysToAdd || daysToAdd <= 0) {
      return NextResponse.json(
        { error: 'Debe especificar un número válido de días' },
        { status: 400 }
      );
    }
    
    await SubscriptionService.extendSubscription(negocioId, daysToAdd);
    
    return NextResponse.json({
      message: `Suscripción del negocio ${negocioId} extendida por ${daysToAdd} días`,
      daysAdded: daysToAdd,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al extender suscripción:', error);
    return NextResponse.json(
      { error: 'Error al extender suscripción' },
      { status: 500 }
    );
  }
}
