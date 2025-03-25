import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from "@/utils/auth";

// Obtener todas las categorías
export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany();
    return NextResponse.json(categorias);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

// Crear una nueva categoría
export async function POST(request: Request) {
  try {

    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { nombre, color } = await request.json();
    const newCategory = await prisma.categoria.create({
      data: { nombre, color },
    });
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.log(error);
    
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}

