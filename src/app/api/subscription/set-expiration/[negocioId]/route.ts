import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import dayjs from 'dayjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Solo SUPER_ADMIN puede establecer fechas de expiración
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { expirationDate } = await request.json();
    
    if (!expirationDate) {
      return NextResponse.json(
        { error: 'Debe especificar una fecha de expiración' },
        { status: 400 }
      );
    }

    const newExpirationDate = dayjs(expirationDate).toDate();
    
    if (newExpirationDate <= new Date()) {
      return NextResponse.json(
        { error: 'La fecha de expiración debe ser futura' },
        { status: 400 }
      );
    }
    
    await SubscriptionService.setExpirationDate(negocioId, newExpirationDate);
    
    return NextResponse.json({
      message: `Fecha de expiración establecida exitosamente para el negocio ${negocioId}`,
      newExpirationDate: newExpirationDate.toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al establecer fecha de expiración:', error);
    return NextResponse.json(
      { error: 'Error al establecer fecha de expiración' },
      { status: 500 }
    );
  }
}
