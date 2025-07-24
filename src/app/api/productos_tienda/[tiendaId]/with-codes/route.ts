import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId,
        precio: {
          gt: 0 // Solo productos con precio mayor a 0
        }
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            categoria: {
              select: {
                nombre: true,
                color: true,
              }
            },
            codigosProducto: {
              select: {
                id: true,
                codigo: true,
              }
            }
          }
        },
        proveedor: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: {
        producto: {
          nombre: 'asc'
        }
      }
    });

    return NextResponse.json(productosTienda);
  } catch (error) {
    console.error("Error al obtener productos con códigos:", error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
} 