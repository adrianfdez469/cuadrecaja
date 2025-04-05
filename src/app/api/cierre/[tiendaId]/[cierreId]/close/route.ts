import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }
) {
  try {
    const { tiendaId, cierreId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 }
      );
    }

    // Buscar el último período abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
      include: {
        ventas: {
          include: {
            productos: {
              include: {
                producto: true, // ProductoTienda
              },
            },
          },
        },
      },
    });

    if (!ultimoPeriodo) {
      return NextResponse.json(
        { error: "No hay períodos para esta tienda" },
        { status: 404 }
      );
    }

    if (ultimoPeriodo.fechaFin) {
      return NextResponse.json(
        { error: "El último período ya está cerrado" },
        { status: 400 }
      );
    }

    if (ultimoPeriodo.id !== cierreId) {
      return NextResponse.json(
        { error: "Período no coincide con el cierre solicitado" },
        { status: 400 }
      );
    }

    // CALCULOS
    let totalVentas = 0;
    let totalInversion = 0;

    for (const venta of ultimoPeriodo.ventas) {
      totalVentas += venta.total;
      for (const vp of venta.productos) {
        totalInversion += vp.producto.costo * vp.cantidad;
      }
    }

    const totalGanancia = totalVentas - totalInversion;

    // Cerrar el período con resumen
    const periodoCerrado = await prisma.cierrePeriodo.update({
      where: { id: ultimoPeriodo.id },
      data: {
        fechaFin: new Date(),
        totalVentas,
        totalInversion,
        totalGanancia,
      },
    });

    return NextResponse.json(periodoCerrado, { status: 201 });

  } catch (error) {
    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 }
    );
  }
}
