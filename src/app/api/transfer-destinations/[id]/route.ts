import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Actualizar un destino de transferencia existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const user = await getUserFromRequest(req);
    const { nombre, descripcion, default: isDefault } = await req.json();

    // Verificar que el destino existe y pertenece al negocio del usuario
    const existingDestination = await prisma.transferDestinations.findFirst({
      where: { 
        id,
        tienda: {
          negocioId: user.negocio.id
        }
      },
      include: {
        tienda: true
      }
    });

    if (!existingDestination) {
      return NextResponse.json({ error: "Destino de transferencia no encontrado" }, { status: 404 });
    }

    // Si se está marcando como default, desmarcar otros destinos de la misma tienda
    if (isDefault) {
      await prisma.transferDestinations.updateMany({
        where: {
          tiendaId: existingDestination.tiendaId,
          default: true,
          id: { not: id }
        },
        data: {
          default: false
        }
      });
    }

    const updatedDestination = await prisma.transferDestinations.update({
      where: { id },
      data: { 
        nombre: nombre.trim(), 
        descripcion: descripcion?.trim() || null, 
        default: isDefault 
      },
    });
    return NextResponse.json(updatedDestination);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al actualizar destino de transferencia" }, { status: 500 });
  }
}

// Eliminar un destino de transferencia
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const user = await getUserFromRequest(req);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si el destino existe y pertenece al negocio del usuario
    const destination = await prisma.transferDestinations.findFirst({
      where: { 
        id,
        tienda: {
          negocioId: user.negocio.id
        }
      },
      include: {
        ventas: true
      }
    });

    if (!destination) {
      return NextResponse.json({ error: "Destino de transferencia no encontrado" }, { status: 404 });
    }

    // Verificar si hay ventas asociadas
    if (destination.ventas.length > 0) {
      return NextResponse.json({ 
        error: "No se puede eliminar el destino porque tiene ventas asociadas" 
      }, { status: 400 });
    }

    await prisma.transferDestinations.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Destino de transferencia eliminado correctamente" }, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al eliminar el destino de transferencia" }, { status: 500 });
  }
} 