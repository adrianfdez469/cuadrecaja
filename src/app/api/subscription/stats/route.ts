import { NextResponse } from 'next/server';
import { SubscriptionLib } from '@/lib/subscriptionLib';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function GET() {
  try {
    // Solo SUPER_ADMIN puede ver estadísticas de suscripciones
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    
    const stats = await SubscriptionLib.getSubscriptionStats();
    
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



