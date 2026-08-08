import { prisma } from "@/lib/prisma";
import type { ProductDimension } from "./sales-stream";

export type ShrinkageProductRow = {
  storeProductId: string;
  nombre: string;
  categoryName: string;
  merma: { unidades: number; costo: number; movimientos: number };
  devoluciones: { unidades: number; perdida: number; movimientos: number };
  perdidaTotal: number;
};

export type ShrinkageReasonRow = {
  motivo: string;
  movimientos: number;
  unidades: number;
  perdida: number;
};

export type ShrinkageResult = {
  productos: ShrinkageProductRow[];
  motivos: ShrinkageReasonRow[];
  totalMerma: number;
  totalDevoluciones: number;
  perdidaTotal: number;
  /** Window actually scanned — see the note in `loadShrinkageReport`. */
  from: Date;
  to: Date;
};

const SIN_MOTIVO = "Sin motivo registrado";

/**
 * Shrinkage and refunds broken down by product and reason.
 *
 * `MovimientoStock` has no foreign key to `CierrePeriodo`, so these movements
 * cannot be scoped by closing like sales are. Scanning the raw requested range
 * would make this report disagree with the `totalMerma` the P&L takes from the
 * closings. Instead the window is narrowed to the span the included closings
 * actually cover, which is the closest equivalent the data allows.
 *
 * Valuation matches `calcularTotalesMovimientosPeriodo`: shrinkage costs its
 * `costoTotal`, a refund costs what was paid back minus the goods recovered.
 */
export async function loadShrinkageReport(
  tiendaId: string,
  dimensions: Map<string, ProductDimension>,
  window: { from: Date; to: Date },
): Promise<ShrinkageResult> {
  const movimientos = await prisma.movimientoStock.findMany({
    where: {
      tiendaId,
      tipo: { in: ["MERMA", "DEVOLUCION_VENTA"] },
      fecha: { gte: window.from, lte: window.to },
    },
    select: {
      productoTiendaId: true,
      tipo: true,
      cantidad: true,
      motivo: true,
      costoTotal: true,
      montoReembolso: true,
    },
  });

  const byProduct = new Map<string, ShrinkageProductRow>();
  const byReason = new Map<string, ShrinkageReasonRow>();
  let totalMerma = 0;
  let totalDevoluciones = 0;

  for (const movimiento of movimientos) {
    const dimension = dimensions.get(movimiento.productoTiendaId);
    let row = byProduct.get(movimiento.productoTiendaId);

    if (!row) {
      row = {
        storeProductId: movimiento.productoTiendaId,
        nombre: dimension?.displayName ?? "Producto desconocido",
        categoryName: dimension?.categoryName ?? "Sin categoría",
        merma: { unidades: 0, costo: 0, movimientos: 0 },
        devoluciones: { unidades: 0, perdida: 0, movimientos: 0 },
        perdidaTotal: 0,
      };
      byProduct.set(movimiento.productoTiendaId, row);
    }

    // Movement quantities are signed; magnitude is what matters here.
    const unidades = Math.abs(movimiento.cantidad ?? 0);
    let perdida: number;

    if (movimiento.tipo === "MERMA") {
      perdida = movimiento.costoTotal ?? 0;
      row.merma.unidades += unidades;
      row.merma.costo += perdida;
      row.merma.movimientos += 1;
      totalMerma += perdida;
    } else {
      perdida = (movimiento.montoReembolso ?? 0) - (movimiento.costoTotal ?? 0);
      row.devoluciones.unidades += unidades;
      row.devoluciones.perdida += perdida;
      row.devoluciones.movimientos += 1;
      totalDevoluciones += perdida;
    }

    row.perdidaTotal += perdida;

    const motivo = movimiento.motivo?.trim() || SIN_MOTIVO;
    const reason = byReason.get(motivo);
    if (reason) {
      reason.movimientos += 1;
      reason.unidades += unidades;
      reason.perdida += perdida;
    } else {
      byReason.set(motivo, {
        motivo,
        movimientos: 1,
        unidades,
        perdida,
      });
    }
  }

  return {
    productos: Array.from(byProduct.values()).sort(
      (a, b) => b.perdidaTotal - a.perdidaTotal,
    ),
    motivos: Array.from(byReason.values()).sort(
      (a, b) => b.perdida - a.perdida,
    ),
    totalMerma,
    totalDevoluciones,
    perdidaTotal: totalMerma + totalDevoluciones,
    from: window.from,
    to: window.to,
  };
}
