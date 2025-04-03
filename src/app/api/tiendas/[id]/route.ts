import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { hasAdminPrivileges } from "@/utils/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si la tienda existe antes de eliminarla
    const tienda = await prisma.tienda.findUnique({
      where: { id },
    });

    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 }
      );
    }

    
    const tiendaConRelaciones = await prisma.tienda.findUnique({
      where: { id },
      include: {
        productos: { take: 1 },  // Solo necesitamos saber si existe al menos 1
        ventas: { take: 1 },     // Igual para ventas
      },
    });

    // 2. Si tiene productos o ventas, lanzar error
    if (tiendaConRelaciones?.productos.length || tiendaConRelaciones?.ventas.length) {
      return NextResponse.json(
        { error: "No se puede eliminar la tienda porque tiene productos o ventas asociadas" },
        { status: 500 }
      );
    }

    // 3. Si solo tiene usuarios (o ninguno), proceder a eliminar:
    //    - Primero las relaciones usuario-tienda
    await prisma.usuarioTienda.deleteMany({
      where: { tiendaId: id },
    });

    //    - Luego la tienda
    await prisma.tienda.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Tienda eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al eliminar la tienda" },
      { status: 500 }
    );
  }
}

// Actualizar una tienda existente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, idusuarios } = await req.json();

    const updatedTienda = await prisma.tienda.update({
      where: { id },
      data: {
        nombre,
        usuarios: {
          // Primero desconectamos todos los usuarios existentes
          deleteMany: {},
          // Luego conectamos los nuevos usuarios
          create: idusuarios.map((usuarioId: string) => ({
            usuario: { connect: { id: usuarioId } },
          })),
        },
      },
      include: {
        usuarios: {
          include: {
            usuario: true,
          },
        },
      },
    });

    // Formatear la respuesta
    const tiendaFormateada = {
      ...updatedTienda,
      usuarios: updatedTienda.usuarios.map((u) => u.usuario),
    };
    return NextResponse.json(tiendaFormateada, { status: 201 });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      { error: "Error al actualizar la tienda" },
      { status: 500 }
    );
  }
}
