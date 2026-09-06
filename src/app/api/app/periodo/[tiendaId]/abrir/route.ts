import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { assertTiendaTenant } from '@/lib/tenantScope';

/**
 * POST /api/app/periodo/[tiendaId]/abrir
 * 
 * Abre un nuevo período de caja para una tienda.
 * Solo se puede abrir si el período anterior está cerrado.
 * Requiere autenticación por token.
 */
export async function POST(
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

    // F-021, gate A and necessarily so: the raw SQL below has no `where` to fold a tenant clause
    // into, so ownership is resolved BEFORE the transaction opens. No permission — the APK cashier
    // opens the drawer (ADR 0078).
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    // Usar transacción con lock para prevenir race conditions
    const nuevoPeriodo = await prisma.$transaction(async (tx) => {
      // Buscar el último período con lock FOR UPDATE para prevenir duplicados
      const ultimoPeriodos = await tx.$queryRaw<Array<{ id: string; fechaFin: Date | null }>>`
        SELECT "id", "fechaFin" FROM "CierrePeriodo" 
        WHERE "tiendaId" = ${tiendaId} 
        ORDER BY "fechaInicio" DESC 
        LIMIT 1 
        FOR UPDATE
      `;

      const ultimoPeriodo = ultimoPeriodos.length > 0 ? ultimoPeriodos[0] : null;

      // Verificar si ya existe un período abierto
      if (ultimoPeriodo && !ultimoPeriodo.fechaFin) {
        throw new Error('PERIODO_ABIERTO');
      }

      // Crear el nuevo período dentro de la transacción
      return tx.cierrePeriodo.create({
        data: {
          fechaInicio: new Date(),
          tiendaId,
        },
        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
          tiendaId: true
        }
      });
    });

    return NextResponse.json({
      success: true,
      periodo: nuevoPeriodo,
      estaAbierto: true
    }, { status: 201 });

  } catch (error) {
    console.error('❌ [APP/PERIODO/ABRIR] Error:', error);

    // Manejar el error específico de período ya abierto
    if (error instanceof Error && error.message === 'PERIODO_ABIERTO') {
      return NextResponse.json(
        { error: 'Ya existe un período abierto. Ciérralo antes de abrir uno nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al abrir el período' },
      { status: 500 }
    );
  }
}
