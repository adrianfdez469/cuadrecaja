import { prisma } from "@/lib/prisma";
import { getCurrentInitialCashFundAmounts } from "@/lib/movimiento/caja";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
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
}

export interface LoadedCierreInput {
  cierre: CierrePeriodoHeader;
  input: CierreComputationInput;
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

  return {
    cierre: {
      id: cierre.id,
      tiendaId: cierre.tiendaId,
      negocioId: cierre.tienda.negocio.id,
      monedaBase,
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin,
      totalsComputedAt: cierre.totalsComputedAt,
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
    },
  };
}
