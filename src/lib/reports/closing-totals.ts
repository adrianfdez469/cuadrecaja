import { prisma } from "@/lib/prisma";
import type { IDateRange } from "@/schemas/reports/common";

/** The period's credit flow. NOT a deduction — see the field docstring below. */
export type ClosingCreditFlow = {
  /** Sum of `CierrePeriodo.totalCreditoOtorgado` over the closings of the range. */
  otorgado: number;
  /**
   * Sum of `CierrePeriodo.totalCobrosCredito` over the same closings. It CAN be
   * negative: a reversal of a collection is stored as a negative mirror (ADR 0121).
   */
  cobrado: number;
};

export type ClosingDeductions = {
  totalGastos: number;
  totalMerma: number;
  totalDevoluciones: number;
  /**
   * Carried here because it comes out of the same aggregate, and NESTED so that it
   * cannot be mistaken for one of the three deductions above: nothing under `credito`
   * ever reaches `calcularGananciaFinal`.
   */
  credito: ClosingCreditFlow;
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
    _sum: {
      totalGastos: true,
      totalMerma: true,
      totalDevoluciones: true,
      totalCreditoOtorgado: true,
      totalCobrosCredito: true,
    },
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
    credito: {
      otorgado: aggregated._sum.totalCreditoOtorgado ?? 0,
      cobrado: aggregated._sum.totalCobrosCredito ?? 0,
    },
  };
}
