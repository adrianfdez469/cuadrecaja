import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';

export async function GET() {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const rows = await prisma.plan.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        activo: true,
        ReferralRewardRule: {
          select: {
            id: true,
            discountForNewBusiness: true,
            rewardForPromoter: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        planId: r.id,
        planNombre: r.nombre,
        planActivo: r.activo,
        rule: r.ReferralRewardRule
          ? {
              id: r.ReferralRewardRule.id,
              discountForNewBusiness: r.ReferralRewardRule.discountForNewBusiness,
              rewardForPromoter: r.ReferralRewardRule.rewardForPromoter,
              isActive: r.ReferralRewardRule.isActive,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('❌ GET /api/admin/referral-reward-rules:', error);
    return NextResponse.json({ ok: false, error: 'Error al listar reglas de recompensa.' }, { status: 500 });
  }
}
