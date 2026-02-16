import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';

/**
 * GET /api/app/periodo/[tiendaId]/actual
 * 
 * Obtiene el período actual (abierto o último cerrado) de una tienda.
 * Requiere autenticación por token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: 'tiendaId es requerido' },
        { status: 400 }
      );
    }

    // Buscar el último período (abierto o cerrado)
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: 'desc' },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        tiendaId: true,
        totalVentas: true,
        totalGanancia: true,
        totalInversion: true,
        totalTransferencia: true
      }
    });

    if (!ultimoPeriodo) {
      return NextResponse.json({
        success: true,
        periodo: null,
        estaAbierto: false,
        mensaje: 'No hay períodos creados para esta tienda'
      });
    }

    const estaAbierto = ultimoPeriodo.fechaFin === null;

    return NextResponse.json({
      success: true,
      periodo: {
        id: ultimoPeriodo.id,
        fechaInicio: ultimoPeriodo.fechaInicio,
        fechaFin: ultimoPeriodo.fechaFin,
        tiendaId: ultimoPeriodo.tiendaId,
        totalVentas: ultimoPeriodo.totalVentas,
        totalGanancia: ultimoPeriodo.totalGanancia,
        totalInversion: ultimoPeriodo.totalInversion,
        totalTransferencia: ultimoPeriodo.totalTransferencia
      },
      estaAbierto: estaAbierto
    });

  } catch (error) {
    console.error('❌ [APP/PERIODO/ACTUAL] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener el período' },
      { status: 500 }
    );
  }
}
