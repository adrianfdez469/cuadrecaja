import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  simbolo: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { code } = await params;
    const body = await req.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const moneda = await prisma.moneda.update({ where: { code }, data: result.data });
    return NextResponse.json(moneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar moneda' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { code } = await params;
    // Desactivar en lugar de eliminar (puede estar referenciada en NegocioMoneda)
    const moneda = await prisma.moneda.update({ where: { code }, data: { activo: false } });
    return NextResponse.json(moneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al desactivar moneda' }, { status: 500 });
  }
}
