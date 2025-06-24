import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";

// Actualizar un negocio existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;
    const { nombre, locallimit, userlimit, productlimit } = await req.json();

    // Verificar que el negocio existe
    const negocioExistente = await prisma.negocio.findUnique({
      where: { id }
    });

    if (!negocioExistente) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Actualizar el negocio
    const negocioActualizado = await prisma.negocio.update({
      where: { id },
      data: {
        nombre,
        locallimit,
        userlimit,
        productlimit: productlimit || 0
      },
    });

    return NextResponse.json(negocioActualizado);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al actualizar el negocio' }, { status: 500 });
  }
}

// Eliminar un negocio
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que el negocio existe
    const negocioExistente = await prisma.negocio.findUnique({
      where: { id },
      include: {
        usuarios: { take: 1 },
        tiendas: { take: 1 },
        productos: { take: 1 },
        categorias: { take: 1 }
      }
    });

    if (!negocioExistente) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Verificar que no tiene datos asociados
    if (negocioExistente.usuarios.length || 
        negocioExistente.tiendas.length || 
        negocioExistente.productos.length || 
        negocioExistente.categorias.length) {
      return NextResponse.json(
        { error: "No se puede eliminar el negocio porque tiene datos asociados" },
        { status: 400 }
      );
    }

    // Eliminar el negocio
    await prisma.negocio.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Negocio eliminado exitosamente" });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al eliminar el negocio' }, { status: 500 });
  }
} 