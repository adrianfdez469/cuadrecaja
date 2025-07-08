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

                producto: {
                  include: {

                    producto: {
                      select: {
                        enConsignacion: true,

                      }
                    }
                  }
                }, // ProductoTienda
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
    let totalTransferencia = 0;
    let totalVentasPropias = 0;
    let totalVentasConsignacion = 0;
    let totalGananciasPropias = 0;
    let totalGananciasConsignacion = 0;

    for (const venta of ultimoPeriodo.ventas) {
      totalVentas += venta.total;
      totalTransferencia += venta.totaltransfer;

      for (const vp of venta.productos) {
        const costoTotal = vp.costo * vp.cantidad;
        const ventaTotal = vp.precio * vp.cantidad;
        const ganancia = ventaTotal - costoTotal;

        totalInversion += costoTotal;

        // Separar por tipo de producto
        if (vp.producto.producto.enConsignacion) {
          totalVentasConsignacion += ventaTotal;
          totalGananciasConsignacion += ganancia;
        } else {
          totalVentasPropias += ventaTotal;
          totalGananciasPropias += ganancia;
        }
      }
    }

    const totalGanancia = totalVentas - totalInversion;

    const [periodoCerrado] = await prisma.$transaction(async (tx) => {

      // Cerrar el período con resumen
      const periodoCerrado = await tx.cierrePeriodo.update({
        where: { id: ultimoPeriodo.id },
        data: {
          fechaFin: new Date(),
          totalVentas,
          totalInversion,
          totalGanancia,
          totalTransferencia,
          totalVentasPropias,
          totalVentasConsignacion,
          totalGananciasPropias,
          totalGananciasConsignacion,
        },
      });

      const liquidaciones = {};
      for (const venta of ultimoPeriodo.ventas) {
        for (const vp of venta.productos) {
          if (vp.producto.producto.enConsignacion) {
            const key = `${vp.producto.proveedorId}_${vp.producto.productoId}`;
            const vendidos = liquidaciones[key] ? liquidaciones[key].vendidos + vp.cantidad : vp.cantidad;
            liquidaciones[key] = {
              vendidos: vendidos,
              monto: vendidos * vp.costo,
              costo: vp.costo,
              precio: vp.precio,
              existencia: vp.producto.existencia,

              cierreId: periodoCerrado.id,
              proveedorId: vp.producto.proveedorId,
              productoId: vp.producto.productoId,
              liquidatedAt: null

            }
          }
        }
      }

      if (Object.keys(liquidaciones).length > 0) {
        await tx.productoProveedorConsignadorLiquidaciónCierre.createMany({
          data: Object.values(liquidaciones) as {
            vendidos: number,
            monto: number,
            costo: number,
            precio: number,
            existencia: number,
            cierreId: string,
            proveedorId: string,
            productoId: string,
            liquidatedAt: Date | null
          }[]
        });
      }

      return [periodoCerrado];
    });

    console.log('periodoCerrado', periodoCerrado);

    return NextResponse.json(periodoCerrado, { status: 201 });

  } catch (error) {
    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 }
    );
  }
}
