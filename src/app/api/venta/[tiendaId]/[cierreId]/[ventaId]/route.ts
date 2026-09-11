import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { MovimientoTipo } from "@prisma/client";
import { lockExistingRow } from "@/lib/dbLocks";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { summarizeVentaCobros } from "@/lib/cuentasPorCobrar/ventaCreditoEstado";
import {
  evaluateVentaDeleteGuard,
  VENTA_DELETE_BLOCK_HTTP_STATUS,
  VENTA_DELETE_BLOCK_TEXT,
  type IVentaDeleteBlockReason,
} from "@/lib/cuentasPorCobrar/ventaDeleteGuard";
import type { IVentaDeleteBloqueadaResponse } from "@/schemas/ventaCredito";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";

/** What the transaction hands back when the sale refuses to be deleted. */
type VentaBloqueada = {
  reason: IVentaDeleteBlockReason;
  cobros: number;
  cobrosMontoBase: number;
};

/**
 * The body of the refusal, built in ONE place from VENTA_DELETE_BLOCK_TEXT: criterion 6 measures
 * the count and the amount as VALUES, not a category (E-016), and the message names both.
 */
function bloqueadaResponse(
  blocked: VentaBloqueada,
  monedaBase: string,
): NextResponse<IVentaDeleteBloqueadaResponse> {
  const error =
    blocked.reason === "CREDITO_CON_COBROS"
      ? VENTA_DELETE_BLOCK_TEXT.creditoConCobros(
          blocked.cobros,
          blocked.cobrosMontoBase,
          monedaBase,
        )
      : VENTA_DELETE_BLOCK_TEXT.creditoConMovimientos();

  return NextResponse.json(
    {
      error,
      reason: blocked.reason,
      cobros: blocked.cobros,
      cobrosMontoBase: blocked.cobrosMontoBase,
    },
    { status: VENTA_DELETE_BLOCK_HTTP_STATUS[blocked.reason] },
  );
}

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

    // La tienda debe pertenecer al negocio del usuario autenticado — sin este
    // filtro, `ventaId` es un UUID adivinable que deja borrar ventas de
    // CUALQUIER negocio, no solo el propio.
    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      // The business's base currency, needed to word the 409: the debt is denominated in base
      // currency. Same shape as api/movimiento/[tiendaId]/caja-resumen.
      select: { id: true, negocio: { select: { monedaBase: true } } },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    // Revisamos si la venta pertenece a un período abierto
    const venta = await prisma.venta.findFirst({
      where: { id: ventaId, tiendaId },
      include: {
        cierrePeriodo: {
          select: {
            fechaFin: true,
          },
        },
        // The debt of this sale, reached ONLY through the Venta already scoped by tienda and
        // negocioId — never by a cuentaId coming from the request.
        cuentaPorCobrar: {
          select: { id: true, movimientos: { select: { tipo: true, monto: true } } },
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
        { error: "La venta pertenece a un período cerrado" },
        { status: 400 },
      );
    }

    const monedaBase = tienda.negocio?.monedaBase ?? DEFAULT_CURRENCY;
    const cuentaId = venta.cuentaPorCobrar?.id ?? null;

    // Optional fast refusal, BEFORE opening the transaction. It does not replace the one inside
    // it: it only saves the work of reverting stock for a sale that is not going anywhere.
    if (cuentaId) {
      const resumenPrevio = summarizeVentaCobros(
        venta.cuentaPorCobrar.movimientos,
      );
      const gatePrevio = evaluateVentaDeleteGuard({ credito: resumenPrevio });
      if (gatePrevio.venta.reason !== null) {
        return bloqueadaResponse(
          { reason: gatePrevio.venta.reason, ...resumenPrevio },
          monedaBase,
        );
      }
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

    const blocked = await prisma.$transaction<VentaBloqueada | null>(async (tx) => {
      // Before reverting anything: lock the sale and confirm it is still there.
      // Reverting stock is not idempotent, so a second execution — the network
      // retry overlapping the original, still running — would add the quantities
      // back twice. With the lock, the second one waits, finds the sale already
      // deleted and leaves without touching anything.
      if (!(await lockExistingRow(tx, "Venta", ventaId))) {
        return null;
      }

      // Re-read the ledger UNDER THE LOCK: a collection landing between the pre-check above and
      // the delete would otherwise leave money in a drawer with no sale to belong to. What
      // blocks are the collections already received, NOT the live debt (ADR 0133).
      if (cuentaId) {
        const cuenta = await tx.cuentaPorCobrar.findUnique({
          where: { id: cuentaId },
          select: { movimientos: { select: { tipo: true, monto: true } } },
        });
        const resumen = summarizeVentaCobros(cuenta?.movimientos ?? []);
        const gate = evaluateVentaDeleteGuard({ credito: resumen });
        if (gate.venta.reason !== null) {
          return { reason: gate.venta.reason, ...resumen };
        }
      }

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
            usuarioId: user.id,
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
      // Deleting the sale takes its CuentaPorCobrar with it through `onDelete: Cascade`
      // (prisma/schema.prisma), and its MovimientoCuentaPorCobrar rows with that. NO explicit
      // delete is added: what has to hold is that the deletion fires from the right side.
      await tx.venta.delete({
        where: {
          id: ventaId,
        },
      });

      return null;
    });

    if (blocked) {
      // The sale and its CuentaPorCobrar are still there: the transaction never deleted
      // anything.
      return bloqueadaResponse(blocked, monedaBase);
    }

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
