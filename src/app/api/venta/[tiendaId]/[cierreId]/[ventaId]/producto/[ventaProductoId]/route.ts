import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import {
  convertToBase,
  convertFromBase,
  pagadaConUnSoloPago,
} from "@/lib/currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IPagoLinea } from "@/schemas/pago";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * DELETE - Elimina un producto de una venta sincronizada.
 * Devuelve el producto al inventario mediante un movimiento AJUSTE_ENTRADA.
 */
export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      tiendaId: string;
      cierreId: string;
      ventaId: string;
      ventaProductoId: string;
    }>;
  },
) {
  try {
    const session = await getSession();
    const user = session.user;

    const hasPermission =
      verificarPermisoUsuario(
        user.permisos,
        "operaciones.pos-venta.cancelarventa",
        user.rol,
      ) ||
      verificarPermisoUsuario(
        user.permisos,
        "operaciones.ventas.eliminar",
        user.rol,
      );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const { tiendaId, ventaId, ventaProductoId } = await params;

    const ventaProducto = await prisma.ventaProducto.findUnique({
      where: { id: ventaProductoId },
      include: {
        venta: {
          include: {
            cierrePeriodo: { select: { fechaFin: true } },
            tienda: { select: { negocio: { select: { monedaBase: true } } } },
            _count: { select: { productos: true } },
          },
        },
      },
    });

    if (!ventaProducto || ventaProducto.ventaId !== ventaId) {
      return NextResponse.json(
        { error: "Producto no encontrado en la venta" },
        { status: 404 },
      );
    }

    // Solo ventas del usuario o administrador
    const isAdmin = user.rol === "SUPER_ADMIN";
    const isOwnSale = ventaProducto.venta.usuarioId === user.id;
    if (!isAdmin && !isOwnSale) {
      return NextResponse.json(
        { error: "Solo puede eliminar productos de sus propias ventas" },
        { status: 403 },
      );
    }

    if (ventaProducto.venta.cierrePeriodo?.fechaFin) {
      return NextResponse.json(
        { error: "La venta pertenece a un período cerrado" },
        { status: 400 },
      );
    }

    const { cantidad, productoTiendaId, precio, monedaPrecioCode } =
      ventaProducto;

    const monedaBase = ventaProducto.venta.tienda.negocio.monedaBase;
    const tasas = (ventaProducto.venta.tasaSnapshot ?? {}) as ITasaSnapshot;
    const pagos = (ventaProducto.venta.pagosDetalle ?? null) as
      IPagoLinea[] | null;

    // Si es el único producto de la venta, eliminarlo equivale a eliminar
    // la venta completa: se devuelven todos los pagos sin importar cuántos
    // ni en qué moneda fueron — no hace falta calcular nada parcial.
    const esUltimoProducto = ventaProducto.venta._count.productos === 1;

    // Con más de un pago (varias monedas, o efectivo + transferencia) no hay
    // forma de saber de cuál descontar el monto del producto eliminado —
    // salvo que sea el último producto, donde se elimina la venta entera.
    if (!esUltimoProducto && pagos && !pagadaConUnSoloPago(pagos)) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar un producto individual de una venta con más de un pago registrado (varias monedas, o efectivo y transferencia combinados).",
        },
        { status: 400 },
      );
    }

    const monedaProducto = monedaPrecioCode ?? monedaBase;
    const montoProductoBase = convertToBase(
      cantidad * (precio ?? 0),
      monedaProducto,
      tasas,
      monedaBase,
    );

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar existencia del producto (devolver al inventario)
      await tx.productoTienda.update({
        where: { id: productoTiendaId },
        data: { existencia: { increment: cantidad } },
      });

      // 2. Crear movimiento AJUSTE_ENTRADA para trazabilidad (stock + dinero)
      await tx.movimientoStock.create({
        data: {
          tipo: MovimientoTipo.AJUSTE_ENTRADA,
          cantidad,
          productoTiendaId,
          tiendaId,
          usuarioId: user.id,
          referenciaId: ventaId,
          motivo: `Devolución por eliminación de producto en venta ${ventaId} — ajuste de ${montoProductoBase.toFixed(2)} ${monedaBase} en pagos recibidos`,
        },
      });

      // 3. Eliminar el VentaProducto
      await tx.ventaProducto.delete({
        where: { id: ventaProductoId },
      });

      // Si era el último producto, la venta queda vacía: se elimina
      // la venta completa (todos los pagos quedan devueltos) y no hace
      // falta ningún ajuste parcial de total/pagosDetalle.
      if (esUltimoProducto) {
        await tx.venta.delete({ where: { id: ventaId } });
        return;
      }

      // 4. Actualizar totales de la venta (proporcionalmente, ya en moneda base)
      const v = await tx.venta.findUnique({
        where: { id: ventaId },
        select: {
          total: true,
          totalcash: true,
          totaltransfer: true,
          pagosDetalle: true,
        },
      });
      const totalAnterior = Number(v!.total);
      const ratioCash =
        totalAnterior > 0 ? Number(v!.totalcash) / totalAnterior : 0;
      const ratioTransfer =
        totalAnterior > 0 ? Number(v!.totaltransfer) / totalAnterior : 0;
      const nuevoTotal = Math.max(0, totalAnterior - montoProductoBase);

      // 5. Restar el monto también de lo "recibido" en pagosDetalle.
      // Ya se validó que hay como máximo un único pago, así que se ajusta
      // directo esa línea — no hace falta repartir entre varias.
      const pagosActuales = (v!.pagosDetalle ?? null) as IPagoLinea[] | null;
      let nuevoPagosDetalle: IPagoLinea[] | undefined;
      if (pagosActuales?.length === 1) {
        const pago = pagosActuales[0];
        const montoConv = convertFromBase(
          montoProductoBase,
          pago.moneda,
          tasas,
          monedaBase,
        );
        nuevoPagosDetalle = [
          {
            ...pago,
            monto: Math.max(0, round2(pago.monto - montoConv)),
            equivalenteBase: Math.max(
              0,
              round2(pago.equivalenteBase - montoProductoBase),
            ),
          },
        ];
      }

      await tx.venta.update({
        where: { id: ventaId },
        data: {
          total: nuevoTotal,
          totalcash: Math.max(
            0,
            Math.round(nuevoTotal * ratioCash * 100) / 100,
          ),
          totaltransfer: Math.max(
            0,
            Math.round(nuevoTotal * ratioTransfer * 100) / 100,
          ),
          ...(nuevoPagosDetalle ? { pagosDetalle: nuevoPagosDetalle } : {}),
        },
      });
    });

    return NextResponse.json(
      { message: "Producto eliminado de la venta correctamente" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DELETE producto venta]", error);
    return NextResponse.json(
      { error: "Error al eliminar el producto de la venta" },
      { status: 500 },
    );
  }
}
