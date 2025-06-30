import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermision } from "@/utils/auth";
import bcrypt from "bcrypt";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Obtener usuarios del negocio (excluyendo SUPER_ADMIN)
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
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

    if (!(await hasPermision(data.rol))) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const user = await getUserFromRequest(req);
    
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

    if (!data.nombre) {
      data.nombre = (data.usuario as string)
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
        password,
        negocioId: user.negocio.id,
        tiendaActualId: null
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
