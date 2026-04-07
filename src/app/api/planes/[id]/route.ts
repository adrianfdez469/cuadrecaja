import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { updatePlanSchema } from '@/schemas/plan';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const result = updatePlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    const updated = await prisma.plan.update({ where: { id }, data: result.data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar el plan' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.plan.findUnique({
      where: { id },
      include: { negocios: { take: 1 } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    if (existing.negocios.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el plan porque está asignado a negocios activos' },
        { status: 400 }
      );
    }

    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ message: 'Plan eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar el plan' }, { status: 500 });
  }
}
