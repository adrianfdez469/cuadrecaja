import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 3. Cerrar el período actual y abrir uno nuevo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    
    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 }
      );
    }

    // Usar transacción con lock para prevenir race conditions
    const nuevoPeriodo = await prisma.$transaction(async (tx) => {
      // Buscar el último período con lock FOR UPDATE para prevenir duplicados
      const ultimoPeriodos = await tx.$queryRaw<Array<{ id: string; fechaFin: Date | null }>>`
        SELECT "id", "fechaFin" FROM "CierrePeriodo" 
        WHERE "tiendaId" = ${tiendaId} 
        ORDER BY "fechaInicio" DESC 
        LIMIT 1 
        FOR UPDATE
      `;

      const ultimoPeriodo = ultimoPeriodos.length > 0 ? ultimoPeriodos[0] : null;

      // Verificar si ya existe un período abierto
      if (ultimoPeriodo && !ultimoPeriodo.fechaFin) {
        throw new Error("PERIODO_ABIERTO");
      }

      // Crear el nuevo período dentro de la transacción
      return tx.cierrePeriodo.create({
        data: {
          fechaInicio: new Date(),
          tiendaId,
        },
      });
    });

    return NextResponse.json(nuevoPeriodo, { status: 201 });

  } catch (error) {
    console.log(error);
    
    // Manejar el error específico de período ya abierto
    if (error instanceof Error && error.message === "PERIODO_ABIERTO") {
      return NextResponse.json(
        { error: "Último período continúa abierto" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Error al abrir el período" },
      { status: 500 }
    );
  }
}
