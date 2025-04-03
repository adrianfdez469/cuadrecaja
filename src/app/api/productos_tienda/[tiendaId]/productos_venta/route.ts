import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";



// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: { tiendaId: string } }) {
  try {
    const { tiendaId } = await params;

    const productos = (await prisma.producto.findMany({
      where: {
        productosTienda: {
          some: { // Solo productos que tengan relación con la tienda
            tiendaId: tiendaId
          }
        }
      },
      include: {
        productosTienda: {
          select: {
            costo: true, 
            existencia: true, 
            precio: true,
            id: true
          },
          where: {
            tiendaId: tiendaId
          }
        },
        categoria: {
          select: {
            id: true,
            color: true,
            nombre: true,
          }
        }
      },
    }));
    
    
    const productosTienda = productos.map(p => {
      const {productosTienda, ...restProd} = p;
      const {id, ...restProductosTienda} = productosTienda[0];
      return {
        ...restProd,
        productoTiendaId: id,
        ...restProductosTienda
      }
    })
    return NextResponse.json(productosTienda);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}