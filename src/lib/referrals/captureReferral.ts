import { Prisma } from '@prisma/client';
import { REFERRAL_STATUS } from '@/constants/referrals';
import { isValidReferralPromoCode } from '@/lib/referrals/referralCode';

interface ICaptureReferralInput {
  tx: Prisma.TransactionClient;
  newBusinessId: string;
  promoterCode?: string;
  creatorEmail: string;
}

export async function captureReferralForNewBusiness(input: ICaptureReferralInput): Promise<void> {
  const promoterCode = input.promoterCode?.trim().toUpperCase();
  if (!promoterCode) {
    return;
  }

  if (!isValidReferralPromoCode(promoterCode)) {
    return;
  }

  const promoter = await input.tx.promoter.findUnique({
    where: { promoCode: promoterCode },
    select: {
      id: true,
      email: true,
      status: true,
      promoCode: true,
    },
  });

  if (!promoter || promoter.status !== 'ACTIVE') {
    return;
  }

  const isFraud = promoter.email.trim().toLowerCase() === input.creatorEmail.trim().toLowerCase();
  const status = isFraud ? REFERRAL_STATUS.rejectedFraud : REFERRAL_STATUS.pendingFirstPayment;

  await input.tx.referral.create({
    data: {
      promoterId: promoter.id,
      newBusinessId: input.newBusinessId,
      promoCodeSnapshot: promoter.promoCode,
      status,
      fraudReason: isFraud ? 'PROMOTER_EMAIL_EQUALS_BUSINESS_ADMIN_EMAIL' : null,
    },
  });
}
