import { NextRequest, NextResponse } from "next/server";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getAppBaseUrlFromRequest } from "@/lib/appBaseUrl";
import { RESTABLECER_CONTRASEÑA_PATH } from "@/constants/userAccount";
import { signUserPasswordResetToken } from "@/lib/userAccount/userAccountJwt";
import { dispatchUserPasswordResetToN8n } from "@/lib/userAccount/n8nUserWebhooks";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(user.permisos || "", "configuracion.usuarios.acceder", user.rol)
    ) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const target = await prisma.usuario.findFirst({
      where: { id, negocioId: user.negocio.id },
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

    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (target.estadoCuenta !== UsuarioEstadoCuenta.ACTIVO || !target.password) {
      return NextResponse.json(
        { error: "Solo se puede enviar reset a usuarios activos con contraseña definida." },
        { status: 400 }
      );
    }

    const secret = process.env.USER_ACCOUNT_JWT_SECRET?.trim();
    if (!secret) {
      console.error("❌ USER_ACCOUNT_JWT_SECRET no configurado");
      return NextResponse.json({ error: "No fue posible enviar el correo de reset." }, { status: 500 });
    }

    const token = signUserPasswordResetToken({
      usuarioId: target.id,
      negocioId: target.negocioId,
    });

    const base = getAppBaseUrlFromRequest(request);
    const resetUrl = `${base}${RESTABLECER_CONTRASEÑA_PATH}?token=${encodeURIComponent(token)}`;

    await dispatchUserPasswordResetToN8n({
      source: "user-password-reset",
      timestamp: new Date().toISOString(),
      negocioId: target.negocioId,
      negocioNombre: target.negocio.nombre,
      usuarioNombre: target.nombre,
      email: target.usuario,
      usuarioId: target.id,
      token,
      resetUrl,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("usuarios/reset-password:", error);
    return NextResponse.json({ error: "Error al enviar reset de contraseña" }, { status: 500 });
  }
}
