import { prisma } from '@/lib/prisma';

export interface IPublicReferralRewardRule {
  planNombre: string;
  discountForNewBusiness: number;
  rewardForPromoter: number;
}

export async function getPublicReferralRewardRules(): Promise<IPublicReferralRewardRule[]> {
  const rows = await prisma.plan.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      nombre: true,
      ReferralRewardRule: {
        select: {
          discountForNewBusiness: true,
          rewardForPromoter: true,
          isActive: true,
        },
      },
    },
  });

  return rows
    .filter((row) => row.ReferralRewardRule?.isActive)
    .map((row) => ({
      planNombre: row.nombre,
      discountForNewBusiness: row.ReferralRewardRule!.discountForNewBusiness,
      rewardForPromoter: row.ReferralRewardRule!.rewardForPromoter,
    }));
}
