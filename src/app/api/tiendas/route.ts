import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/utils/auth";

// Obtener todas las categorías
export async function GET() {
  try {
    const tiendas = await prisma.tienda.findMany({
      include: {
        usuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
    
    return NextResponse.json(tiendas);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener tiendas" },
      { status: 500 }
    );
  }
}

// Crear una nueva categoría
export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, idusuarios } = await request.json();
    const newTienda = await prisma.tienda.create({
      data: {
        nombre,
        usuarios: {
          connect: idusuarios.map((id:string) => ({id: id})),
        },
      },
    });
    return NextResponse.json(newTienda, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al crear la tienda" },
      { status: 500 }
    );
  }
}
