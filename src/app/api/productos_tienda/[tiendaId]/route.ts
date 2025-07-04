import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
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
          select: {
            id: true,
            nombre: true,
          }
        },
        proveedor: {
          select: {
            id: true,
            nombre: true
          }
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

export async function PUT(req: Request, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;
    const { productos } = await req.json();


    if (!(await hasAdminPrivileges())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    if (!tiendaId || !Array.isArray(productos)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    await prisma.$transaction(
      productos.map(producto => 
        prisma.productoTienda.update({
          where: {
            id: producto.id
          },
          data: {
            precio: producto.precio,
            costo: producto.costo
          }
        })
      )
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
