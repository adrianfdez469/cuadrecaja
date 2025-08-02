import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "next-auth/react";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

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

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.cierre.cerrar", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
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
                producto: true
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
        
        if(vp.producto.proveedorId){
          const costoConsignacion = vp.costo * vp.cantidad;
          const ventaConsignacion = vp.precio * vp.cantidad;
          const gananciaConsignacion = ventaConsignacion - costoConsignacion;
          totalVentasConsignacion += ventaConsignacion;
          totalGananciasConsignacion += gananciaConsignacion;
        } else {
          const costoTotal = vp.costo * vp.cantidad;
          const ventaTotal = vp.precio * vp.cantidad;
          const ganancia = ventaTotal - costoTotal;

          totalInversion += costoTotal;
          totalVentasPropias += ventaTotal;
          totalGananciasPropias += ganancia;
        }
      }
    }

    const totalGanancia = totalGananciasPropias + totalGananciasConsignacion;

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
          if (vp.producto?.proveedorId) {
            const key = `${vp.producto.proveedorId}_${vp.producto.productoId}`;
            
            if (liquidaciones[key]) {
              // Acumular datos existentes
              liquidaciones[key].vendidos += vp.cantidad;
              liquidaciones[key].monto += (vp.cantidad * vp.costo);
              // Para costo, calculamos el promedio ponderado
              liquidaciones[key].costo = liquidaciones[key].monto / liquidaciones[key].vendidos;
              // Para precio, mantenemos el más reciente (podría ser el precio actual)
              liquidaciones[key].precio = vp.precio;
              // Para existencia, usamos la más reciente (refleja el estado actual)
              liquidaciones[key].existencia = vp.producto.existencia;
            } else {
              // Primera entrada para esta combinación proveedor-producto
              liquidaciones[key] = {
                vendidos: vp.cantidad,
                monto: vp.cantidad * vp.costo,
                costo: vp.costo,
                precio: vp.precio,
                existencia: vp.producto.existencia,
                cierreId: periodoCerrado.id,
                proveedorId: vp.producto.proveedorId,
                productoId: vp.producto.productoId,
                liquidatedAt: null
              };
            }
          }
        }
      }

      if (Object.keys(liquidaciones).length > 0) {
        await tx.productoProveedorLiquidacion.createMany({
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

    return NextResponse.json(periodoCerrado, { status: 201 });

  } catch (error) {
    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 }
    );
  }
}
