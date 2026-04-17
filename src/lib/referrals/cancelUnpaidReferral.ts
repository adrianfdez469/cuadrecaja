import { ReferralStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { REFERRAL_STATUS } from '@/constants/referrals';

interface ICancelUnpaidReferralInput {
  businessId: string;
  deletedAt?: Date;
  reason?: string;
}

async function notifyCancelledReferralToN8n(input: {
  promoterEmail: string;
  promoterName: string;
  businessName: string;
  businessId: string;
  deletedAt: string;
  reason: string;
}): Promise<void> {
  const webhookUrl = process.env.N8N_REFERRAL_CANCELLED_WEBHOOK;
  const apiKey = process.env.N8N_REFERRAL_CANCELLED_API_KEY;

  if (!webhookUrl) {
    console.warn('⚠️ N8N_REFERRAL_CANCELLED_WEBHOOK no configurado');
    return;
  }

  const url = apiKey ? `${webhookUrl}${apiKey}` : webhookUrl;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promoterEmail: input.promoterEmail,
      promoterName: input.promoterName,
      businessName: input.businessName,
      businessId: input.businessId,
      deletedAt: input.deletedAt,
      reason: input.reason,
      source: 'referral-cancelled-unpaid',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`n8n respondió ${response.status}: ${body}`);
  }
}

export async function cancelReferralIfBusinessDeletedUnpaid(
  input: ICancelUnpaidReferralInput
): Promise<void> {
  const deletedAt = input.deletedAt ?? new Date();
  const reason = input.reason ?? 'TRIAL_EXPIRED_UNPAID';

  const referral = await prisma.referral.findUnique({
    where: { newBusinessId: input.businessId },
    include: {
      promoter: {
        select: {
          email: true,
          fullName: true,
        },
      },
      newBusiness: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  });

  if (!referral) {
    return;
  }

  const cancelableStatuses = new Set<ReferralStatus>([
    REFERRAL_STATUS.captured,
    REFERRAL_STATUS.pendingFirstPayment,
  ]);

  if (!cancelableStatuses.has(referral.status)) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: REFERRAL_STATUS.cancelledUnpaidDeleted,
      },
    });

    await tx.referralEventLog.create({
      data: {
        referralId: referral.id,
        entityType: 'REFERRAL',
        eventType: 'BUSINESS_DELETED_UNPAID_REFERRAL_CANCELLED',
        payload: {
          businessId: input.businessId,
          deletedAt: deletedAt.toISOString(),
          reason,
        },
      },
    });
  });

  try {
    await notifyCancelledReferralToN8n({
      promoterEmail: referral.promoter.email,
      promoterName: referral.promoter.fullName,
      businessName: referral.newBusiness.nombre,
      businessId: referral.newBusiness.id,
      deletedAt: deletedAt.toISOString(),
      reason,
    });
  } catch (error) {
    console.error('❌ Error notificando referido cancelado por n8n:', error);
  }
}
