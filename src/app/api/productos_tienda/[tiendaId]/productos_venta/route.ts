import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";

// Obtener todos los productos (Accesible para todos)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;

    // Obtener el id del usuario
    const session = await getSession();
    const user = session.user;
    // Verificar si el usuario está asociado a un proveedor
    const proveedores = await prisma.proveedor.findMany({
      where: {
        usuarioId: user.id,
      },
    });

    const filter: { proveedor?: { id: { in: string[] } } } = {};
    if (proveedores.length > 0) {
      // Solo mostrar los productos de los proveedores asociados al usuario
      filter.proveedor = {
        id: {
          in: proveedores.map((proveedor) => proveedor.id),
        },
      };
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId,
        deletedAt: null,
        producto: { deletedAt: null },
        ...filter,
      },
      include: {
        producto: {
          include: {
            categoria: true,
            // Solo el código: de cada `CodigoProducto` viajaban además su id y
            // el del producto, dos UUID por código que nadie lee. Con 2000
            // productos eso era el 15% del payload.
            codigosProducto: { select: { codigo: true } },
          },
        },
        // El proveedor va recortado a lo que las vistas leen de verdad: su
        // nombre. Antes viajaba el registro completo —fechas, negocioId, el
        // usuario asociado— repetido en cada producto, que en un inventario de
        // 2000 es puro peso muerto en la red y en el `JSON.parse` del móvil.
        proveedor: { select: { id: true, nombre: true } },
      },
      omit: { precio: proveedores.length > 0 },
      orderBy: {
        producto: {
          nombre: "asc",
        },
      },
    });

    const result = productosTienda.map((pt) => ({
      ...pt,
      fechaVencimiento: pt.fechaVencimiento
        ? pt.fechaVencimiento.toISOString()
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 },
    );
  }
}
