import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyUserAccountToken } from "@/lib/userAccount/userAccountJwt";
import { Prisma } from "@prisma/client";

const GENERIC_ERROR =
  "No se pudo completar la activación del correo. Solicita un nuevo enlace.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    let payload: ReturnType<typeof verifyUserAccountToken>;
    try {
      payload = verifyUserAccountToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: "El enlace ha expirado. Solicita uno nuevo." },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
    }

    if (payload.typ !== "email_change") {
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
      },
    });

    if (!usuario) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    if (usuario.usuario.toLowerCase() !== payload.currentEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "Este enlace ya no es válido porque el correo cambió previamente." },
        { status: 409 }
      );
    }

    try {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { usuario: payload.newEmail.toLowerCase() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "El correo ya está en uso. Solicita un nuevo cambio." },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      { ok: true, usuario: payload.newEmail.toLowerCase() },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
    }
    console.error("activar-cambio-correo:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
