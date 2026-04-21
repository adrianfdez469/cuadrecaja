import { NextResponse } from "next/server";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { Prisma } from "@prisma/client";
import { sendUserInviteNotification } from "@/lib/userAccount/sendUserInviteNotification";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usuarioListSelect = {
  id: true,
  nombre: true,
  usuario: true,
  rol: true,
  negocioId: true,
  localActualId: true,
  isActive: true,
  estadoCuenta: true,
} satisfies Prisma.UsuarioSelect;

// Obtener usuarios del negocio (excluyendo SUPER_ADMIN)
export async function GET() {
  try {
    const session = await getSession();
    const user = session.user;
    const canManageUsers = verificarPermisoUsuario(
      user.permisos || "",
      "configuracion.usuarios.acceder",
      user.rol
    );

    if (!canManageUsers) {
      const currentUser = await prisma.usuario.findFirst({
        where: {
          id: user.id,
          negocioId: user.negocio.id,
        },
        select: usuarioListSelect,
      });
      return NextResponse.json(currentUser ? [currentUser] : []);
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        negocioId: user.negocio.id,
      },
      select: usuarioListSelect,
    });

    const usuariosFiltrados = usuarios.filter((u) => u.rol !== "SUPER_ADMIN");

    return NextResponse.json(usuariosFiltrados);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
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

    const [usersCounter, negocio] = await Promise.all([
      prisma.usuario.count({
        where: {
          negocioId: user.negocio.id,
        },
      }),
      prisma.negocio.findUnique({
        where: { id: user.negocio.id },
        include: { plan: { select: { limiteUsuarios: true } } },
      }),
    ]);

    const userlimit = negocio?.plan?.limiteUsuarios ?? -1;
    if (userlimit !== -1 && userlimit <= usersCounter) {
      return NextResponse.json(
        { error: "Limite de usuarios exedido" },
        { status: 400 }
      );
    }

    const nombreUsuario = (data.usuario as string).trim().toLowerCase();

    if (!EMAIL_REGEX.test(nombreUsuario)) {
      return NextResponse.json(
        { error: "El campo usuario debe ser un correo electrónico válido." },
        { status: 400 }
      );
    }

    const nombre: string =
      typeof data.nombre === "string" && data.nombre.trim()
        ? data.nombre.trim()
        : nombreUsuario
            .split("")
            .reduce((acc: string, letter: string, index: number) => {
              if (index === 0) {
                return `${acc}${letter.toUpperCase()}`;
              }
              return `${acc}${letter.toLowerCase()}`;
            }, "");

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { usuario: nombreUsuario },
      select: { id: true },
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { error: "El usuario/correo ya está en uso. Intenta con otro." },
        { status: 409 }
      );
    }

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        usuario: nombreUsuario,
        password: null,
        estadoCuenta: UsuarioEstadoCuenta.PENDIENTE_VERIFICACION,
        negocioId: user.negocio.id,
        localActualId: null,
      },
      select: usuarioListSelect,
    });

    await sendUserInviteNotification({
      request: req,
      usuarioId: usuario.id,
      negocioId: user.negocio.id,
      negocioNombre: negocio?.nombre ?? "",
      creadorNombre: user.nombre ?? "",
      creadorEmail: user.usuario ?? "",
      invitadoNombre: nombre,
      invitadoEmail: nombreUsuario,
    });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "El usuario/correo ya está en uso. Intenta con otro." },
        { status: 409 }
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Error al crear un usuario" },
      { status: 500 }
    );
  }
}
