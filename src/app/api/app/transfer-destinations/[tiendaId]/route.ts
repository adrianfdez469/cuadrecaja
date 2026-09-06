import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { assertTiendaTenant, withTenantScope } from '@/lib/tenantScope';

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

    // F-021: twin of the web `transfer-destinations`, same reason — no permission, the APK POS
    // loads this on start-up (ADR 0078).
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const transferDestinations = await prisma.transferDestinations.findMany({
      orderBy: [
        { default: 'desc' }, // Primero los marcados como default
        { nombre: 'asc' }
      ],
      where: withTenantScope(
        'transferDestinations',
        { tiendaId: tiendaId },
        scope.negocioId,
      ),
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
