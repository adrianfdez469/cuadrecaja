import { prisma } from '@/lib/prisma';
import { REFERRAL_LIQUIDATION_STATUS, REFERRAL_STATUS } from '@/constants/referrals';
import { IRegisterFirstPaymentInput } from '@/schemas/referral';

interface IRegisterFirstPaymentResult {
  businessId: string;
  hasReferral: boolean;
  referralId: string | null;
  referralStatus: string | null;
  qualifiedNow: boolean;
  alreadyQualified: boolean;
}

export async function registerFirstPaymentForBusiness(
  businessId: string,
  input: IRegisterFirstPaymentInput,
  actorUserId?: string
): Promise<IRegisterFirstPaymentResult> {
  const paidAt = input.paidAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const business = await tx.negocio.findUnique({
      where: { id: businessId },
      select: { id: true },
    });

    if (!business) {
      throw new Error('NEGOCIO_NOT_FOUND');
    }

    const plan = await tx.plan.findUnique({
      where: { id: input.planId },
      select: { id: true, activo: true },
    });

    if (!plan || !plan.activo) {
      throw new Error('PLAN_NOT_FOUND_OR_INACTIVE');
    }

    const referral = await tx.referral.findUnique({
      where: { newBusinessId: businessId },
      include: {
        liquidation: true,
      },
    });

    await tx.negocio.update({
      where: { id: businessId },
      data: { planId: input.planId },
    });

    if (!referral) {
      return {
        businessId,
        hasReferral: false,
        referralId: null,
        referralStatus: null,
        qualifiedNow: false,
        alreadyQualified: false,
      };
    }

    if (referral.status === REFERRAL_STATUS.rejectedFraud) {
      await tx.referralEventLog.create({
        data: {
          referralId: referral.id,
          entityType: 'REFERRAL',
          eventType: 'FIRST_PAYMENT_IGNORED_REJECTED_FRAUD',
          payload: {
            businessId,
            planId: input.planId,
            paidAt: paidAt.toISOString(),
            paymentAmount: input.paymentAmount ?? null,
          },
          actorUserId: actorUserId ?? null,
        },
      });

      return {
        businessId,
        hasReferral: true,
        referralId: referral.id,
        referralStatus: referral.status,
        qualifiedNow: false,
        alreadyQualified: false,
      };
    }

    if (referral.firstPaidAt) {
      await tx.referralEventLog.create({
        data: {
          referralId: referral.id,
          entityType: 'REFERRAL',
          eventType: 'FIRST_PAYMENT_REGISTER_SKIPPED_IDEMPOTENT',
          payload: {
            businessId,
            planId: input.planId,
            note: 'Ya existía primer pago registrado.',
          },
          actorUserId: actorUserId ?? null,
        },
      });

      return {
        businessId,
        hasReferral: true,
        referralId: referral.id,
        referralStatus: referral.status,
        qualifiedNow: false,
        alreadyQualified: true,
      };
    }

    const rewardRule = await tx.referralRewardRule.findUnique({
      where: { planId: input.planId },
      select: {
        id: true,
        isActive: true,
        discountForNewBusiness: true,
        rewardForPromoter: true,
      },
    });

    if (!rewardRule || !rewardRule.isActive) {
      throw new Error('REFERRAL_REWARD_RULE_NOT_FOUND');
    }

    await tx.referral.update({
      where: { id: referral.id },
      data: {
        firstPaidAt: paidAt,
        firstPaidPlanId: input.planId,
        newBusinessDiscountSnapshot: rewardRule.discountForNewBusiness,
        promoterRewardSnapshot: rewardRule.rewardForPromoter,
        status: REFERRAL_STATUS.qualified,
      },
    });

    const updatedReferral = await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: REFERRAL_STATUS.liquidationPending,
      },
    });

    await tx.referralLiquidation.upsert({
      where: { referralId: referral.id },
      create: {
        referralId: referral.id,
        status: REFERRAL_LIQUIDATION_STATUS.pending,
      },
      update: {
        status: REFERRAL_LIQUIDATION_STATUS.pending,
      },
    });

    await tx.referralEventLog.create({
      data: {
        referralId: referral.id,
        entityType: 'REFERRAL',
        eventType: 'FIRST_PAYMENT_REGISTERED_AND_QUALIFIED',
        payload: {
          businessId,
          planId: input.planId,
          paidAt: paidAt.toISOString(),
          paymentAmount: input.paymentAmount ?? null,
          discountForNewBusiness: rewardRule.discountForNewBusiness,
          rewardForPromoter: rewardRule.rewardForPromoter,
        },
        actorUserId: actorUserId ?? null,
      },
    });

    return {
      businessId,
      hasReferral: true,
      referralId: referral.id,
      referralStatus: updatedReferral.status,
      qualifiedNow: true,
      alreadyQualified: false,
    };
  });
}
