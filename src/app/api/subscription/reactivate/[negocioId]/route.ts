import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import dayjs from 'dayjs';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    const { negocioId } = await params;
    
    // Solo SUPER_ADMIN puede reactivar negocios
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { daysToAdd, specificDate } = await request.json();
    
    const negocio = await prisma.negocio.findUnique({
      where: { id: negocioId }
    });

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    let newLimitTime: Date;

    if (specificDate) {
      // Usar fecha específica
      newLimitTime = dayjs(specificDate).toDate();
      if (newLimitTime <= new Date()) {
        return NextResponse.json(
          { error: 'La fecha especificada debe ser futura' },
          { status: 400 }
        );
      }
    } else {
      // Usar días para agregar (por defecto 30)
      const days = daysToAdd || 30;
      newLimitTime = dayjs(negocio.limitTime).add(days, 'day').toDate();
    }
    
    await SubscriptionService.reactivateBusiness(negocioId, newLimitTime);
    
    return NextResponse.json({
      message: `Negocio ${negocioId} reactivado exitosamente`,
      newLimitTime: newLimitTime.toISOString(),
      daysAdded: specificDate ? null : (daysToAdd || 30),
      specificDate: specificDate || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al reactivar negocio:', error);
    return NextResponse.json(
      { error: 'Error al reactivar negocio' },
      { status: 500 }
    );
  }
}
