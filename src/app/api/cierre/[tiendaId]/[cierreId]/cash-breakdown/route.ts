import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { billCountSchema } from "@/schemas/billBreakdown";
import { z } from "zod";

const putBodySchema = z.object({
  currency: z.string().default("CUP"),
  items: z.array(billCountSchema),
  total: z.number().min(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    await getSession();

    const breakdown = await prisma.cashBreakdownCierre.findUnique({
      where: { cierrePeriodoId: cierreId },
    });

    if (!breakdown) return NextResponse.json(null, { status: 200 });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al obtener el desglose" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    await getSession();

    const body = putBodySchema.parse(await req.json());

    const breakdown = await prisma.cashBreakdownCierre.upsert({
      where: { cierrePeriodoId: cierreId },
      create: {
        cierrePeriodoId: cierreId,
        currency: body.currency,
        items: body.items,
        total: body.total,
      },
      update: {
        currency: body.currency,
        items: body.items,
        total: body.total,
      },
    });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al guardar el desglose" }, { status: 500 });
  }
}
