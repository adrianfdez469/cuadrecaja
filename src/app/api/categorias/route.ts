import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from "@/utils/auth";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { verificarPermisoUsuario } from '@/utils/permisos_back';

// Obtener todas las categorías
export async function GET(request: NextRequest) {
  try {    // Intentar obtener sesión desde cookies (web) o headers (Flutter)
    let session = await getSession();
    
    // Si no hay sesión por cookies, intentar desde headers (para Flutter)
    if (!session) {
      session = await getSessionFromRequest(request);
    }
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado. Debes iniciar sesión.' },
        { status: 401 }
      );
    }
    
    const user = session.user;

    const categorias = await prisma.categoria.findMany({
      orderBy: [
        { esGlobal: 'desc' },
        { nombre: 'asc' }
      ],
      where: {
        OR: [
          { negocioId: null },
          { negocioId: user.negocio.id }
        ]
      }
    });
    return NextResponse.json(categorias);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

// Crear una nueva categoría
export async function POST(request: NextRequest) {
  try {
    // Intentar obtener sesión desde cookies (web) o headers (Flutter)
    let session = await getSession();
    
    // Si no hay sesión por cookies, intentar desde headers (para Flutter)
    if (!session) {
      session = await getSessionFromRequest(request);
    }
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado. Debes iniciar sesión.' },
        { status: 401 }
      );
    }
    
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.categorias.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, color, esGlobal } = await request.json();
    const createAsGlobal = user.rol === "SUPER_ADMIN" && esGlobal === true;

    const newCategory = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        color,
        esGlobal: createAsGlobal,
        negocioId: createAsGlobal ? null : user.negocio.id,
      },
    });
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}

