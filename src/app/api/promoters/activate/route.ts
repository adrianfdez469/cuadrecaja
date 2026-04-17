import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { promoterActivateRequestSchema } from '@/schemas/referral';
import { verifyPromoterActivationToken, hashToken } from '@/lib/referrals/activationToken';
import { AUTH_TOKEN_TYPE, PROMOTER_STATUS } from '@/constants/referrals';
import { generateUniquePromoCode } from '@/lib/referrals/promoCode';

export async function POST(request: NextRequest) {
  try {
    const body = promoterActivateRequestSchema.parse(await request.json());
    const tokenHash = hashToken(body.token);

    const tokenRecord = await prisma.authToken.findFirst({
      where: {
        tokenHash,
        tokenType: AUTH_TOKEN_TYPE.activation,
      },
    });

    if (!tokenRecord || tokenRecord.usedAt) {
      return NextResponse.json({ ok: false, error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: 'El enlace de activación ha expirado. Por favor, solicita uno nuevo.' },
        { status: 401 }
      );
    }

    const payload = verifyPromoterActivationToken(body.token);
    if (payload.email !== tokenRecord.email) {
      return NextResponse.json({ ok: false, error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    const txResult = await prisma.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: {
          id: tokenRecord.id,
          tokenType: AUTH_TOKEN_TYPE.activation,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new Error('TOKEN_CLAIM_FAILED');
      }

      const existing = await tx.promoter.findUnique({
        where: { email: payload.email },
        select: { id: true, fullName: true, email: true, promoCode: true },
      });

      if (existing) {
        return { outcome: 'already_active' as const, promoter: existing };
      }

      const promoCode = await generateUniquePromoCode(20, tx);

      const promoter = await tx.promoter.create({
        data: {
          fullName: payload.fullName,
          email: payload.email,
          promoCode,
          status: PROMOTER_STATUS.active,
          activatedAt: new Date(),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          promoCode: true,
        },
      });

      await tx.authToken.update({
        where: { id: tokenRecord.id },
        data: { promoterId: promoter.id },
      });

      await tx.referralEventLog.create({
        data: {
          referralId: null,
          entityType: 'PROMOTER',
          eventType: 'PROMOTER_ACTIVATED',
          payload: { promoterId: promoter.id },
          actorUserId: null,
        },
      });

      return { outcome: 'created' as const, promoter };
    });

    if (txResult.outcome === 'already_active') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este promotor ya fue activado anteriormente.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        promoter: txResult.promoter,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.issues[0]?.message ?? 'Datos inválidos',
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'TOKEN_CLAIM_FAILED') {
      return NextResponse.json({ ok: false, error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json(
        { ok: false, error: 'El enlace de activación ha expirado. Por favor, solicita uno nuevo.' },
        { status: 401 }
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ ok: false, error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    console.error('❌ Error en /api/promoters/activate:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo activar el promotor en este momento.',
      },
      { status: 500 }
    );
  }
}
