import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { lockExistingRow } from "@/lib/dbLocks";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { verificarPermisosUsuario } from "@/utils/permisos_back";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";
import { mapMultimonedaFields } from "@/lib/ventaMapper";

/**
 * DELETE /api/app/venta/[tiendaId]/[periodoId]/[ventaId]
 *
 * Cancela/elimina una venta.
 * Solo funciona si el período está abierto.
 * Requiere autenticación por token y permisos.
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ tiendaId: string; periodoId: string; ventaId: string }>;
  },
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user;

    // The same either/or this verb already demanded, evaluated in ONE place with the plural
    // helper (`requiereTodos: false`) instead of being rewritten as a disjunction of two guards.
    if (
      !verificarPermisosUsuario(
        user.permisos,
        ["operaciones.pos-venta.cancelarventa", "operaciones.ventas.eliminar"],
        user.rol,
        false,
      )
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para cancelar ventas" },
        { status: 403 },
      );
    }

    const { tiendaId, ventaId } = await params;

    if (!ventaId) {
      return NextResponse.json(
        { error: "tiendaId y ventaId son requeridos" },
        { status: 400 },
      );
    }

    // F-021: the permission is already resolved above, so the gate only adds the tenant axis.
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    // Verificar que la venta existe y está en un período abierto. The `tiendaId` of the path now
    // enters the `where`: it used to be read and discarded.
    const venta = await prisma.venta.findFirst({
      where: withTenantScope(
        "venta",
        { id: ventaId, tiendaId },
        scope.negocioId,
      ),
      include: {
        cierrePeriodo: {
          select: { fechaFin: true },
        },
      },
    });

    if (!venta) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 },
      );
    }

    if (venta.cierrePeriodo?.fechaFin) {
      return NextResponse.json(
        { error: "No se puede cancelar una venta de un período cerrado" },
        { status: 400 },
      );
    }

    // Buscar los movimientos generados por la venta
    const movimientos = await prisma.movimientoStock.findMany({
      where: { referenciaId: ventaId },
    });

    // Ejecutar la reversión completa en una transacción
    await prisma.$transaction(async (tx) => {
      // Lock the sale and confirm it is still there before reverting stock:
      // repeating the reversal would add the quantities back twice. See
      // lockExistingRow.
      if (!(await lockExistingRow(tx, "Venta", ventaId))) {
        return;
      }

      // Existencia resultante por productoTienda: una misma venta puede generar
      // varios movimientos sobre el mismo producto (VENTA + DESAGREGACION_*),
      // así que la existencia anterior de cada ajuste es el resultado del ajuste
      // previo, no la que hay en base al inicio.
      const existenciasEncadenadas = new Map<string, number>();

      for (const mov of movimientos) {
        const tipoMov: MovimientoTipo =
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

        // Actualizar existencia
        await tx.productoTienda.update({
          where: { id: mov.productoTiendaId },
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

        // Crear movimiento de ajuste
        await tx.movimientoStock.create({
          data: {
            cantidad: mov.cantidad,
            tipo: tipoMov,
            productoTiendaId: mov.productoTiendaId,
            tiendaId: tiendaId,
            usuarioId: user.id,
            referenciaId: ventaId,
            existenciaAnterior,
            motivo: "Cancelación de venta desde app",
          },
        });
      }

      // Eliminar descuentos aplicados
      await tx.appliedDiscount.deleteMany({
        where: { ventaId: ventaId },
      });

      // Eliminar productos de la venta
      await tx.ventaProducto.deleteMany({
        where: { ventaId: ventaId },
      });

      // Eliminar la venta
      await tx.venta.delete({
        where: { id: ventaId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Venta cancelada correctamente",
    });
  } catch (error) {
    console.error("❌ [APP/VENTA/DELETE] Error:", error);
    return NextResponse.json(
      { error: "Error al cancelar la venta" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/app/venta/[tiendaId]/[periodoId]/[ventaId]
 *
 * Obtiene los detalles de una venta específica.
 * Requiere autenticación por token.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ tiendaId: string; periodoId: string; ventaId: string }>;
  },
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId, ventaId } = await params;

    if (!ventaId) {
      return NextResponse.json(
        { error: "ventaId es requerido" },
        { status: 400 },
      );
    }

    // F-021: no permission — this verb never demanded one (ADR 0078).
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const venta = await prisma.venta.findFirst({
      where: withTenantScope(
        "venta",
        { id: ventaId, tiendaId },
        scope.negocioId,
      ),
      include: {
        usuario: {
          select: { id: true, nombre: true },
        },
        productos: {
          select: {
            cantidad: true,
            id: true,
            productoTiendaId: true,
            precio: true,
            costo: true,
            monedaPrecioCode: true,
            producto: {
              select: {
                proveedor: {
                  select: { id: true, nombre: true },
                },
                producto: {
                  select: { nombre: true, id: true },
                },
              },
            },
          },
        },
        appliedDiscounts: {
          include: {
            discountRule: {
              select: { name: true },
            },
          },
        },
        transferDestination: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!venta) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      venta: {
        id: venta.id,
        createdAt: venta.createdAt,
        total: venta.total,
        totalcash: venta.totalcash,
        totaltransfer: venta.totaltransfer,
        discountTotal: Number(venta.discountTotal ?? 0),
        tiendaId: venta.tiendaId,
        usuarioId: venta.usuarioId,
        cierrePeriodoId: venta.cierrePeriodoId,
        syncId: venta.syncId,
        wasOffline: venta.wasOffline,
        usuario: {
          id: venta.usuario.id,
          nombre: venta.usuario.nombre,
        },
        productos: venta.productos.map((p) => ({
          id: p.producto.producto.id,
          productoTiendaId: p.productoTiendaId,
          cantidad: p.cantidad,
          precio: p.precio,
          costo: p.costo,
          monedaPrecioCode: p.monedaPrecioCode ?? undefined,
          nombre: p.producto.proveedor
            ? `${p.producto?.producto?.nombre} - ${p.producto.proveedor.nombre}`
            : (p.producto?.producto?.nombre ?? undefined),
          proveedor: p.producto.proveedor,
        })),
        ...mapMultimonedaFields(venta),
        appliedDiscounts: (venta.appliedDiscounts || []).map((ad) => ({
          id: ad.id,
          discountRuleId: ad.discountRuleId,
          amount: ad.amount,
          ruleName: ad.discountRule?.name,
        })),
        transferDestination: venta.transferDestination,
      },
    });
  } catch (error) {
    console.error("❌ [APP/VENTA/GET] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener la venta" },
      { status: 500 },
    );
  }
}
