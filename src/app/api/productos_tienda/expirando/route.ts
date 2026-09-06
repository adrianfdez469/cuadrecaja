import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const tiendaId = searchParams.get("tiendaId");

    // F-021: no permission — this verb never demanded one (ADR 0078). The handler no longer
    // emits its own 401 either: the only 401 of the system is the middleware's (ADR 0077).
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const ahora = new Date();
    const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

    const productosTienda = await prisma.productoTienda.findMany({
      where: withTenantScope(
        "productoTienda",
        {
          tiendaId,
          fechaVencimiento: { not: null, lte: en30Dias },
          deletedAt: null,
          producto: { deletedAt: null },
        },
        scope.negocioId,
      ),
      include: {
        producto: {
          include: { categoria: true, codigosProducto: true },
        },
        proveedor: true,
      },
      orderBy: { fechaVencimiento: "asc" },
    });

    const serialized = productosTienda.map((pt) => ({
      ...pt,
      fechaVencimiento: pt.fechaVencimiento
        ? pt.fechaVencimiento.toISOString()
        : null,
    }));

    const vencidos = serialized.filter(
      (pt) => new Date(pt.fechaVencimiento) <= ahora,
    );
    const porVencer = serialized.filter(
      (pt) => new Date(pt.fechaVencimiento) > ahora,
    );

    return NextResponse.json({ vencidos, porVencer });
  } catch (error) {
    console.error("Error al obtener productos por vencer:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
