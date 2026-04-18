import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import bcrypt from "bcrypt";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyUserAccountToken } from "@/lib/userAccount/userAccountJwt";
import { validatePasswordPolicy } from "@/lib/userAccount/passwordPolicy";

const GENERIC_ERROR = "No se pudo completar la activación. Solicita un nuevo enlace al administrador.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm =
      typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }
    if (!password || !passwordConfirm) {
      return NextResponse.json(
        { error: "Debes ingresar la contraseña dos veces." },
        { status: 400 }
      );
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
    }

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400 });
    }

    let payload: ReturnType<typeof verifyUserAccountToken>;
    try {
      payload = verifyUserAccountToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: "El enlace ha expirado. Solicita uno nuevo al administrador." },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
    }

    if (payload.typ !== "invite") {
      return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        negocioId: payload.negocioId,
      },
      select: {
        id: true,
        usuario: true,
        estadoCuenta: true,
      },
    });

    if (!usuario || usuario.estadoCuenta !== UsuarioEstadoCuenta.PENDIENTE_VERIFICACION) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: passwordHash,
        estadoCuenta: UsuarioEstadoCuenta.ACTIVO,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        usuario: usuario.usuario,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
    }
    console.error("activar-usuario-invite:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
