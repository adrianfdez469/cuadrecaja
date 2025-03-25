import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { isAdmin } from "@/utils/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {

    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si la categoría existe antes de eliminarla
    const categoria = await prisma.categoria.findUnique({
      where: { id },
    });

    if (!categoria) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    await prisma.categoria.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Categoría eliminada correctamente" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar la categoría" }, { status: 500 });
  }
}

// Actualizar una categoría existente
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {

    const { id } = params;

    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { nombre, color } = await req.json();
    const updatedCategory = await prisma.categoria.update({
      where: { id },
      data: { nombre, color },
    });
    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.log(error);
    
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 });
  }
}



