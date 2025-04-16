import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { hasAdminPrivileges } from "@/utils/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }
    
    const { id } = await params;


    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si el producto existe antes de eliminarlo
    const producto = await prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await prisma.producto.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Producto eliminado correctamente" }, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al eliminar el producto" }, { status: 500 });
  }
}

// Actualizar un producto existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const { id } = await params;

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { nombre, categoriaId, descripcion, fraccion } = await req.json();

    const updatedProduct = await prisma.producto.update({
      where: { id },
      data: { 
        nombre, 
        descripcion, 
        categoriaId,
        ...(fraccion && {fraccionDeId: fraccion.fraccionDeId, unidadesPorFraccion: fraccion.unidadesPorFraccion})
      },
    });
    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.log(error);
    
    return NextResponse.json({ error: "Error al actualizar el producto" }, { status: 500 });
  }
}