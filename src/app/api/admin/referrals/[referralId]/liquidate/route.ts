import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/utils/authOptions';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { adminLiquidateReferralSchema } from '@/schemas/referral';
import { liquidateReferralManually } from '@/lib/referrals/liquidateReferral';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ referralId: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 });
    }

    const { referralId } = await params;
    const body = adminLiquidateReferralSchema.parse(await request.json());

    await liquidateReferralManually(referralId, body, userId);

    return NextResponse.json({ ok: true, message: 'Liquidación registrada correctamente.' });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === 'REFERRAL_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Referido no encontrado.' }, { status: 404 });
      }
      if (error.message === 'REFERRAL_NOT_PENDING_LIQUIDATION') {
        return NextResponse.json(
          { ok: false, error: 'El referido no está pendiente de liquidación.' },
          { status: 409 }
        );
      }
      if (error.message === 'LIQUIDATION_NOT_PENDING') {
        return NextResponse.json(
          { ok: false, error: 'La liquidación no está en estado pendiente.' },
          { status: 409 }
        );
      }
    }
    console.error('❌ PATCH /api/admin/referrals/[referralId]/liquidate:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo registrar la liquidación.' }, { status: 500 });
  }
}
