import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from '@/utils/permisos_back';

// Obtener todas las categorías
export async function GET() {
  try {
    const session = await getSession();
    const user = session.user;

    const categorias = await prisma.categoria.findMany({
      orderBy: {
        nombre: 'asc'
      },
      where: {
        negocioId: user.negocio.id
      }
    });
    return NextResponse.json(categorias);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

// Crear una nueva categoría
export async function POST(request: Request) {
  try {

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.categorias.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, color } = await request.json();
    const newCategory = await prisma.categoria.create({
      data: { nombre: nombre.trim(), color, negocioId: user.negocio.id },
    });
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}

