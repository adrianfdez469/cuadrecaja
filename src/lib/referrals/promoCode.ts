import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  REFERRAL_PROMO_CODE_PREFIX,
  REFERRAL_PROMO_CODE_RANDOM_LENGTH,
  REFERRAL_PROMO_CODE_SEPARATOR,
} from '@/constants/referrals';

type PromoCodeDb = typeof prisma | Prisma.TransactionClient;

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function createRandomSegment(length: number): string {
  return Array.from({ length })
    .map(() => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)])
    .join('');
}

export function buildPromoCode(): string {
  const segment = createRandomSegment(REFERRAL_PROMO_CODE_RANDOM_LENGTH);
  return `${REFERRAL_PROMO_CODE_PREFIX}${REFERRAL_PROMO_CODE_SEPARATOR}${segment}`;
}

export async function generateUniquePromoCode(
  maxAttempts = 20,
  db: PromoCodeDb = prisma
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const promoCode = buildPromoCode();
    const existing = await db.promoter.findUnique({
      where: { promoCode },
      select: { id: true },
    });

    if (!existing) {
      return promoCode;
    }
  }

  throw new Error('No se pudo generar un codigo de promocion unico');
}
