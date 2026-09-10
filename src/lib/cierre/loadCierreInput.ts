import { prisma } from "@/lib/prisma";
import { getCurrentInitialCashFundAmounts } from "@/lib/movimiento/caja";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import { netCollectionRows } from "@/lib/cuentasPorCobrar/cobrosNetos";
import type { Prisma } from "@prisma/client";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type {
  CierreComputationInput,
  CierreSale,
} from "@/lib/cierre/computeCierreTotals";

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export interface CierrePeriodoHeader {
  id: string;
  tiendaId: string;
  negocioId: string;
  monedaBase: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  totalsComputedAt: Date | null;
  /** Display name of the period. Header metadata: it computes nothing. */
  etiqueta: string | null;
}

export interface LoadedCierreInput {
  cierre: CierrePeriodoHeader;
  input: CierreComputationInput;
}

const MOVIMIENTOS_DE_CAJA = ["COMPRA", "MERMA", "DEVOLUCION_VENTA"] as const;

/**
 * The `where` that selects the accounts of a store still open at `corte`.
 *
 * THE `OR` IS NOT REDUNDANT AND MUST NOT BE SIMPLIFIED TO `settledAt: null`. An account
 * settled AFTER the cutoff was still open AT the cutoff. Dropping the second clause makes
 * every already-collected debt vanish from the recomputation of every earlier period, and
 * the historical totalPorCobrarAlCierre of all of them collapses to zero as debts get paid.
 * It passes the obvious case and looks cleaner, which is exactly why it needs this comment.
 * Criterion 9 of F-030 exists to catch it.
 */
export function openReceivablesWhere(
  tiendaId: string,
  corte: Date,
): Prisma.CuentaPorCobrarWhereInput {
  return {
    tiendaId,
    fechaVenta: { lte: corte },
    OR: [{ settledAt: null }, { settledAt: { gt: corte } }],
  };
}

/**
 * The `where` that selects the collections that entered the drawer during a period.
 *
 * ABONO and REVERSION_ABONO, and only those two: CONDONACION and AJUSTE_DEVOLUCION move no
 * physical money. F-033 is the feature that STARTED writing REVERSION_ABONO, so the reversal of
 * a collection now has to leave the drawer the same way the collection entered it (ADR 0121).
 * Widening this filter is only half the fix: `buildResumenMonedas` and `valueAbonos` only ADD,
 * so a reversal fed to them as it stands would count the money twice instead of cancelling it.
 * The other half is `netCollectionRows`, which turns each reversal into a MIRROR of the entry it
 * undoes, with the amounts negated, before either engine sees it.
 *
 * `fechaFin` null means the period is still open and has no upper bound, the same shape the
 * MovimientoStock query uses.
 */
export function periodCollectionsWhere(
  tiendaId: string,
  fechaInicio: Date,
  fechaFin: Date | null,
): Prisma.MovimientoCuentaPorCobrarWhereInput {
  return {
    tipo: { in: ["ABONO", "REVERSION_ABONO"] },
    cuentaPorCobrar: { tiendaId },
    fecha: { gte: fechaInicio, ...(fechaFin && { lte: fechaFin }) },
  };
}

/**
 * Gathers, for one period, every row `computeCierreTotals` needs. The only
 * place that decides which sales, expenses and movements belong to a period,
 * so closing, recalculating and reading it cannot draw different boundaries.
 *
 * `fechaFinOverride` is the closing instant while closing: the period has no
 * fechaFin yet and the movements need an upper bound.
 */
