import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Obtener todos los productos (Accesible para todos)
export async function GET(req: Request) {
  try {

    const user = await getUserFromRequest(req);

    const productos = await prisma.producto.findMany({
      include: {
        categoria: {
          select: {
            id: true,
            nombre: true,
            color: true,
          },
        },
        fraccionDe: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        nombre: "asc",
      },
      where: {
        negocioId: user.negocio.id
      }
    });
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

    const user = await getUserFromRequest(req);

    const { nombre, descripcion, categoriaId, fraccion } = await req.json();
    console.log('intert product enpoint => fraccion', fraccion);
    
    const nuevoProducto = await prisma.producto.create({
      data: { nombre, descripcion, categoriaId, negocioId: user.negocio.id, ...(fraccion && {fraccionDeId: fraccion.fraccionDeId, unidadesPorFraccion: fraccion.unidadesPorFraccion}) },
    });

    return NextResponse.json(nuevoProducto, { status: 201 });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      { error: "Error al crear el producto" },
      { status: 500 }
    );
  }
}
