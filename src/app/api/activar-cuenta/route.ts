import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { initializeNegocio } from '@/lib/onboarding/initializeNegocio';

const MAX_LOCALES_ACTIVATION = 19;

interface ActivationTokenPayload {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono?: string;
  numeroLocales?: number | string;
  iat?: number;
  exp?: number;
}

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

    let payload: ActivationTokenPayload;
    try {
      payload = jwt.verify(token, secret) as ActivationTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: 'El enlace de activación ha expirado. Por favor, solicita uno nuevo.' },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: 'El enlace de activación no es válido.' }, { status: 400 });
    }

    const { nombre, nombreNegocio, correo, telefono } = payload;

    if (!nombre?.trim() || !correo?.trim() || !nombreNegocio?.trim()) {
      return NextResponse.json({ error: 'El enlace de activación no contiene información válida.' }, { status: 400 });
    }

    const numeroLocales = normalizarNumeroLocales(payload.numeroLocales);

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { usuario: correo },
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { error: 'Esta cuenta ya fue activada. Puedes iniciar sesión directamente.' },
        { status: 409 }
      );
    }

    const resultado = await initializeNegocio({
      nombre: nombre.trim(),
      nombreNegocio: nombreNegocio.trim(),
      correo: correo.trim(),
      telefono: typeof telefono === 'string' ? telefono : '',
      numeroLocales,
    });

    return NextResponse.json(resultado, { status: 201 });

  } catch (error) {
    console.error('❌ Error al activar cuenta:', error);
    return NextResponse.json(
      { error: 'Error interno al crear tu cuenta. Por favor, contacta al soporte.' },
      { status: 500 }
    );
  }
}
