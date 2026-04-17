import { prisma } from '@/lib/prisma';
import { AUTH_TOKEN_TYPE, REFERRAL_TOKEN_TTL } from '@/constants/referrals';
import { hashToken } from '@/lib/referrals/activationToken';
import { IPromoterMagicLinkToken, promoterMagicLinkTokenSchema } from '@/schemas/referral';
import jwt from 'jsonwebtoken';

function getMagicLinkSecret(): string {
  return process.env.PROMOTER_MAGIC_JWT_SECRET || process.env.ACTIVATION_JWT_SECRET || '';
}

export function signPromoterMagicToken(payload: IPromoterMagicLinkToken): string {
  const secret = getMagicLinkSecret();
  if (!secret) {
    throw new Error('PROMOTER_MAGIC_JWT_SECRET no está configurado');
  }

  return jwt.sign(payload, secret, { expiresIn: `${REFERRAL_TOKEN_TTL.magicLoginMinutes}m` });
}

export function verifyPromoterMagicToken(token: string): IPromoterMagicLinkToken {
  const secret = getMagicLinkSecret();
  if (!secret) {
    throw new Error('PROMOTER_MAGIC_JWT_SECRET no está configurado');
  }

  const decoded = jwt.verify(token, secret);
  return promoterMagicLinkTokenSchema.parse(decoded);
}

export async function persistMagicLinkToken(args: {
  email: string;
  promoterId: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.authToken.create({
    data: {
      email: args.email,
      promoterId: args.promoterId,
      tokenHash: hashToken(args.token),
      tokenType: AUTH_TOKEN_TYPE.magicLogin,
      expiresAt: args.expiresAt,
    },
  });
}
