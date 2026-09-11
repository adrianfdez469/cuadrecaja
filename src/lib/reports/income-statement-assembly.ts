import { calcularGananciaFinal } from "@/lib/gastos";
import type { SalesSummary } from "./aggregators/summary";
import type { ClosingDeductions } from "./closing-totals";

export type ExpenseLine = {
  categoria: string;
  naturaleza: "OPERATIVO" | "INVERSION";
  monto: number;
  cantidad: number;
};

export type IncomeStatement = {
  ventasBrutas: number;
  descuentos: number;
  ventasNetas: number;
  costoMercanciaVendida: number;
  margenBruto: number;
  margenBrutoPorcentaje: number;
  /** OPERATIVO only — the closing's own definition of what reduces profit. */
  gastosOperativos: number;
  gastosPorCategoria: ExpenseLine[];
  /** INVERSION expenses: they consume cash but never reduce profit. */
  gastosInversion: number;
  inversionPorCategoria: ExpenseLine[];
  merma: number;
  devoluciones: number;
  gananciaFinal: number;
  /**
   * Informative. Sum of `CierrePeriodo.totalCreditoOtorgado` over the range's closings:
   * merchandise handed over whose money did not enter the drawer. OUTSIDE every subtotal
   * and outside `gananciaFinal` — profit is accrued (product decision 2 of the epic
   * dossier), so the margin of a credit sale is already inside `margenBruto`.
   */
  creditoOtorgado: number;
  /**
   * Informative. Sum of `CierrePeriodo.totalCobrosCredito`: debt collected during the
   * range, whatever period it was born in. OUTSIDE every subtotal. It CAN be negative
   * (ADR 0121).
   */
  creditoCobrado: number;
  /** Non-zero only if the category breakdown fails to reconcile with the closings. */
  ajusteConciliacion: number;
};

export type IncomeStatementAssemblyInput = {
  summary: SalesSummary;
  deductions: ClosingDeductions;
  /** Unsorted; this function sorts them by amount, descending. */
  gastosPorCategoria: ExpenseLine[];
  inversionPorCategoria: ExpenseLine[];
  gastosInversion: number;
  /** The operating expenses the per-category breakdown adds up to. */
  breakdownOperativo: number;
};

/**
 * Assembles the statement out of figures already loaded. Pure: no database, no clock,
 * no rates.
 *
 * `gananciaFinal` comes from ONE call to `calcularGananciaFinal`, whose four arguments
 * are `margenBruto`, `gastosOperativos`, `deductions.totalMerma` and
 * `deductions.totalDevoluciones`. `deductions.credito` is copied straight through to the
 * two informative fields and reaches nothing else.
 */
export function assembleIncomeStatement(
  input: IncomeStatementAssemblyInput,
): IncomeStatement {
  const {
    summary,
    deductions,
    gastosPorCategoria,
    inversionPorCategoria,
    gastosInversion,
    breakdownOperativo,
  } = input;

  const ventasBrutas = summary.totalBruto;
  const descuentos = summary.totalDescuentos;
  const ventasNetas = summary.totalPeriodo;
  const costoMercanciaVendida = summary.costoMercanciaVendida;
  const margenBruto = summary.gananciaTotal;

  const gastosOperativos = deductions.totalGastos;
  const gananciaFinal = calcularGananciaFinal(
    margenBruto,
    gastosOperativos,
    deductions.totalMerma,
    deductions.totalDevoluciones,
  );

  const ajusteConciliacion = gastosOperativos - breakdownOperativo;

  return {
    ventasBrutas,
    descuentos,
    ventasNetas,
    costoMercanciaVendida,
    margenBruto,
    margenBrutoPorcentaje:
      ventasNetas > 0 ? (margenBruto / ventasNetas) * 100 : 0,
    gastosOperativos,
    gastosPorCategoria: [...gastosPorCategoria].sort(
      (a, b) => b.monto - a.monto,
    ),
    gastosInversion,
    inversionPorCategoria: [...inversionPorCategoria].sort(
      (a, b) => b.monto - a.monto,
    ),
    merma: deductions.totalMerma,
    devoluciones: deductions.totalDevoluciones,
    gananciaFinal,
    creditoOtorgado: deductions.credito.otorgado,
    creditoCobrado: deductions.credito.cobrado,
    ajusteConciliacion:
      Math.abs(ajusteConciliacion) > 0.01 ? ajusteConciliacion : 0,
  };
}
