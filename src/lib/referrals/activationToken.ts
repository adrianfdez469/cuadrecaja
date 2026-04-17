import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { AUTH_TOKEN_TYPE, REFERRAL_TOKEN_TTL } from '@/constants/referrals';
import { IPromoterActivationToken, promoterActivationTokenSchema } from '@/schemas/referral';

function getActivationSecret(): string {
  const secret = process.env.ACTIVATION_JWT_SECRET;
  if (!secret) {
    throw new Error('ACTIVATION_JWT_SECRET no está configurado');
  }
  return secret;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signPromoterActivationToken(payload: IPromoterActivationToken): string {
  const secret = getActivationSecret();
  return jwt.sign(payload, secret, { expiresIn: `${REFERRAL_TOKEN_TTL.activationMinutes}m` });
}

export function verifyPromoterActivationToken(token: string): IPromoterActivationToken {
  const secret = getActivationSecret();
  const decoded = jwt.verify(token, secret);
  return promoterActivationTokenSchema.parse(decoded);
}

export async function persistActivationToken(args: {
  email: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.authToken.create({
    data: {
      email: args.email,
      tokenHash: hashToken(args.token),
      tokenType: AUTH_TOKEN_TYPE.activation,
      expiresAt: args.expiresAt,
    },
  });
}
