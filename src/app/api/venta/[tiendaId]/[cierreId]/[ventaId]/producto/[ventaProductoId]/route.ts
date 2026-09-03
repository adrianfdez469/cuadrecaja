import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { lockExistingRow } from "@/lib/dbLocks";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import {
  convertToBase,
  convertFromBase,
  pagadaConUnSoloPago,
  resolveSnapshotFromHistory,
} from "@/lib/currency";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import { recomputeAppliedDiscountsAfterRemoval } from "@/lib/discounts";
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

    // La tienda debe pertenecer al negocio del usuario autenticado — sin este
    // filtro, `ventaProductoId` es un UUID adivinable que deja borrar
    // productos de ventas de CUALQUIER negocio, no solo el propio.
    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    const ventaProducto = await prisma.ventaProducto.findUnique({
      where: { id: ventaProductoId },
      include: {
        venta: {
          include: {
            cierrePeriodo: { select: { fechaFin: true } },
            _count: { select: { productos: true } },
          },
        },
      },
    });

    if (
      !ventaProducto ||
      ventaProducto.ventaId !== ventaId ||
      ventaProducto.venta.tiendaId !== tiendaId
    ) {
      return NextResponse.json(
        { error: "Producto no encontrado en la venta" },
        { status: 404 },
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

    const monedaBase = tienda.negocio.monedaBase;
    // The sale's own snapshot, with any missing moneda (the mobile app omitted
    // the base currency for a while) filled from the rate in force at the time
    // of the sale — the adjustment below is real money, never a silent 1:1.
    const tasas = resolveSnapshotFromHistory(
      await loadTasaHistory(tienda.negocio.id),
      ventaProducto.venta.tasaSnapshot as ITasaSnapshot | null,
      ventaProducto.venta.frontendCreatedAt ?? ventaProducto.venta.createdAt,
    );
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
      // Lock the sale line and confirm it is still there before returning stock:
      // repeating the return would increment the quantity twice. The second
      // execution waits here and finds it already deleted.
      if (!(await lockExistingRow(tx, "VentaProducto", ventaProductoId))) {
        return;
      }

      // 1. Actualizar existencia del producto (devolver al inventario).
      // Se lee la existencia previa dentro de la transacción para dejarla
      // registrada en el movimiento y no romper el kardex.
      const productoTienda = await tx.productoTienda.findUnique({
        where: { id: productoTiendaId },
        select: { existencia: true },
      });
      const existenciaAnterior = productoTienda?.existencia ?? 0;

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
          existenciaAnterior,
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
          discountTotal: true,
          productos: {
            select: {
              id: true,
              productoTiendaId: true,
              cantidad: true,
              precio: true,
            },
          },
          appliedDiscounts: {
            select: {
              id: true,
              amount: true,
              productsAffected: true,
              discountRule: {
                select: {
                  type: true,
                  value: true,
                  appliesTo: true,
                  conditions: true,
                },
              },
            },
          },
        },
      });
      const totalAnterior = Number(v!.total);
      const ratioCash =
        totalAnterior > 0 ? Number(v!.totalcash) / totalAnterior : 0;
      const ratioTransfer =
        totalAnterior > 0 ? Number(v!.totaltransfer) / totalAnterior : 0;

      // 4.1 Re-cotizar los descuentos ya aplicados contra lo que queda de la
      // venta: un descuento por producto/categoría puede quedarse sin ámbito,
      // uno de ticket completo se encoge, y un `minTotal` que se cumplía puede
      // dejar de cumplirse. Nunca vuelve a seleccionar reglas por código —
      // solo re-cotiza lo que ya estaba aplicado (ver recomputeAppliedDiscountsAfterRemoval).
      const remainingProducts = v!.productos
        .filter((p) => p.id !== ventaProductoId)
        .map((p) => ({
          productoTiendaId: p.productoTiendaId,
          cantidad: p.cantidad,
          precio: p.precio ?? 0,
        }));

      const {
        discountTotal: nuevoDiscountTotal,
        updates: descuentosActualizar,
        deletes: descuentosEliminar,
      } = recomputeAppliedDiscountsAfterRemoval({
        appliedDiscounts: v!.appliedDiscounts.map((ad) => ({
          id: ad.id,
          amount: ad.amount,
          productsAffected: ad.productsAffected as
            { productoTiendaId: string; cantidad: number }[] | null,
          rule: ad.discountRule,
        })),
        remainingProducts,
        removedProductoTiendaId: productoTiendaId,
      });

      if (descuentosEliminar.length > 0) {
        await tx.appliedDiscount.deleteMany({
          where: { id: { in: descuentosEliminar } },
        });
      }
      for (const d of descuentosActualizar) {
        await tx.appliedDiscount.update({
          where: { id: d.id },
          data: { amount: d.amount, productsAffected: d.productsAffected },
        });
      }

      // Cuánto MENOS descuento se está dando ahora — 0 si el descuento
      // restante sigue cubriendo exactamente lo mismo que antes.
      const discountTotalAnterior = Number(v!.discountTotal ?? 0);
      const discountDelta = discountTotalAnterior - nuevoDiscountTotal;

      const nuevoTotal = Math.max(
        0,
        totalAnterior - montoProductoBase + discountDelta,
      );

      // 5. Restar el monto también de lo "recibido" en pagosDetalle. Se ajusta
      // por el neto: el precio del producto eliminado, menos lo que el
      // descuento dejó de cubrir (si el descuento se achicó o desapareció, el
      // total a pagar por lo que queda es más alto de lo que una resta simple
      // del precio del producto daría). Ya se validó que hay como máximo un
      // único pago, así que se ajusta directo esa línea — no hace falta
      // repartir entre varias.
      const pagosActuales = (v!.pagosDetalle ?? null) as IPagoLinea[] | null;
      let nuevoPagosDetalle: IPagoLinea[] | undefined;
      if (pagosActuales?.length === 1) {
        const pago = pagosActuales[0];
        const netoAjusteBase = montoProductoBase - discountDelta;
        const montoConv = convertFromBase(
          netoAjusteBase,
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
              round2(pago.equivalenteBase - netoAjusteBase),
            ),
          },
        ];
      }

      // `tipTotal`/`tipDetail` se dejan intactos a propósito: la propina no
      // es proporcional a los productos de la venta, es un monto que el
      // cliente decidió. Quitar un producto no reduce lo que dejó al
      // personal, y el dinero sigue físicamente en la caja.
      await tx.venta.update({
        where: { id: ventaId },
        data: {
          total: nuevoTotal,
          discountTotal: nuevoDiscountTotal,
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
