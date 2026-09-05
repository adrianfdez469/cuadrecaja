import type { Prisma } from "@prisma/client";
import {
  mergeLiquidaciones,
  type CierreComputation,
} from "@/lib/cierre/computeCierreTotals";

export interface PersistCierreOptions {
  /** Set while closing: the period gets its fechaFin in the same write. */
  fechaFin?: Date;
}

export interface PersistCierreResult {
  /** Settlements already paid to a supplier that the write left untouched. */
  liquidacionesConservadas: number;
}

/**
 * Writes a computation as the figures of the period. Idempotent on purpose:
 * running it twice on the same period leaves exactly one set of per-currency
 * rows and one set of settlements, which the previous `createMany` with
 * `skipDuplicates` did not guarantee (a second close kept the first summary
 * under the new totals). Must run inside the caller's transaction.
 */
export async function persistCierreComputation(
  tx: Prisma.TransactionClient,
  cierreId: string,
  computation: CierreComputation,
  options: PersistCierreOptions = {},
): Promise<PersistCierreResult> {
  await tx.cierrePeriodo.update({
    where: { id: cierreId },
    data: {
      ...(options.fechaFin && { fechaFin: options.fechaFin }),
      ...computation.totals,
      totalsComputedAt: new Date(),
    },
  });

  await tx.resumenMonedaCierre.deleteMany({
    where: { cierrePeriodoId: cierreId },
  });
  if (computation.resumenMonedas.length > 0) {
    await tx.resumenMonedaCierre.createMany({
      data: computation.resumenMonedas.map((r) => ({
        cierrePeriodoId: cierreId,
        ...r,
      })),
    });
  }

  const existing = await tx.productoProveedorLiquidacion.findMany({
    where: { cierreId },
    select: { proveedorId: true, productoId: true, liquidatedAt: true },
  });
  const { toCreate, kept } = mergeLiquidaciones(
    existing,
    computation.liquidaciones,
  );
  await tx.productoProveedorLiquidacion.deleteMany({
    where: { cierreId, liquidatedAt: null },
  });
  if (toCreate.length > 0) {
    await tx.productoProveedorLiquidacion.createMany({
      data: toCreate.map((l) => ({ ...l, cierreId, liquidatedAt: null })),
    });
  }

  return { liquidacionesConservadas: kept.length };
}
