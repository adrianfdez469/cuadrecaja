import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { NextRequest, NextResponse } from 'next/server';
import { tasaCambioCreateSchema } from '@/schemas/tasaCambio';
import { buildTasaSnapshot } from '@/lib/currency';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const negocio = await prisma.negocio.findUnique({ where: { id }, select: { monedaBase: true } });
    if (!negocio) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const tasas = await prisma.tasaCambio.findMany({
      where: { negocioId: id },
      include: { creadoPor: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const vigentes = buildTasaSnapshot(tasas);

    return NextResponse.json({ tasas, vigentes, monedaBase: negocio.monedaBase });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar tasas de cambio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const result = tasaCambioCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }
    const negocio = await prisma.negocio.findUnique({ where: { id }, select: { monedaBase: true } });
    if (!negocio) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    if (result.data.monedaCode === 'CUP') {
      return NextResponse.json({ error: 'No se puede registrar tasa para CUP (es el ancla universal)' }, { status: 400 });
    }

    const tasaCambio = await prisma.tasaCambio.create({
      data: {
        negocioId: id,
        monedaCode: result.data.monedaCode,
        tasa: result.data.tasa,
        creadoPorId: session.user.id,
      },
      include: { creadoPor: { select: { id: true, nombre: true } } },
    });
    return NextResponse.json(tasaCambio, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al registrar tasa de cambio' }, { status: 500 });
  }
}
