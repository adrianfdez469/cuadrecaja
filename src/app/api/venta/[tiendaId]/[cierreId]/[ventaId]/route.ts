import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { MovimientoTipo } from "@prisma/client";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ tiendaId: string; cierreId: string; ventaId }> },
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.pos-venta.cancelarventa",
        user.rol,
      ) &&
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.ventas.eliminar",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
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
            fechaFin: true,
          },
        },
      },
    });

    if (venta.cierrePeriodo.fechaFin) {
      throw Error(
        "La venta que se trata de elimnar está en un período que ah sido cerrado",
      );
    }

    // Buscamos los movimientos de tipo SALIDA generados por la venta (VENTA, DESAGREGACION_BAJA)
    // Buscamos los movimientos de tipo ENTRADA generados por la venta (DESAGREGACION_ALTA)

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        referenciaId: ventaId,
      },
    });

    // Generamos un movimiento de ajuste para arreglar cantidades
    // Eliminamos la venta y sus dependencias con prodoctos

    await prisma.$transaction(async (tx) => {
      // Existencia resultante por productoTienda: una misma venta puede generar
      // varios movimientos sobre el mismo producto (VENTA + DESAGREGACION_*),
      // así que la existencia anterior de cada ajuste es el resultado del ajuste
      // previo, no la que hay en base al inicio.
      const existenciasEncadenadas = new Map<string, number>();

      for (const mov of movimientos) {
        const tipoMov =
          mov.tipo === "VENTA" || mov.tipo === "DESAGREGACION_BAJA"
            ? MovimientoTipo.AJUSTE_ENTRADA
            : MovimientoTipo.AJUSTE_SALIDA;

        const delta = isMovimientoBaja(tipoMov) ? -mov.cantidad : mov.cantidad;

        let existenciaAnterior = existenciasEncadenadas.get(
          mov.productoTiendaId,
        );
        if (existenciaAnterior === undefined) {
          const productoTienda = await tx.productoTienda.findUnique({
            where: { id: mov.productoTiendaId },
            select: { existencia: true },
          });
          existenciaAnterior = productoTienda?.existencia ?? 0;
        }

        await tx.productoTienda.update({
          where: {
            id: mov.productoTiendaId,
          },
          data: {
            existencia: {
              increment: delta,
            },
          },
        });

        existenciasEncadenadas.set(
          mov.productoTiendaId,
          existenciaAnterior + delta,
        );

        await tx.movimientoStock.create({
          data: {
            cantidad: mov.cantidad,
            tipo: tipoMov,
            productoTiendaId: mov.productoTiendaId,
            tiendaId: tiendaId,
            usuarioId: usuarioId,
            referenciaId: ventaId,
            existenciaAnterior,
            motivo: "Eliminación de venta",
          },
        });
      }

      await tx.ventaProducto.deleteMany({
        where: {
          ventaId: ventaId,
        },
      });
      await tx.venta.delete({
        where: {
          id: ventaId,
        },
      });
    });

    return NextResponse.json(
      { message: "Venta eliminada correctamente" },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al eliminar la venta" },
      { status: 500 },
    );
  }
}
