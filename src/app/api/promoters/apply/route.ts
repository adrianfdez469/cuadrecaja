import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { promoterApplySchema } from '@/schemas/referral';
import { persistActivationToken, signPromoterActivationToken } from '@/lib/referrals/activationToken';
import { REFERRAL_PUBLIC_MESSAGES, REFERRAL_TOKEN_TTL } from '@/constants/referrals';
import { prisma } from '@/lib/prisma';

function getAppBaseUrl(request: NextRequest): string {
  const rawBase = [request.nextUrl.origin, process.env.NEXTAUTH_URL]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.replace(/\/$/, ''))[0];

  return rawBase ?? 'http://localhost:3000';
}

async function dispatchPromoterActivationToN8n(payload: {
  fullName: string;
  email: string;
  activationUrl: string;
  token: string;
}): Promise<void> {
  const webhookUrl = process.env.N8N_PROMOTER_ACTIVATION_WEBHOOK;
  const apiKey = process.env.N8N_PROMOTER_ACTIVATION_API_KEY;

  if (!webhookUrl) {
    console.warn('⚠️ N8N_PROMOTER_ACTIVATION_WEBHOOK no configurado');
    return;
  }

  const url = apiKey ? `${webhookUrl}${apiKey}` : webhookUrl;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: payload.fullName,
      email: payload.email,
      activationUrl: payload.activationUrl,
      token: payload.token,
      source: 'promoter-apply',
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
    const input = promoterApplySchema.parse(await request.json());

    const existingPromoter = await prisma.promoter.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingPromoter) {
      return NextResponse.json(
        {
          ok: true,
          message: REFERRAL_PUBLIC_MESSAGES.activationRequestSent,
        },
        { status: 200 }
      );
    }

    const token = signPromoterActivationToken({
      type: 'ACTIVATION',
      fullName: input.fullName,
      email: input.email,
    });

    const expiresAt = new Date(Date.now() + REFERRAL_TOKEN_TTL.activationMinutes * 60_000);
    await persistActivationToken({
      email: input.email,
      token,
      expiresAt,
    });

    const activationUrl = `${getAppBaseUrl(request)}/activar-promotor?token=${encodeURIComponent(token)}`;
    await dispatchPromoterActivationToN8n({
      fullName: input.fullName,
      email: input.email,
      activationUrl,
      token,
    });

    return NextResponse.json(
      {
        ok: true,
        message: REFERRAL_PUBLIC_MESSAGES.activationRequestSent,
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

    console.error('❌ Error en /api/promoters/apply:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo procesar la solicitud en este momento.',
      },
      { status: 500 }
    );
  }
}
