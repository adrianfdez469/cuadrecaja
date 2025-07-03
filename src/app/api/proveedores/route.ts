import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getUserFromRequest from '@/utils/getUserFromRequest';
import { IProveedorCreate } from '@/types/IProveedor';
import { hasAdminPrivileges } from "@/utils/auth";
import { Prisma } from '@prisma/client';

// GET /api/proveedores - Obtener todos los proveedores con filtro opcional por nombre
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

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

    const proveedores = await prisma.proveedor.findMany({
      where: whereClause,
      orderBy: {
        nombre: 'asc',
      },
    });

    return NextResponse.json(proveedores);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/proveedores - Crear un nuevo proveedor
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    if (!hasAdminPrivileges()) {
      return NextResponse.json({ error: 'No tienes permisos para crear proveedores' }, { status: 403 });
    }

    const body: IProveedorCreate = await request.json();
    
    if (!body.nombre || body.nombre.trim() === '') {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 });
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
      },
    });

    return NextResponse.json(nuevoProveedor, { status: 201 });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 