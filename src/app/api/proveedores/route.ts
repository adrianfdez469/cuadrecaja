import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IProveedorCreate } from '@/types/IProveedor';
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from '@/utils/permisos_back';

// GET /api/proveedores - Obtener todos los proveedores con filtro opcional por nombre
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    const { searchParams } = new URL(request.url);
    const nombre = searchParams.get('nombre');

    const whereClause: {negocioId: string, nombre?: {contains: string, mode: 'insensitive'}} = {
      negocioId: user.negocio.id,
    };

    if (nombre) {
      whereClause.nombre = {
        contains: nombre,
        mode: 'insensitive',
      };
    }

    // Obtener proveedores básicos
    const proveedores = await prisma.proveedor.findMany({
      where: whereClause,
      orderBy: {
        nombre: 'asc',
      },
    });

    // Enriquecer con información del usuario si existe
    const proveedoresConUsuarios = await Promise.all(
      proveedores.map(async (proveedor) => {
        if (proveedor.usuarioId) {
          const usuario = await prisma.usuario.findUnique({
            where: { id: proveedor.usuarioId },
            select: {
              id: true,
              nombre: true,
              usuario: true,
            },
          });
          return { ...proveedor, usuario };
        }
        return proveedor;
      })
    );

    return NextResponse.json(proveedoresConUsuarios);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/proveedores - Crear un nuevo proveedor
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.proveedores.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const body: IProveedorCreate = await request.json();
    
    if (!body.nombre || body.nombre.trim() === '') {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 });
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

    // Verificar si ya existe un proveedor con el mismo nombre en el negocio
    const existingProveedor = await prisma.proveedor.findFirst({
      where: {
        nombre: body.nombre.trim(),
        negocioId: user.negocio.id,
      },
    });

    if (existingProveedor) {
      return NextResponse.json({ error: 'Ya existe un proveedor con ese nombre' }, { status: 409 });
    }

    const nuevoProveedor = await prisma.proveedor.create({
      data: {
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        direccion: body.direccion?.trim() || null,
        telefono: body.telefono?.trim() || null,
        negocioId: user.negocio.id,
        usuarioId: body.usuarioId || null,
      },
    });

    // Obtener información del usuario si existe para la respuesta
    let usuarioInfo = null;
    if (nuevoProveedor.usuarioId) {
      usuarioInfo = await prisma.usuario.findUnique({
        where: { id: nuevoProveedor.usuarioId },
        select: {
          id: true,
          nombre: true,
          usuario: true,
        },
      });
    }

    const respuesta = {
      ...nuevoProveedor,
      usuario: usuarioInfo,
    };

    return NextResponse.json(respuesta, { status: 201 });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 