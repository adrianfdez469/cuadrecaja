import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getUserFromRequest from '@/utils/getUserFromRequest';
import { hasAdminPrivileges } from "@/utils/auth";
import { IProveedorUpdate } from '@/types/IProveedor';

// GET /api/proveedores/[id] - Obtener un proveedor por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    const { id } = await params;
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const proveedor = await prisma.proveedor.findFirst({
      where: {
        id: id,
        negocioId: user.negocio.id,
      },
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json(proveedor);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/proveedores/[id] - Actualizar un proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    const { id } = await params;
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: 'No tienes permisos para actualizar proveedores' }, { status: 403 });
    }

    const body: IProveedorUpdate = await request.json();

    // Verificar que el proveedor existe y pertenece al negocio
    const existingProveedor = await prisma.proveedor.findFirst({
      where: {
        id: id,
        negocioId: user.negocio.id,
      },
    });

    if (!existingProveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Si se está actualizando el nombre, verificar que no exista otro con el mismo nombre
    if (body.nombre && body.nombre.trim() !== existingProveedor.nombre) {
      const duplicateProveedor = await prisma.proveedor.findFirst({
        where: {
          nombre: body.nombre.trim(),
          negocioId: user.negocio.id,
          id: { not: id },
        },
      });

      if (duplicateProveedor) {
        return NextResponse.json({ error: 'Ya existe un proveedor con ese nombre' }, { status: 409 });
      }
    }

    const proveedorActualizado = await prisma.proveedor.update({
      where: { id: id },
      data: {
        ...(body.nombre && { nombre: body.nombre.trim() }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion?.trim() || null }),
        ...(body.direccion !== undefined && { direccion: body.direccion?.trim() || null }),
        ...(body.telefono !== undefined && { telefono: body.telefono?.trim() || null }),
      },
    });

    return NextResponse.json(proveedorActualizado);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/proveedores/[id] - Eliminar un proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    const { id } = await params;
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar proveedores' }, { status: 403 });
    }

    // Verificar que el proveedor existe y pertenece al negocio
    const existingProveedor = await prisma.proveedor.findFirst({
      where: {
        id: id,
        negocioId: user.negocio.id,
      },
    });

    if (!existingProveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    await prisma.proveedor.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Proveedor eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 