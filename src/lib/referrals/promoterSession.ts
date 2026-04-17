import jwt from 'jsonwebtoken';

export const PROMOTER_SESSION_COOKIE_NAME = 'promoter_session';

export interface IPromoterSessionPayload {
  promoterId: string;
  email: string;
}

function getPromoterSessionSecret(): string {
  return process.env.PROMOTER_SESSION_JWT_SECRET || process.env.ACTIVATION_JWT_SECRET || '';
}

export function signPromoterSession(payload: IPromoterSessionPayload): string {
  const secret = getPromoterSessionSecret();
  if (!secret) {
    throw new Error('PROMOTER_SESSION_JWT_SECRET no está configurado');
  }

  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyPromoterSession(token: string): IPromoterSessionPayload {
  const secret = getPromoterSessionSecret();
  if (!secret) {
    throw new Error('PROMOTER_SESSION_JWT_SECRET no está configurado');
  }

  return jwt.verify(token, secret) as IPromoterSessionPayload;
}
