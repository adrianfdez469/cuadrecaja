import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cerrar el período actual y abrir uno nuevo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }
) {
  try {
    const { tiendaId, cierreId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 }
      );
    }

    // Buscar el último período
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
    });

    // Verificar que esté abierto
    if (ultimoPeriodo.fechaFin) {
      return NextResponse.json(
        { error: "Ultimo período está cerrado actualmente" },
        { status: 400 }
      );
    } else if(ultimoPeriodo.id !== cierreId) {
      return NextResponse.json(
        { error: "Ultimo período no coincide con el periodo que proporcionas. Recargue el sisema." },
        { status: 400 }
      );
    } else{
      // Cerrar el periodo
      const periodoCerrado = await prisma.cierrePeriodo.update({
        where: { id: ultimoPeriodo.id },
        data: { fechaFin: new Date() },
      });

      return NextResponse.json(periodoCerrado, { status: 201 });
    }
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 }
    );
  }
}
