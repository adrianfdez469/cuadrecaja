import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;

    // F-021: no permission — this is the POS catalogue every cashier loads (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const productosTienda = await prisma.productoTienda.findMany({
      where: withTenantScope(
        "productoTienda",
        {
          tiendaId: tiendaId,
          precio: {
            gt: 0, // Solo productos con precio mayor a 0
          },
          deletedAt: null,
          producto: { deletedAt: null },
        },
        scope.negocioId,
      ),
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            categoria: {
              select: {
                nombre: true,
                color: true,
              },
            },
            codigosProducto: {
              select: {
                id: true,
                codigo: true,
              },
            },
          },
        },
        proveedor: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        producto: {
          nombre: "asc",
        },
      },
    });

    return NextResponse.json(productosTienda);
  } catch (error) {
    console.error("Error al obtener productos con códigos:", error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 },
    );
  }
}
