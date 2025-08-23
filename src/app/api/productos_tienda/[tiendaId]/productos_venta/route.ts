import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";

// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    // Obtener el id del usuario
    const session = await getSession();
    const user = session.user;
    // Verificar si el usuario está asociado a un proveedor
    const proveedores = await prisma.proveedor.findMany({
      where: {
        usuarioId: user.id
      }
    });
    
    const filter: {proveedor?: {id: {in: string[]}}} = {};
    if(proveedores.length > 0) {
      // Solo mostrar los productos de los proveedores asociados al usuario
      filter.proveedor = {
        id: {
          in: proveedores.map(proveedor => proveedor.id)
        }
      }
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId,
        ...filter
      },
      include: {
        producto: {
          include: {
            categoria: true,
            codigosProducto: true,
          }
        },
        proveedor: true
      },
      omit:{precio: proveedores.length > 0},
      orderBy: {
        producto: {
          nombre: 'asc'
        }
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