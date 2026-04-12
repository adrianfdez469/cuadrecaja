import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import dayjs from 'dayjs';

export async function GET(request: NextRequest) {
  try {
    const soloActivacionLanding = request.nextUrl.searchParams.get('soloActivacionLanding');
    const filtrarLanding =
      soloActivacionLanding === '1' ||
      soloActivacionLanding === 'true';

    const where: Prisma.NegocioWhereInput | undefined = filtrarLanding
      ? { creadoPorActivacionLanding: true }
      : undefined;

    const negocios = await prisma.negocio.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(negocios);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error cargar los negocios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {

    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { nombre, duracion, planId } = await request.json();

    const futureDate = dayjs().add(duracion, 'days').set('hour', 23).set('minute', 59).set('second', 0).set('millisecond', 0);

    const newNegocio = await prisma.negocio.create({
      data: {
        nombre: nombre.trim(),
        limitTime: futureDate.toISOString(),
        ...(planId ? { planId } : {}),
      },
    });
    return NextResponse.json(newNegocio, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al crear el negocio' }, { status: 500 });
  }
}