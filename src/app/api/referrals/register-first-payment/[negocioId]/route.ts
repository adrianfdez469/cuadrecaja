import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import getUserFromRequest from '@/utils/getUserFromRequest';
import { registerFirstPaymentSchema } from '@/schemas/referral';
import { registerFirstPaymentForBusiness } from '@/lib/referrals/firstPayment';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ negocioId: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const { negocioId } = await params;
    const payload = registerFirstPaymentSchema.parse(await request.json());
    const actor = await getUserFromRequest(request);

    const result = await registerFirstPaymentForBusiness(negocioId, payload, actor?.id);

    return NextResponse.json(
      {
        ok: true,
        message: 'Primer pago registrado correctamente.',
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.issues[0]?.message ?? 'Datos inválidos',
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'NEGOCIO_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Negocio no encontrado.' }, { status: 404 });
      }
      if (error.message === 'PLAN_NOT_FOUND_OR_INACTIVE') {
        return NextResponse.json({ ok: false, error: 'El plan no existe o está inactivo.' }, { status: 404 });
      }
      if (error.message === 'REFERRAL_REWARD_RULE_NOT_FOUND') {
        return NextResponse.json(
          { ok: false, error: 'No existe una regla de recompensa activa para ese plan.' },
          { status: 409 }
        );
      }
    }

    console.error('❌ Error en /api/referrals/register-first-payment/[negocioId]:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo registrar el primer pago.',
      },
      { status: 500 }
    );
  }
}
