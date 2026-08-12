import { prisma } from "@/lib/prisma";
import type { IDateRange } from "@/schemas/reports/common";

export type ClosingDeductions = {
  totalGastos: number;
  totalMerma: number;
  totalDevoluciones: number;
};

/**
 * Deductions denormalized on the closings of a range, in base currency.
 *
 * These come from `CierrePeriodo` rather than being recomputed, so the
 * dashboard always agrees with what was recorded when the period was closed.
 */
export async function loadClosingDeductions(
  tiendaId: string,
  range: IDateRange,
): Promise<ClosingDeductions> {
  const aggregated = await prisma.cierrePeriodo.aggregate({
    _sum: { totalGastos: true, totalMerma: true, totalDevoluciones: true },
    where: {
      tiendaId,
      fechaInicio: { gte: range.from },
      fechaFin: { lte: range.to },
    },
  });

  return {
    totalGastos: aggregated._sum.totalGastos ?? 0,
    totalMerma: aggregated._sum.totalMerma ?? 0,
    totalDevoluciones: aggregated._sum.totalDevoluciones ?? 0,
  };
}
