import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermision } from "@/utils/auth";
import bcrypt from "bcrypt";

// Obtener todas las categorías
export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany();
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
