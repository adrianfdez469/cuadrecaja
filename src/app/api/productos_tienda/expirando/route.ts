import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tiendaId = searchParams.get("tiendaId");

    if (!tiendaId) {
      return NextResponse.json({ error: "tiendaId requerido" }, { status: 400 });
    }

    const ahora = new Date();
    const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId,
        fechaVencimiento: { not: null, lte: en30Dias },
        producto: { deletedAt: null }
      },
      include: {
        producto: {
          include: { categoria: true, codigosProducto: true }
        },
        proveedor: true
      },
      orderBy: { fechaVencimiento: "asc" }
    });

    const serialized = productosTienda.map(pt => ({
      ...pt,
      fechaVencimiento: pt.fechaVencimiento ? pt.fechaVencimiento.toISOString() : null
    }));

    const vencidos = serialized.filter(pt => new Date(pt.fechaVencimiento) <= ahora);
    const porVencer = serialized.filter(pt => new Date(pt.fechaVencimiento) > ahora);

    return NextResponse.json({ vencidos, porVencer });
  } catch (error) {
    console.error("Error al obtener productos por vencer:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
