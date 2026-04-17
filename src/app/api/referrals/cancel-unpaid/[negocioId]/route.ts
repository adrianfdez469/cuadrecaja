import { NextResponse } from 'next/server';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { cancelReferralIfBusinessDeletedUnpaid } from '@/lib/referrals/cancelUnpaidReferral';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const { negocioId } = await params;
    await cancelReferralIfBusinessDeletedUnpaid({
      businessId: negocioId,
      deletedAt: new Date(),
      reason: 'MANUAL_CANCEL_UNPAID',
    });

    return NextResponse.json({
      ok: true,
      message: 'Se procesó la cancelación del referido pendiente por no pago.',
    });
  } catch (error) {
    console.error('❌ Error en /api/referrals/cancel-unpaid/[negocioId]:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo cancelar el referido pendiente.',
      },
      { status: 500 }
    );
  }
}
