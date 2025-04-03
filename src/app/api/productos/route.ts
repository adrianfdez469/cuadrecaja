import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";

// Obtener todos los productos (Accesible para todos)
export async function GET() {
  try {
    const productos = (await prisma.producto.findMany({
      include: {
        categoria: {
          select: {
            nombre: true,
            color: true,
          },
        },
      },
    }));
    return NextResponse.json(productos);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

// Crear un nuevo producto (Solo Admin)
export async function POST(req: Request) {
  try {
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, descripcion, categoriaId } = await req.json();
    const nuevoProducto = await prisma.producto.create({
      data: { nombre, descripcion, categoriaId },
    });

    return NextResponse.json(nuevoProducto, { status: 201 });
  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al crear categoría" },
      { status: 500 }
    );
  }
}
