import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { denominacionBilleteCreateSchema } from '@/schemas/moneda';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const denominaciones = await prisma.denominacionBillete.findMany({
      where: { monedaCode: code },
      orderBy: { orden: 'desc' },
    });
    return NextResponse.json(denominaciones);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar denominaciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { code } = await params;
    const body = await req.json();
    const result = denominacionBilleteCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const maxOrden = await prisma.denominacionBillete.aggregate({
      where: { monedaCode: code },
      _max: { orden: true },
    });
    const denominacion = await prisma.denominacionBillete.create({
      data: {
        monedaCode: code,
        valor: result.data.valor,
        orden: result.data.orden ?? (maxOrden._max.orden ?? 0) + 1,
      },
    });
    return NextResponse.json(denominacion, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear denominación' }, { status: 500 });
  }
}
