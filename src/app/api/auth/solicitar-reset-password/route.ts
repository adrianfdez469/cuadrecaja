import { NextRequest, NextResponse } from "next/server";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrlFromRequest } from "@/lib/appBaseUrl";
import {
  RESTABLECER_CONTRASEÑA_PATH,
} from "@/constants/userAccount";
import { signUserPasswordResetToken } from "@/lib/userAccount/userAccountJwt";
import { dispatchUserPasswordResetToN8n } from "@/lib/userAccount/n8nUserWebhooks";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PUBLIC_OK = {
  ok: true,
  message:
    "Si el correo está registrado en un negocio activo, recibirás instrucciones para restablecer tu contraseña.",
};

/**
 * Respuesta siempre genérica (anti enumeración de cuentas).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = typeof body.usuario === "string" ? body.usuario.trim().toLowerCase() : "";

    if (!raw || !EMAIL_REGEX.test(raw)) {
      return NextResponse.json(PUBLIC_OK, { status: 200 });
    }

    const user = await prisma.usuario.findUnique({
      where: { usuario: raw },
      select: {
        id: true,
        nombre: true,
        usuario: true,
        password: true,
        estadoCuenta: true,
        negocioId: true,
        negocio: { select: { nombre: true } },
      },
    });

    if (
      !user ||
      user.estadoCuenta !== UsuarioEstadoCuenta.ACTIVO ||
      !user.password
    ) {
      return NextResponse.json(PUBLIC_OK, { status: 200 });
    }

    const secret = process.env.USER_ACCOUNT_JWT_SECRET?.trim();
    if (!secret) {
      console.error("❌ USER_ACCOUNT_JWT_SECRET no configurado");
      return NextResponse.json(PUBLIC_OK, { status: 200 });
    }

    const token = signUserPasswordResetToken({
      usuarioId: user.id,
      negocioId: user.negocioId,
    });

    const base = getAppBaseUrlFromRequest(request);
    const resetUrl = `${base}${RESTABLECER_CONTRASEÑA_PATH}?token=${encodeURIComponent(token)}`;

    await dispatchUserPasswordResetToN8n({
      source: "user-password-reset",
      timestamp: new Date().toISOString(),
      negocioId: user.negocioId,
      negocioNombre: user.negocio.nombre,
      usuarioNombre: user.nombre,
      email: user.usuario,
      usuarioId: user.id,
      token,
      resetUrl,
    });

    return NextResponse.json(PUBLIC_OK, { status: 200 });
  } catch (error) {
    console.error("solicitar-reset-password:", error);
    return NextResponse.json(PUBLIC_OK, { status: 200 });
  }
}
