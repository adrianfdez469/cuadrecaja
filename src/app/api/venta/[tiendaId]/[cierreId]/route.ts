
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 2. Crear una venta
export async function POST(req: NextRequest, { params }: { params: { tiendaId: string, cierreId: string } }) {
  try {
    
    const { cierreId, tiendaId } = await params;
    
    const { usuarioId, productos, total, totalcash, totaltransfer } = await req.json();

    if (!tiendaId || !usuarioId || !cierreId || !productos.length) {
      return NextResponse.json({ error: "Datos insuficientes para crear la venta" }, { status: 400 });
    }

    // Buscar el último período abierto
    const periodoActual = await prisma.cierrePeriodo.findUnique({
      where: {
        id: cierreId
      }
    });

    const venta = await prisma.venta.create({
      data: {
        tiendaId,
        usuarioId,
        total,
        totalcash,
        totaltransfer,
        cierrePeriodoId: periodoActual?.id || null,
        productos: {
          create: productos.map((p: any) => ({
            productoTiendaId: p.productoTiendaId,
            cantidad: p.cantidad,
          })),
        },
      },
    });

    return NextResponse.json(venta, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear la venta" }, { status: 500 });
  }
}

