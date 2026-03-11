import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

/**
 * DELETE - Elimina un producto de una venta sincronizada.
 * Devuelve el producto al inventario mediante un movimiento AJUSTE_ENTRADA.
 */
export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ tiendaId: string; cierreId: string; ventaId: string; ventaProductoId: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;

    const hasPermission =
      verificarPermisoUsuario(user.permisos, "operaciones.pos-venta.cancelarventa", user.rol) ||
      verificarPermisoUsuario(user.permisos, "operaciones.ventas.eliminar", user.rol);

    if (!hasPermission) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const { tiendaId, ventaId, ventaProductoId } = await params;

    const ventaProducto = await prisma.ventaProducto.findUnique({
      where: { id: ventaProductoId },
      include: {
        venta: {
          include: {
            cierrePeriodo: { select: { fechaFin: true } },
          },
        },
      },
    });

    if (!ventaProducto || ventaProducto.ventaId !== ventaId) {
      return NextResponse.json({ error: "Producto no encontrado en la venta" }, { status: 404 });
    }

    // Solo ventas del usuario o administrador
    const isAdmin = user.rol === "SUPER_ADMIN";
    const isOwnSale = ventaProducto.venta.usuarioId === user.id;
    if (!isAdmin && !isOwnSale) {
      return NextResponse.json(
        { error: "Solo puede eliminar productos de sus propias ventas" },
        { status: 403 }
      );
    }

    if (ventaProducto.venta.cierrePeriodo?.fechaFin) {
      return NextResponse.json(
        { error: "La venta pertenece a un período cerrado" },
        { status: 400 }
      );
    }

    const { cantidad, productoTiendaId, precio } = ventaProducto;
    const montoProducto = cantidad * (precio ?? 0);

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar existencia del producto (devolver al inventario)
      await tx.productoTienda.update({
        where: { id: productoTiendaId },
        data: { existencia: { increment: cantidad } },
      });

      // 2. Crear movimiento AJUSTE_ENTRADA para trazabilidad
      await tx.movimientoStock.create({
        data: {
          tipo: MovimientoTipo.AJUSTE_ENTRADA,
          cantidad,
          productoTiendaId,
          tiendaId,
          usuarioId: user.id,
          motivo: "Devolución por eliminación de producto en venta",
        },
      });

      // 3. Eliminar el VentaProducto
      await tx.ventaProducto.delete({
        where: { id: ventaProductoId },
      });

      // 4. Actualizar totales de la venta (proporcionalmente)
      const venta = ventaProducto.venta;
      const totalAnterior = Number(venta.total);
      const ratioCash = totalAnterior > 0 ? Number(venta.totalcash) / totalAnterior : 0;
      const ratioTransfer = totalAnterior > 0 ? Number(venta.totaltransfer) / totalAnterior : 0;
      const nuevoTotal = totalAnterior - montoProducto;

      await tx.venta.update({
        where: { id: ventaId },
        data: {
          total: nuevoTotal,
          totalcash: Math.round(nuevoTotal * ratioCash * 100) / 100,
          totaltransfer: Math.round(nuevoTotal * ratioTransfer * 100) / 100,
        },
      });
    });

    return NextResponse.json(
      { message: "Producto eliminado de la venta correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE producto venta]", error);
    return NextResponse.json(
      { error: "Error al eliminar el producto de la venta" },
      { status: 500 }
    );
  }
}
