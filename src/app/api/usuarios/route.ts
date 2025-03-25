import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Obtener todas las categorías
export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany();
    return NextResponse.json(usuarios);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}