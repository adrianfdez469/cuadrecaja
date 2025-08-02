import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { MovimientoTipo } from "@prisma/client";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string, cierreId: string, ventaId }> }
) {
  try {
    
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(user.permisos, "operaciones.pos-venta.cancelarventa", user.rol) && 
      !verificarPermisoUsuario(user.permisos, "operaciones.ventas.eliminar", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { tiendaId, ventaId } = await params;
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get("usuarioId");

    // Revisamos si la venta pertenece a un período abierto
    const venta = await prisma.venta.findUnique({
      where: {
        id: ventaId,
      },
      include: {
        cierrePeriodo: {
          select: {
            fechaFin: true
          }
        }
      }
    });

    if(venta.cierrePeriodo.fechaFin) {
      throw Error("La venta que se trata de elimnar está en un período que ah sido cerrado");
    }

    // Buscamos los movimientos de tipo SALIDA generados por la venta (VENTA, DESAGREGACION_BAJA)
    // Buscamos los movimientos de tipo ENTRADA generados por la venta (DESAGREGACION_ALTA)

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        referenciaId: ventaId,
      }
    });

    console.log(movimientos);
    
    
    // Generamos un movimiento de ajuste para arreglar cantidades
    // Eliminamos la venta y sus dependencias con prodoctos

    const operaciones = movimientos.reduce((acc,mov) => {

      let tipoMov;
      if(mov.tipo === 'VENTA' || mov.tipo === 'DESAGREGACION_BAJA') {
        tipoMov = MovimientoTipo.AJUSTE_ENTRADA;
      } else {
        tipoMov = MovimientoTipo.AJUSTE_SALIDA;
      }

      acc.push(prisma.productoTienda.update({
        where: {
          id: mov.productoTiendaId
        },
        data: {
          existencia: {
            increment: isMovimientoBaja(tipoMov) ? -mov.cantidad : mov.cantidad,
          },
        }
      }))

      acc.push(prisma.movimientoStock.create({
        data: {
          cantidad: mov.cantidad,
          tipo: tipoMov,
          productoTiendaId: mov.productoTiendaId,
          tiendaId: tiendaId,
          usuarioId: usuarioId,
          motivo: "Eliminación de venta"
        }
      }));

      return acc;
    }, []);

    operaciones.push(prisma.ventaProducto.deleteMany({
      where: {
        ventaId: ventaId
      }
    }));
    operaciones.push(prisma.venta.delete({
      where: {
        id: ventaId
      }
    }));
    

    await prisma.$transaction(operaciones);

    return NextResponse.json(
      { message: "Venta eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al eliminar la venta" },
      { status: 500 }
    );
  }
}
