import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { adminUpsertReferralRewardRuleBodySchema } from '@/schemas/referral';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const { planId } = await params;
    const body = adminUpsertReferralRewardRuleBodySchema.parse(await request.json());

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json({ ok: false, error: 'Plan no encontrado.' }, { status: 404 });
    }

    await prisma.referralRewardRule.upsert({
      where: { planId },
      create: {
        planId,
        discountForNewBusiness: body.discountForNewBusiness,
        rewardForPromoter: body.rewardForPromoter,
        isActive: body.isActive,
      },
      update: {
        discountForNewBusiness: body.discountForNewBusiness,
        rewardForPromoter: body.rewardForPromoter,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({ ok: true, message: 'Regla guardada correctamente.' });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }
    console.error('❌ PUT /api/admin/referral-reward-rules/[planId]:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la regla.' }, { status: 500 });
  }
}
