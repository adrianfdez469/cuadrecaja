import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { AUTH_TOKEN_TYPE } from '@/constants/referrals';
import { hashToken } from '@/lib/referrals/activationToken';
import { verifyPromoterMagicToken } from '@/lib/referrals/magicLink';
import { PROMOTER_SESSION_COOKIE_NAME, signPromoterSession } from '@/lib/referrals/promoterSession';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.authToken.findFirst({
      where: {
        tokenHash,
        tokenType: AUTH_TOKEN_TYPE.magicLogin,
      },
      include: {
        promoter: {
          select: { id: true, email: true, status: true },
        },
      },
    });

    if (!tokenRecord || tokenRecord.usedAt || !tokenRecord.promoter) {
      return NextResponse.json({ ok: false, error: 'El enlace de acceso no es válido.' }, { status: 400 });
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: 'El enlace de acceso ha expirado. Solicita uno nuevo.' },
        { status: 401 }
      );
    }

    if (tokenRecord.promoter.status !== 'ACTIVE') {
      return NextResponse.json({ ok: false, error: 'La cuenta de promotor no está activa.' }, { status: 403 });
    }

    const payload = verifyPromoterMagicToken(token);
    if (payload.email !== tokenRecord.email) {
      return NextResponse.json({ ok: false, error: 'El enlace de acceso no es válido.' }, { status: 400 });
    }

    const sessionToken = signPromoterSession({
      promoterId: tokenRecord.promoter.id,
      email: tokenRecord.promoter.email,
    });

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: {
          id: tokenRecord.id,
          tokenType: AUTH_TOKEN_TYPE.magicLogin,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new Error('TOKEN_CLAIM_FAILED');
      }

      await tx.referralEventLog.create({
        data: {
          referralId: null,
          entityType: 'PROMOTER',
          eventType: 'PROMOTER_MAGIC_LINK_SESSION_STARTED',
          payload: { promoterId: tokenRecord.promoter.id },
          actorUserId: null,
        },
      });
    });

    const response = NextResponse.redirect(new URL('/promotor', request.url));
    response.cookies.set(PROMOTER_SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_CLAIM_FAILED') {
      return NextResponse.json({ ok: false, error: 'El enlace de acceso no es válido.' }, { status: 400 });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json(
        { ok: false, error: 'El enlace de acceso ha expirado. Solicita uno nuevo.' },
        { status: 401 }
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ ok: false, error: 'El enlace de acceso no es válido.' }, { status: 400 });
    }

    console.error('❌ Error en /api/promoters/magic-link/consume:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo iniciar sesión en este momento.',
      },
      { status: 500 }
    );
  }
}
