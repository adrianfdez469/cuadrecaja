import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { NextRequest, NextResponse } from 'next/server';
import { negocioMonedaUpdateSchema } from '@/schemas/moneda';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; code: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id, code } = await params;
    const body = await req.json();
    const result = negocioMonedaUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const negocioMoneda = await prisma.negocioMoneda.update({
      where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
      data: result.data,
      include: { moneda: true },
    });
    return NextResponse.json(negocioMoneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar moneda' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; code: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id, code } = await params;
    await prisma.negocioMoneda.update({
      where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
      data: { activo: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al deshabilitar moneda' }, { status: 500 });
  }
}
