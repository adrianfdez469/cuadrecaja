import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";;
import bcrypt from "bcrypt";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { Prisma } from "@prisma/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Obtener usuarios del negocio (excluyendo SUPER_ADMIN)
export async function GET() {
  try {
    const session = await getSession();
    const user = session.user;
    const usuarios = await prisma.usuario.findMany({
      where: {
        negocioId: user.negocio.id,
      }
    });
    
    const usuariosFiltrados = usuarios.filter(user => user.rol !== "SUPER_ADMIN");

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

    if(!verificarPermisoUsuario(user.permisos || '', "configuracion.usuarios.acceder", user.rol )) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );    
    }
    
    const [usersCounter, negocio] = await Promise.all([
      prisma.usuario.count({
        where: {
          negocioId: user.negocio.id
        }
      }),
      prisma.negocio.findUnique({
        where: { id: user.negocio.id },
        include: { plan: { select: { limiteUsuarios: true } } }
      })
    ]);

    const userlimit = negocio.plan?.limiteUsuarios ?? -1;
    if (userlimit !== -1 && userlimit <= usersCounter) {
      return NextResponse.json(
        { error: "Limite de usuarios exedido" },
        { status: 400 }
      );
    }

    const nombreUsuario = (data.usuario as string).trim().toLowerCase();
    data.usuario = nombreUsuario;

    if (!EMAIL_REGEX.test(data.usuario)) {
      return NextResponse.json(
        { error: "El campo usuario debe ser un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (!data.nombre) {
      data.nombre = nombreUsuario
        .split("")
        .reduce((acc: string, letter: string, index: number) => {
          if (index === 0) {
            return `${acc}${letter.toUpperCase()}`;
          }
          return `${acc}${letter.toLowerCase()}`;
        }, "");
    }

    const password = await bcrypt.hash(data.password, 10);

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { usuario: data.usuario },
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
        ...data,
        nombre: data.nombre,
        password,
        negocioId: user.negocio.id,
        localActualId: null
      },
    });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
