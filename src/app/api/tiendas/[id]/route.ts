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

    // Verificar si la tienda existe antes de eliminarla
    const tienda = await prisma.tienda.findUnique({
      where: { id },
    });

    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    await prisma.tienda.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Tienda eliminada correctamente" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar la tienda" }, { status: 500 });
  }
}

// Actualizar una tienda existente
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {

    const { id } = params;

    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { nombre, idusuarios } = await req.json();
    const updatedTienda = await prisma.tienda.update({
      where: { id },
      data: {
        nombre,
        usuarios: {
          set: idusuarios.map((id:string) => ({id: id})),
        },
      },
      include: { usuarios: true },
    });
    return NextResponse.json(updatedTienda);
  } catch (error) {
    console.log(error)
    
    return NextResponse.json({ error: "Error al actualizar la tienda" }, { status: 500 });
  }
}
