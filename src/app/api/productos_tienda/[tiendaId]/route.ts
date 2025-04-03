import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";



// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    const productos = (await prisma.producto.findMany({
      include: {
        productosTienda: {
          select: {
            costo: true, existencia: true, precio: true
          },
          where: {
            tiendaId: tiendaId
          }
        },
      },
    }));
    const productosTienda = productos.map(p => {
      const {productosTienda, ...restProd} = p;
      return {
        ...restProd,
        ...productosTienda[0]
      }
    })
    return NextResponse.json(productosTienda);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;
    const { productos } = await req.json();

    console.log(tiendaId);
    console.log(productos);
    
    

    if (!tiendaId || !Array.isArray(productos)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const operaciones = productos.map((producto) =>
      prisma.productoTienda.upsert({
        where: {
          tiendaId_productoId: {
            tiendaId,
            productoId: producto.id, // Debes asegurarte de que este ID es el correcto
          },
        },
        update: {
          precio: producto.precio,
          costo: producto.costo,
          existencia: producto.existencia,
        },
        create: {
          tiendaId,
          productoId: producto.id,
          precio: producto.precio,
          costo: producto.costo,
          existencia: producto.existencia,
        },
      })
    );

    await prisma.$transaction(operaciones);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
