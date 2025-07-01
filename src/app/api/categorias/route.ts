import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from '@/utils/getUserFromRequest';

// Obtener todas las categorías
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

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

    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const user = await getUserFromRequest(request);

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

