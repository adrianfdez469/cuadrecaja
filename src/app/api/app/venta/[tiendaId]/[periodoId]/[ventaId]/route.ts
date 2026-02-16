import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MovimientoTipo } from '@prisma/client';
import { isMovimientoBaja } from '@/utils/tipoMovimiento';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { verificarPermisoUsuario } from '@/utils/permisos_back';

/**
 * DELETE /api/app/venta/[tiendaId]/[periodoId]/[ventaId]
 * 
 * Cancela/elimina una venta.
 * Solo funciona si el período está abierto.
 * Requiere autenticación por token y permisos.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; periodoId: string; ventaId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Verificar permisos
    if (
      !verificarPermisoUsuario(user.permisos, 'operaciones.pos-venta.cancelarventa', user.rol) &&
      !verificarPermisoUsuario(user.permisos, 'operaciones.ventas.eliminar', user.rol)
    ) {
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar ventas' },
        { status: 403 }
      );
    }

    const { tiendaId, ventaId } = await params;

    if (!tiendaId || !ventaId) {
      return NextResponse.json(
        { error: 'tiendaId y ventaId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la venta existe y está en un período abierto
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cierrePeriodo: {
          select: { fechaFin: true }
        }
      }
    });

    if (!venta) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    if (venta.cierrePeriodo?.fechaFin) {
      return NextResponse.json(
        { error: 'No se puede cancelar una venta de un período cerrado' },
        { status: 400 }
      );
    }

    // Buscar los movimientos generados por la venta
    const movimientos = await prisma.movimientoStock.findMany({
      where: { referenciaId: ventaId }
    });

    // Generar operaciones de reversión
    const operaciones = movimientos.reduce((acc: any[], mov) => {
      let tipoMov: MovimientoTipo;
      if (mov.tipo === 'VENTA' || mov.tipo === 'DESAGREGACION_BAJA') {
        tipoMov = MovimientoTipo.AJUSTE_ENTRADA;
      } else {
        tipoMov = MovimientoTipo.AJUSTE_SALIDA;
      }

      // Actualizar existencia
      acc.push(prisma.productoTienda.update({
        where: { id: mov.productoTiendaId },
        data: {
          existencia: {
            increment: isMovimientoBaja(tipoMov) ? -mov.cantidad : mov.cantidad,
          },
        }
      }));

      // Crear movimiento de ajuste
      acc.push(prisma.movimientoStock.create({
        data: {
          cantidad: mov.cantidad,
          tipo: tipoMov,
          productoTiendaId: mov.productoTiendaId,
          tiendaId: tiendaId,
          usuarioId: user.id,
          motivo: 'Cancelación de venta desde app'
        }
      }));

      return acc;
    }, []);

    // Eliminar descuentos aplicados
    operaciones.push(prisma.appliedDiscount.deleteMany({
      where: { ventaId: ventaId }
    }));

    // Eliminar productos de la venta
    operaciones.push(prisma.ventaProducto.deleteMany({
      where: { ventaId: ventaId }
    }));

    // Eliminar la venta
    operaciones.push(prisma.venta.delete({
      where: { id: ventaId }
    }));

    // Ejecutar todo en una transacción
    await prisma.$transaction(operaciones);

    return NextResponse.json({
      success: true,
      message: 'Venta cancelada correctamente'
    });

  } catch (error) {
    console.error('❌ [APP/VENTA/DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Error al cancelar la venta' },
      { status: 500 }
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
  { params }: { params: Promise<{ tiendaId: string; periodoId: string; ventaId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { ventaId } = await params;

    if (!ventaId) {
      return NextResponse.json(
        { error: 'ventaId es requerido' },
        { status: 400 }
      );
    }

    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        usuario: {
          select: { id: true, nombre: true }
        },
        productos: {
          select: {
            cantidad: true,
            id: true,
            productoTiendaId: true,
            precio: true,
            costo: true,
            producto: {
              select: {
                proveedor: {
                  select: { id: true, nombre: true }
                },
                producto: {
                  select: { nombre: true, id: true }
                },
              }
            }
          },
        },
        appliedDiscounts: {
          include: {
            discountRule: {
              select: { name: true }
            }
          }
        },
        transferDestination: {
          select: { id: true, nombre: true }
        }
      }
    });

    if (!venta) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
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
          nombre: venta.usuario.nombre
        },
        productos: venta.productos.map((p) => ({
          id: p.producto.producto.id,
          productoTiendaId: p.productoTiendaId,
          cantidad: p.cantidad,
          precio: p.precio,
          costo: p.costo,
          nombre: p.producto.proveedor
            ? `${p.producto?.producto?.nombre} - ${p.producto.proveedor.nombre}`
            : p.producto?.producto?.nombre ?? undefined,
          proveedor: p.producto.proveedor
        })),
        appliedDiscounts: (venta.appliedDiscounts || []).map((ad) => ({
          id: ad.id,
          discountRuleId: ad.discountRuleId,
          amount: ad.amount,
          ruleName: ad.discountRule?.name
        })),
        transferDestination: venta.transferDestination
      }
    });

  } catch (error) {
    console.error('❌ [APP/VENTA/GET] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener la venta' },
      { status: 500 }
    );
  }
}
