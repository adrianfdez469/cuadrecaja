import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { NextRequest, NextResponse } from 'next/server';
import { negocioMonedaCreateSchema } from '@/schemas/moneda';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const monedas = await prisma.negocioMoneda.findMany({
      where: { negocioId: id },
      include: { moneda: { include: { denominaciones: { where: { activo: true }, orderBy: { orden: 'desc' } } } } },
      orderBy: { monedaCode: 'asc' },
    });
    return NextResponse.json(monedas);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar monedas del negocio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const result = negocioMonedaCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const exists = await prisma.negocioMoneda.findUnique({
      where: { negocioId_monedaCode: { negocioId: id, monedaCode: result.data.monedaCode } },
    });
    if (exists) {
      if (exists.activo) {
        return NextResponse.json({ error: 'Esa moneda ya está habilitada en este negocio' }, { status: 409 });
      }
      // Record exists but was disabled — reactivate it
      const reactivated = await prisma.negocioMoneda.update({
        where: { negocioId_monedaCode: { negocioId: id, monedaCode: result.data.monedaCode } },
        data: { activo: true, admiteEfectivo: result.data.admiteEfectivo, admiteTransferencia: result.data.admiteTransferencia },
        include: { moneda: true },
      });
      return NextResponse.json(reactivated, { status: 200 });
    }
    const negocioMoneda = await prisma.negocioMoneda.create({
      data: { negocioId: id, ...result.data },
      include: { moneda: true },
    });
    return NextResponse.json(negocioMoneda, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al habilitar moneda' }, { status: 500 });
  }
}
