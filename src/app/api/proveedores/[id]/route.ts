import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from "@/utils/auth";
import { IProveedorUpdate } from '@/types/IProveedor';
import { verificarPermisoUsuario } from '@/utils/permisos_back';

// GET /api/proveedores/[id] - Obtener un proveedor por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;
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

    // Obtener información del usuario si existe
    let usuarioInfo = null;
    if (proveedor.usuarioId) {
      usuarioInfo = await prisma.usuario.findUnique({
        where: { id: proveedor.usuarioId },
        select: {
          id: true,
          nombre: true,
          usuario: true,
        },
      });
    }

    const respuesta = {
      ...proveedor,
      usuario: usuarioInfo,
    };

    return NextResponse.json(respuesta);
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
    
    const { id } = await params;
    
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.proveedores.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
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

    // Validar que el usuario asociado existe y pertenece al mismo negocio
    if (body.usuarioId) {
      const usuarioExiste = await prisma.usuario.findFirst({
        where: {
          id: body.usuarioId,
          negocioId: user.negocio.id,
        },
      });

      if (!usuarioExiste) {
        return NextResponse.json({ error: 'El usuario seleccionado no existe o no pertenece al negocio' }, { status: 400 });
      }
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
        ...(body.usuarioId !== undefined && { usuarioId: body.usuarioId || null }),
      },
    });

    // Obtener información del usuario si existe para la respuesta
    let usuarioInfo = null;
    if (proveedorActualizado.usuarioId) {
      usuarioInfo = await prisma.usuario.findUnique({
        where: { id: proveedorActualizado.usuarioId },
        select: {
          id: true,
          nombre: true,
          usuario: true,
        },
      });
    }

    const respuesta = {
      ...proveedorActualizado,
      usuario: usuarioInfo,
    };

    return NextResponse.json(respuesta);
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
    
    const { id } = await params;
    
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.proveedores.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
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