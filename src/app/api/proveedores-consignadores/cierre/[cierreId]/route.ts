import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> }
) {
  try {
    const { cierreId } = await params;

    if (!cierreId) {
      return NextResponse.json(
        { error: "Cierre ID es requerido" },
        { status: 400 }
      );
    }

    await prisma.productoProveedorConsignadorLiquidaciónCierre.updateMany({
      where: {
        cierreId
      },
      data: {
        liquidatedAt: new Date()
      }
    });

    
    return NextResponse.json(
      { message: "Productos editados correctamente" },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Error al realizar la liquidación:", error);
    return NextResponse.json(
      { error: "Error al realizar la liquidación" },
      { status: 500 }
    );
  }
}
