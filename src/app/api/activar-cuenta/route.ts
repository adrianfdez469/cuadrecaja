import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { initializeNegocio } from '@/lib/onboarding/initializeNegocio';
import { LandingRegistrationConflictError } from '@/lib/onboarding/landingRegistrationAvailability';
import { activationTokenPayloadSchema } from '@/schemas/referral';

const MAX_LOCALES_ACTIVATION = 19;

function normalizarNumeroLocales(raw: unknown): number {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return Math.min(MAX_LOCALES_ACTIVATION, Math.max(1, raw));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = parseInt(raw, 10);
    if (Number.isInteger(parsed)) {
      return Math.min(MAX_LOCALES_ACTIVATION, Math.max(1, parsed));
    }
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const secret = process.env.ACTIVATION_JWT_SECRET;
    if (!secret) {
      console.error('❌ ACTIVATION_JWT_SECRET no está configurado');
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }

    let payload: unknown;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: 'El enlace de activación ha expirado. Por favor, solicita uno nuevo.' },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    const parsedPayload = activationTokenPayloadSchema.parse(payload);
    const { nombre, nombreNegocio, correo, telefono, referido } = parsedPayload;

    if (!nombre?.trim() || !correo?.trim() || !nombreNegocio?.trim()) {
      return NextResponse.json({ error: 'El enlace de activación no contiene información válida.' }, { status: 400 });
    }

    const numeroLocales = normalizarNumeroLocales(parsedPayload.numeroLocales);

    const resultado = await initializeNegocio({
      nombre: nombre.trim(),
      nombreNegocio: nombreNegocio.trim(),
      correo: correo.trim(),
      telefono: typeof telefono === 'string' ? telefono : '',
      numeroLocales,
      referido,
    });

    return NextResponse.json(resultado, { status: 201 });

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'El enlace de activación no contiene información válida.' },
        { status: 400 }
      );
    }

    if (error instanceof LandingRegistrationConflictError) {
      return NextResponse.json(
        { error: error.message, conflict: error.conflict },
        { status: 409 }
      );
    }

    console.error('❌ Error al activar cuenta:', error);
    return NextResponse.json(
      { error: 'Error interno al crear tu cuenta. Por favor, contacta al soporte.' },
      { status: 500 }
    );
  }
}
