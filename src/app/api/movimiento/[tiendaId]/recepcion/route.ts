import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    
    const { tiendaId } = await params;
    
    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        destinationId: tiendaId,
        tipo: MovimientoTipo.TRASPASO_SALIDA
      },
      include: {
        productoTienda: {
          include: {
            producto: true,
            tienda: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
              }
            },
            proveedor: true,
          }
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    })

    return NextResponse.json(movimientos, {status: 200});
  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 }
    );
  }
}