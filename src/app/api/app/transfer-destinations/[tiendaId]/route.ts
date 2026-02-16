import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';

/**
 * GET /api/app/transfer-destinations/[tiendaId]
 * 
 * Obtiene los destinos de transferencia disponibles para una tienda.
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

    const transferDestinations = await prisma.transferDestinations.findMany({
      orderBy: [
        { default: 'desc' }, // Primero los marcados como default
        { nombre: 'asc' }
      ],
      where: {
        tiendaId: tiendaId
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        default: true
      }
    });

    return NextResponse.json({
      success: true,
      destinos: transferDestinations,
      total: transferDestinations.length
    });

  } catch (error) {
    console.error('❌ [APP/TRANSFER-DESTINATIONS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener destinos de transferencia' },
      { status: 500 }
    );
  }
}
