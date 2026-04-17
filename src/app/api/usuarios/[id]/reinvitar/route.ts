import { NextRequest, NextResponse } from "next/server";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { sendUserInviteNotification } from "@/lib/userAccount/sendUserInviteNotification";

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
      !verificarPermisoUsuario(
        user.permisos || "",
        "configuracion.usuarios.acceder",
        user.rol
      )
    ) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const target = await prisma.usuario.findFirst({
      where: { id, negocioId: user.negocio.id },
      include: {
        negocio: { select: { nombre: true } },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (target.estadoCuenta !== UsuarioEstadoCuenta.PENDIENTE_VERIFICACION) {
      return NextResponse.json(
        { error: "Solo se puede reenviar la invitación a usuarios pendientes de verificación." },
        { status: 400 }
      );
    }

    await sendUserInviteNotification({
      request,
      usuarioId: target.id,
      negocioId: user.negocio.id,
      negocioNombre: target.negocio.nombre,
      creadorNombre: user.nombre ?? "",
      creadorEmail: user.usuario ?? "",
      invitadoNombre: target.nombre,
      invitadoEmail: target.usuario,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al reenviar la invitación" },
      { status: 500 }
    );
  }
}
