import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";;
import bcrypt from "bcrypt";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

// Obtener usuarios del negocio (excluyendo SUPER_ADMIN)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    const user = session.user;
    const usuarios = await prisma.usuario.findMany({
      where: {
        negocioId: user.negocio.id,
        rol: {
          not: "SUPER_ADMIN"
        }
      }
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    console.log(error);
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
    
    // Contar solo usuarios que no sean SUPER_ADMIN (usuarios del negocio)
    const usersCounter = await prisma.usuario.count({
      where: {
        negocioId: user.negocio.id,
        rol: {
          not: "SUPER_ADMIN"
        }
      }
    });

    
    if(user.negocio.userlimit <= usersCounter && user.negocio.userlimit > 0 ) {
      return NextResponse.json(
        { error: "Limite de usuarios exedido" },
        { status: 400 }
      );
    }

    const nombreUsuario = (data.usuario as string).trim();

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

    const usuario = await prisma.usuario.create({
      data: {
        ...data,
        nombre: nombreUsuario,
        password,
        negocioId: user.negocio.id,
        localActualId: null
      },
    });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al crear un usuario" },
      { status: 500 }
    );
  }
}
