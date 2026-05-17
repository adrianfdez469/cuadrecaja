import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { monedaCreateSchema } from '@/schemas/moneda';

export async function GET() {
  try {
    const monedas = await prisma.moneda.findMany({
      include: { denominaciones: { orderBy: { orden: 'desc' } } },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(monedas);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar monedas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const body = await req.json();
    const result = monedaCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const exists = await prisma.moneda.findUnique({ where: { code: result.data.code } });
    if (exists) {
      return NextResponse.json({ error: 'Ya existe una moneda con ese código' }, { status: 409 });
    }
    const moneda = await prisma.moneda.create({ data: result.data });
    return NextResponse.json(moneda, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear moneda' }, { status: 500 });
  }
}
