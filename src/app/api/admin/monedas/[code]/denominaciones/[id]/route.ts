import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  valor: z.number().positive().optional(),
  activo: z.boolean().optional(),
  orden: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const denominacion = await prisma.denominacionBillete.update({ where: { id }, data: result.data });
    return NextResponse.json(denominacion);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar denominación' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.denominacionBillete.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar denominación' }, { status: 500 });
  }
}
