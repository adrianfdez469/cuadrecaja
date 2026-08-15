import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * The sale catalog, projected down to what the POS screen reads.
 *
 * A separate route rather than a flag on `productos_venta`: that one is also
 * consumed by the inventory view and the onboarding tour, both of which need
 * the wider shape (costs above all). Making its response conditional on a
 * query parameter would leave two different payloads behind one type.
 *
 * What this leaves out, for a 2000-product shop, is most of the bytes: the
 * supplier record repeated in full on every product, free-text descriptions,
 * and the cost columns — which a cashier's device should not be holding in the
 * first place.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;

    const session = await getSession();
    const user = session.user;

    // Un usuario asociado a proveedores solo ve los productos de esos
    // proveedores — misma regla que `productos_venta`.
    const proveedores = await prisma.proveedor.findMany({
      where: { usuarioId: user.id },
      select: { id: true },
    });

    const filter: { proveedor?: { id: { in: string[] } } } = {};
    if (proveedores.length > 0) {
      filter.proveedor = { id: { in: proveedores.map((p) => p.id) } };
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId,
        deletedAt: null,
        producto: { deletedAt: null },
        // Filtrado en el servidor, no en el cliente: un producto sin precio no
        // se puede vender, así que no hay razón para enviarlo por la red.
        precio: { gt: 0 },
        ...filter,
      },
      select: {
        id: true,
        tiendaId: true,
        precio: true,
        existencia: true,
        productoId: true,
        proveedorId: true,
        fechaVencimiento: true,
        monedaPrecioCode: true,
        proveedor: { select: { id: true, nombre: true } },
        producto: {
          select: {
            id: true,
            nombre: true,
            permiteDecimal: true,
            fraccionDeId: true,
            unidadesPorFraccion: true,
            categoria: { select: { id: true, nombre: true, color: true } },
            codigosProducto: { select: { codigo: true } },
          },
        },
      },
      // Sin `orderBy`: el cliente reordena de todas formas con `localeCompare`,
      // que ordena acentos y mayúsculas como espera un hispanohablante y como
      // no lo hace la colación de la base.
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
      { error: "Error al obtener el catálogo del POS" },
      { status: 500 },
    );
  }
}
