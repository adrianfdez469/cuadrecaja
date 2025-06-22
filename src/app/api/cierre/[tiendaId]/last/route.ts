import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// 1. Obtiene el último período
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json({ error: "Tienda ID es requerido" }, { status: 400 });
    }

    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
    });

    // Retornar null explícitamente si no hay períodos
    return NextResponse.json(ultimoPeriodo || null);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener el estado del período" }, { status: 500 });
  }
}