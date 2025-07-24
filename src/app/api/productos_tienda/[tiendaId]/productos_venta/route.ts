import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId
      },
      include: {
        producto: {
          include: {
            categoria: true,
            codigosProducto: true,
          }
        },
        proveedor: true
      }
    });
    
    return NextResponse.json(productosTienda);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}