import { prisma } from "@/lib/prisma";
import { getCurrentInitialCashFundAmounts } from "@/lib/movimiento/caja";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import type { Prisma } from "@prisma/client";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type {
  CierreComputationInput,
  CierreSale,
  IDeferredSalesSummary,
} from "@/lib/cierre/computeCierreTotals";
import { summarizeDeferredSales } from "@/lib/cierre/computeCierreTotals";
import { partitionSalesByCutoff } from "@/lib/cierre/salesCutoff";

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
  /** The cut this period is prepared to be closed at, or null when there is none. */
  salesCutoffAt: Date | null;
}

export interface LoadedCierreInput {
  cierre: CierrePeriodoHeader;
  /** Only the sales the close takes: input.ventas is already the included side. */
  input: CierreComputationInput;
  /** The other side of the same partition. */
  deferred: IDeferredSalesSummary;
}

const MOVIMIENTOS_DE_CAJA = ["COMPRA", "MERMA", "DEVOLUCION_VENTA"] as const;

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
  options: {
    fechaFinOverride?: Date;
    client?: PrismaLike;
    /**
     * The clock the effective time of every sale is capped against. Passed
     * in so that a request which loads and then writes uses ONE instant for
     * both, and the count the dialog announces cannot disagree with the
     * partition the close performs (acceptance criterion 6).
     */
    now?: Date;
  } = {},
): Promise<LoadedCierreInput | null> {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();

  const cierre = await client.cierrePeriodo.findFirst({
    where: { id: cierreId, tienda: { negocioId } },
    select: {
      id: true,
      tiendaId: true,
      fechaInicio: true,
      fechaFin: true,
      totalsComputedAt: true,
      etiqueta: true,
      salesCutoffAt: true,
      tienda: {
        select: { negocio: { select: { id: true, monedaBase: true } } },
      },
      ventas: {
        select: {
          id: true,
          createdAt: true,
          // Without this line every sale falls back to createdAt, the cut goes
          // back to comparing the sync stamp, and nothing errors (E-013).
          frontendCreatedAt: true,
          total: true,
          discountTotal: true,
          tipTotal: true,
          totaltransfer: true,
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

  // Once the period is closed the relation is the truth: a sale an admin moved
  // into a closed period must count even if its createdAt is later than the cut
  // this period was closed with. Otherwise the recalculation would silently
  // drop it.
  const cutoffAt = cierre.fechaFin === null ? cierre.salesCutoffAt : null;

  // One precedence for the upper bound of the movement window, written here and
  // nowhere else. The cut wins over `fechaFinOverride` ON PURPOSE: it is what
  // makes the screen and the close see the same COMPRA. Without it the screen
  // would show a purchase made after the cut that the close is not going to
  // store, and acceptance criteria 4 and 11 would contradict each other.
  const fechaFin =
    cierre.fechaFin ?? cutoffAt ?? options.fechaFinOverride ?? null;

  const [gastos, movimientos, initialFundAmounts, historialTasas] =
    await Promise.all([
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
          motivo: true,
          productoTienda: {
            select: { producto: { select: { nombre: true } } },
          },
        },
        orderBy: { fecha: "desc" },
      }),
      getCurrentInitialCashFundAmounts(cierreId, client),
      loadTasaHistory(negocioId, client),
    ]);

  const ventas: CierreSale[] = cierre.ventas.map((v) => ({
    id: v.id,
    createdAt: v.createdAt,
    frontendCreatedAt: v.frontendCreatedAt,
    total: v.total,
    discountTotal: Number(v.discountTotal ?? 0),
    tipTotal: Number(v.tipTotal ?? 0),
    totaltransfer: v.totaltransfer,
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

  // The relation is loaded whole and split here, so the deferred summary comes
  // out of the same valuation engine as the period's own totals and the pure
  // function of acceptance criterion 12 is exercised in production.
  const { included, deferred } = partitionSalesByCutoff(ventas, cutoffAt, now);

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
      salesCutoffAt: cierre.salesCutoffAt,
    },
    deferred: summarizeDeferredSales(deferred, monedaBase, historialTasas),
    input: {
      monedaBase,
      fechaFin,
      historialTasas,
      ventas: included,
      gastos,
      movimientos: movimientos.map((m) => ({
        ...m,
        productoNombre: m.productoTienda?.producto?.nombre ?? "Producto",
      })),
      initialFundAmounts,
    },
  };
}
