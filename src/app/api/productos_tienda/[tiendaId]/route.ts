import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";
import { NextRequest, NextResponse } from "next/server";



// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;

    const user = await getUserFromRequest(req);
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
      orderBy: {
        nombre: 'asc'
      },
      where: {
        negocioId: user.negocio.id
      }
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

    if (!tiendaId || !Array.isArray(productos)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const user = await getUserFromRequest(req);
    const productosDb = await prisma.producto.findMany({
      where: {
        id: {
          in: productos.map(p => p.id)
        },
        negocioId: user.negocio.id
      },
      select: {
        id: true
      }
    });
    if(productos.every(p => {
      return productosDb.findIndex(pdb => pdb.id === p.id) >= 0
    })){
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
          },
          create: {
            tiendaId,
            productoId: producto.id,
            precio: producto.precio || 0,
            costo: producto.costo || 0,
            existencia: 0
          },
        })
      );
  
      await prisma.$transaction(operaciones);
  
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "No tiene los permisos necesarios" }, { status: 403 });
    }



  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