export async function loadCierreComputationInput(
  cierreId: string,
  negocioId: string,
  options: { fechaFinOverride?: Date; client?: PrismaLike } = {},
): Promise<LoadedCierreInput | null> {
  const client = options.client ?? prisma;

  const cierre = await client.cierrePeriodo.findFirst({
    where: { id: cierreId, tienda: { negocioId } },
    select: {
      id: true,
      tiendaId: true,
      fechaInicio: true,
      fechaFin: true,
      totalsComputedAt: true,
      etiqueta: true,
      tienda: {
        select: { negocio: { select: { id: true, monedaBase: true } } },
      },
      ventas: {
        select: {
          id: true,
          createdAt: true,
          total: true,
          discountTotal: true,
          tipTotal: true,
          totaltransfer: true,
          creditoBase: true,
          tasaSnapshot: true,
          pagosDetalle: true,
          vueltoDetalle: true,
          tipDetail: true,
          usuario: { select: { id: true, nombre: true } },
          transferDestination: { select: { id: true, nombre: true } },
          appliedDiscounts: {
            select: { amount: true, productsAffected: true },
          },
          productos: {
            select: {
              cantidad: true,
              costo: true,
              precio: true,
              monedaCostoCode: true,
              monedaPrecioCode: true,
              producto: {
                select: {
                  id: true,
                  productoId: true,
                  existencia: true,
                  producto: { select: { nombre: true } },
                  proveedor: { select: { id: true, nombre: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!cierre) return null;

  const monedaBase = cierre.tienda.negocio.monedaBase ?? "CUP";
  const fechaFin = cierre.fechaFin ?? options.fechaFinOverride ?? null;
  // The instant the receivables are measured against: the closing instant of a closed
  // period, now while it is still open. Same rule fechaFinOverride already applies to the
  // stock movements.
  const corte = fechaFin ?? new Date();

  const [
    gastos,
    movimientos,
    initialFundAmounts,
    historialTasas,
    abonos,
    cuentasPorCobrar,
    transferDestinations,
  ] = await Promise.all([
    client.gastoCierre.findMany({
      where: { cierreId },
      select: {
        id: true,
        nombre: true,
        tipoCalculo: true,
        montoCalculado: true,
        monedaCode: true,
        naturaleza: true,
        esAdHoc: true,
      },
    }),
    client.movimientoStock.findMany({
      where: {
        tiendaId: cierre.tiendaId,
        tipo: { in: [...MOVIMIENTOS_DE_CAJA] },
        fecha: {
          gte: cierre.fechaInicio,
          ...(fechaFin && { lte: fechaFin }),
        },
      },
      select: {
        id: true,
        tipo: true,
        formaPago: true,
        costoTotal: true,
        montoReembolso: true,
        monedaOriginal: true,
        montoOriginal: true,
        montoEfectivoCaja: true,
        montoAplicadoADeuda: true,
        motivo: true,
        productoTienda: {
          select: { producto: { select: { nombre: true } } },
        },
      },
      orderBy: { fecha: "desc" },
    }),
    getCurrentInitialCashFundAmounts(cierreId, client),
    loadTasaHistory(negocioId, client),
    // Two DIFFERENT questions, and they are not answered by one query: "what entered the
    // drawer during this period" (bounded at both ends) and "how much is owed at this
    // instant" (accumulated from the beginning up to the cutoff).
    client.movimientoCuentaPorCobrar.findMany({
      where: periodCollectionsWhere(
        cierre.tiendaId,
        cierre.fechaInicio,
        fechaFin,
      ),
      select: {
        id: true,
        tipo: true,
        fecha: true,
        tasaSnapshot: true,
        pagosDetalle: true,
        // The reversed entry travels along so `netCollectionRows` can build its mirror with the
        // ORIGIN's payment lines and the ORIGIN's rates (ADR 0121).
        revierte: { select: { pagosDetalle: true, tasaSnapshot: true } },
      },
      orderBy: { fecha: "asc" },
    }),
    client.cuentaPorCobrar.findMany({
      where: openReceivablesWhere(cierre.tiendaId, corte),
      select: {
        id: true,
        clienteId: true,
        fechaVenta: true,
        montoOriginal: true,
        cliente: { select: { nombre: true } },
        // Cut off here, not in computeSaldoAlCierre: that function reads the set it is
        // given and does no date filtering of its own (F-029 contract § 5.1).
        movimientos: {
          where: { fecha: { lte: corte } },
          select: { tipo: true, monto: true },
        },
      },
    }),
    client.transferDestinations.findMany({
      where: { tiendaId: cierre.tiendaId },
      select: { id: true, nombre: true },
    }),
  ]);

  const ventas: CierreSale[] = cierre.ventas.map((v) => ({
    id: v.id,
    createdAt: v.createdAt,
    total: v.total,
    discountTotal: Number(v.discountTotal ?? 0),
    tipTotal: Number(v.tipTotal ?? 0),
    totaltransfer: v.totaltransfer,
    creditoBase: Number(v.creditoBase ?? 0),
    tasaSnapshot: (v.tasaSnapshot as ITasaSnapshot | null) ?? null,
    pagosDetalle: (v.pagosDetalle as IPagoLinea[] | null) ?? null,
    vueltoDetalle: (v.vueltoDetalle as IVueltoLinea[] | null) ?? null,
    tipDetail: (v.tipDetail as IPagoLinea[] | null) ?? null,
    usuario: v.usuario,
    transferDestination: v.transferDestination,
    appliedDiscounts: v.appliedDiscounts,
    productos: v.productos.map((p) => ({
      productoTiendaId: p.producto.id,
      productoId: p.producto.productoId,
      nombre: p.producto.producto.nombre,
      cantidad: p.cantidad,
      costo: p.costo,
      precio: p.precio,
      monedaCostoCode: p.monedaCostoCode,
      monedaPrecioCode: p.monedaPrecioCode,
      proveedor: p.producto.proveedor,
      existencia: p.producto.existencia,
    })),
  }));

  return {
    cierre: {
      id: cierre.id,
      tiendaId: cierre.tiendaId,
      negocioId: cierre.tienda.negocio.id,
      monedaBase,
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin,
      totalsComputedAt: cierre.totalsComputedAt,
      etiqueta: cierre.etiqueta,
    },
    input: {
      monedaBase,
      fechaFin,
      historialTasas,
      ventas,
      gastos,
      movimientos: movimientos.map((m) => ({
        ...m,
        productoNombre: m.productoTienda?.producto?.nombre ?? "Producto",
      })),
      initialFundAmounts,
      // Same cast pattern the sale above already uses: these are Json columns and Prisma
      // types them as JsonValue. A REVERSION_ABONO comes out of `netCollectionRows` as the
      // mirror of the collection it undoes, so `valueAbonos` SUBTRACTS it without changing a
      // line of its own (ADR 0121).
      abonos: netCollectionRows(
        abonos.map((a) => ({
          id: a.id,
          tipo: a.tipo as "ABONO" | "REVERSION_ABONO",
          fecha: a.fecha,
          tasaSnapshot: (a.tasaSnapshot as ITasaSnapshot | null) ?? null,
          pagosDetalle: (a.pagosDetalle as IPagoLinea[] | null) ?? null,
          revierte: a.revierte
            ? {
                pagosDetalle:
                  (a.revierte.pagosDetalle as IPagoLinea[] | null) ?? null,
                tasaSnapshot:
                  (a.revierte.tasaSnapshot as ITasaSnapshot | null) ?? null,
              }
            : null,
        })),
      ),
      cuentasPorCobrar: cuentasPorCobrar.map((c) => ({
        id: c.id,
        clienteId: c.clienteId,
        clienteNombre: c.cliente?.nombre ?? null,
        fechaVenta: c.fechaVenta,
        montoOriginal: c.montoOriginal,
        movimientos: c.movimientos,
      })),
      transferDestinations,
    },
  };
}
