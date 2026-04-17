import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { promoterMagicLinkRequestSchema } from '@/schemas/referral';
import { REFERRAL_PUBLIC_MESSAGES, REFERRAL_TOKEN_TTL } from '@/constants/referrals';
import { persistMagicLinkToken, signPromoterMagicToken } from '@/lib/referrals/magicLink';

function getAppBaseUrl(request: NextRequest): string {
  const rawBase = [request.nextUrl.origin, process.env.NEXTAUTH_URL]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.replace(/\/$/, ''))[0];

  return rawBase ?? 'http://localhost:3000';
}

async function dispatchMagicLinkToN8n(payload: {
  email: string;
  fullName: string;
  magicLinkUrl: string;
  token: string;
}): Promise<void> {
  const webhookUrl = process.env.N8N_PROMOTER_MAGIC_LINK_WEBHOOK;
  const apiKey = process.env.N8N_PROMOTER_MAGIC_LINK_API_KEY;

  if (!webhookUrl) {
    console.warn('⚠️ N8N_PROMOTER_MAGIC_LINK_WEBHOOK no configurado');
    return;
  }

  const url = apiKey ? `${webhookUrl}${apiKey}` : webhookUrl;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email,
      fullName: payload.fullName,
      magicLinkUrl: payload.magicLinkUrl,
      token: payload.token,
      source: 'promoter-magic-link',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`n8n respondió ${response.status}: ${body}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = promoterMagicLinkRequestSchema.parse(await request.json());

    const promoter = await prisma.promoter.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, fullName: true, status: true },
    });

    // Respuesta neutral para no filtrar existencia de cuentas.
    if (!promoter || promoter.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          ok: true,
          message: REFERRAL_PUBLIC_MESSAGES.magicLinkSentIfAccount,
        },
        { status: 200 }
      );
    }

    const token = signPromoterMagicToken({
      type: 'MAGIC_LOGIN',
      email: promoter.email,
    });

    const expiresAt = new Date(Date.now() + REFERRAL_TOKEN_TTL.magicLoginMinutes * 60_000);
    await persistMagicLinkToken({
      email: promoter.email,
      promoterId: promoter.id,
      token,
      expiresAt,
    });

    const magicLinkUrl = `${getAppBaseUrl(request)}/promotor/auth?token=${encodeURIComponent(token)}`;
    await dispatchMagicLinkToN8n({
      email: promoter.email,
      fullName: promoter.fullName,
      magicLinkUrl,
      token,
    });

    return NextResponse.json(
      {
        ok: true,
        message: REFERRAL_PUBLIC_MESSAGES.magicLinkSentIfAccount,
      },
      { status: 200 }
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

    console.error('❌ Error en /api/promoters/magic-link/request:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo procesar la solicitud en este momento.',
      },
      { status: 500 }
    );
  }
}
