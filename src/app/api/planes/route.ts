import { prisma } from '@/lib/prisma';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createPlanSchema } from '@/schemas/plan';

export async function GET() {
  try {
    const planes = await prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(planes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar los planes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const result = createPlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const plan = await prisma.plan.create({ data: result.data });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear el plan' }, { status: 500 });
  }
}
