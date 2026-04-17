import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';
import { generateUniquePromoCode } from '@/lib/referrals/promoCode';
import { PROMOTER_STATUS } from '@/constants/referrals';
import { PROMOTER_SESSION_COOKIE_NAME, signPromoterSession } from '@/lib/referrals/promoterSession';

const emailSchema = z.string().trim().email();

export async function POST() {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Debes iniciar sesión para continuar.' }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        usuario: true,
        isActive: true,
      },
    });

    if (!usuario || !usuario.isActive) {
      return NextResponse.json(
        { ok: false, error: 'Tu usuario no está activo para habilitar perfil de promotor.' },
        { status: 403 }
      );
    }

    const emailResult = emailSchema.safeParse(usuario.usuario.toLowerCase());
    if (!emailResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tu usuario actual no es un correo válido. Contacta al administrador para actualizarlo y habilitar promotor.',
        },
        { status: 400 }
      );
    }

    const email = emailResult.data;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.promoter.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          status: true,
          activatedAt: true,
        },
      });

      if (existing) {
        const promoter = await tx.promoter.update({
          where: { id: existing.id },
          data: {
            status: PROMOTER_STATUS.active,
            activatedAt: existing.activatedAt ?? new Date(),
          },
          select: {
            id: true,
            email: true,
            promoCode: true,
          },
        });

        await tx.referralEventLog.create({
          data: {
            referralId: null,
            entityType: 'PROMOTER',
            eventType: 'PROMOTER_SESSION_STARTED_FROM_APP',
            payload: { promoterId: promoter.id, sourceUserId: usuario.id, existingPromoter: true },
            actorUserId: usuario.id,
          },
        });

        return { promoter, wasCreated: false };
      }

      const promoCode = await generateUniquePromoCode(20, tx);
      const promoter = await tx.promoter.create({
        data: {
          fullName: usuario.nombre?.trim() || email,
          email,
          promoCode,
          status: PROMOTER_STATUS.active,
          activatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          promoCode: true,
        },
      });

      await tx.referralEventLog.create({
        data: {
          referralId: null,
          entityType: 'PROMOTER',
          eventType: 'PROMOTER_SELF_ENROLLED_FROM_APP',
          payload: { promoterId: promoter.id, sourceUserId: usuario.id },
          actorUserId: usuario.id,
        },
      });

      return { promoter, wasCreated: true };
    });

    const sessionToken = signPromoterSession({
      promoterId: result.promoter.id,
      email: result.promoter.email,
    });

    const response = NextResponse.json(
      {
        ok: true,
        wasCreated: result.wasCreated,
        promoter: result.promoter,
      },
      { status: 200 }
    );

    response.cookies.set(PROMOTER_SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('❌ Error en /api/promoters/self-enroll:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo habilitar el acceso de promotor en este momento.' },
      { status: 500 }
    );
  }
}
