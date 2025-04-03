import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 3. Cerrar el período actual y abrir uno nuevo
export async function PUT(
  req: NextRequest,
  { params }: { params: { tiendaId: string } }
) {
  try {
    
    const { tiendaId } = await params;

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


    if (ultimoPeriodo && !ultimoPeriodo.fechaFin) {
      return NextResponse.json(
        { error: "Ultimo período continua abierto" },
        { status: 400 }
      );
    } else {
      // Crear un nuevo periodo
      const nuevoPeriodo = await prisma.cierrePeriodo.create({
        data: {
          fechaInicio: new Date(),
          tiendaId,
        },
      });
      return NextResponse.json(nuevoPeriodo, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error al abrir el período" },
      { status: 500 }
    );
  }
}
