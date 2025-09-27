import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function GET(request: Request) {
  try {
    // Solo SUPER_ADMIN puede ver estadísticas de suscripciones
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    console.log('Obteniendo estadísticas de suscripciones...');
    
    const stats = await SubscriptionService.getSubscriptionStats();
    
    return NextResponse.json({
      message: 'Estadísticas obtenidas exitosamente',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de suscripciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de suscripciones' },
      { status: 500 }
    );
  }
}



