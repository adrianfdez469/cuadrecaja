import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { NextRequest, NextResponse } from "next/server";



// Obtener todos los productos (Accesible para todos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const orderBy = searchParams.get('orderBy');

    let orderByClause: {
      producto?: {
        nombre?: 'asc' | 'desc'
      }
      precio?: 'asc' | 'desc'
    } = {
      producto: {
        nombre: 'asc'
      }
    };

    if(orderBy === 'precio'){
      orderByClause = {
        precio: 'asc',
        ...orderByClause
      }
    }

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
      },
      orderBy: orderByClause
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

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.conformarprecios.acceder", user.rol)) {
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
            // costo: producto.costo
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
