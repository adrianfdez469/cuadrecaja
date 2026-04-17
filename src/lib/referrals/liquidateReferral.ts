import { prisma } from '@/lib/prisma';
import { REFERRAL_LIQUIDATION_STATUS, REFERRAL_STATUS } from '@/constants/referrals';
import type { IAdminLiquidateReferralInput } from '@/schemas/referral';

export async function liquidateReferralManually(
  referralId: string,
  input: IAdminLiquidateReferralInput,
  liquidatedByUserId: string
): Promise<void> {
  const liquidatedAt = input.liquidatedAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    const referral = await tx.referral.findUnique({
      where: { id: referralId },
      include: { liquidation: true },
    });

    if (!referral) {
      throw new Error('REFERRAL_NOT_FOUND');
    }

    if (referral.status !== REFERRAL_STATUS.liquidationPending) {
      throw new Error('REFERRAL_NOT_PENDING_LIQUIDATION');
    }

    if (!referral.liquidation || referral.liquidation.status !== REFERRAL_LIQUIDATION_STATUS.pending) {
      throw new Error('LIQUIDATION_NOT_PENDING');
    }

    await tx.referralLiquidation.update({
      where: { id: referral.liquidation.id },
      data: {
        status: REFERRAL_LIQUIDATION_STATUS.liquidated,
        liquidatedAt,
        paidAmount: input.paidAmount ?? null,
        paymentMethod: input.paymentMethod ?? null,
        note: input.note ?? null,
        liquidatedBy: liquidatedByUserId,
      },
    });

    await tx.referral.update({
      where: { id: referralId },
      data: {
        status: REFERRAL_STATUS.liquidatedManually,
      },
    });

    await tx.referralEventLog.create({
      data: {
        referralId,
        entityType: 'LIQUIDATION',
        eventType: 'MANUAL_LIQUIDATION_COMPLETED',
        payload: {
          liquidatedAt: liquidatedAt.toISOString(),
          paidAmount: input.paidAmount ?? null,
          paymentMethod: input.paymentMethod ?? null,
          note: input.note ?? null,
          liquidatedByUserId,
        },
        actorUserId: liquidatedByUserId,
      },
    });
  });
}
