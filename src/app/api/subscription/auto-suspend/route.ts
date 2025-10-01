import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function POST() {
  try {
    // Solo SUPER_ADMIN puede ejecutar suspensiones automáticas
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    console.log('Iniciando verificación de suspensiones automáticas...');
    
    await SubscriptionService.checkAndProcessSuspensions();
    
    const stats = await SubscriptionService.getSubscriptionStats();
    
    return NextResponse.json({
      message: 'Verificación de suspensiones automáticas completada',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al ejecutar suspensiones automáticas:', error);
    return NextResponse.json(
      { error: 'Error al ejecutar suspensiones automáticas' },
      { status: 500 }
    );
  }
}
