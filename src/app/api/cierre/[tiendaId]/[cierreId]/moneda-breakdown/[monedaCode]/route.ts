import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { billCountSchema } from "@/schemas/billBreakdown";
import { z } from "zod";

const putBodySchema = z.object({
  items: z.array(billCountSchema),
  total: z.number().min(0),
});

type Params = { cierreId: string; monedaCode: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { cierreId, monedaCode } = await params;
    await getSession();

    const breakdown = await prisma.cashBreakdownMoneda.findUnique({
      where: { cierrePeriodoId_monedaCode: { cierrePeriodoId: cierreId, monedaCode } },
    });

    return NextResponse.json(breakdown ?? null, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al obtener el desglose" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { cierreId, monedaCode } = await params;
    await getSession();

    const body = putBodySchema.parse(await req.json());

    const breakdown = await prisma.cashBreakdownMoneda.upsert({
      where: { cierrePeriodoId_monedaCode: { cierrePeriodoId: cierreId, monedaCode } },
      create: { cierrePeriodoId: cierreId, monedaCode, items: body.items, total: body.total },
      update: { items: body.items, total: body.total },
    });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al guardar el desglose" }, { status: 500 });
  }
}
