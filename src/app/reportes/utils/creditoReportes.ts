import { CREDIT_FIGURE_EPSILON } from "@/app/cierre/utils/creditoCierre";
import { PAYMENT_MIX_CREDIT_TYPE } from "@/constants/reportes";
import type { IPaymentMixRow } from "@/schemas/reports/operationsReport";

/**
 * Adds up the base amount of every mix row of one type.
 *
 * The three KPI buckets of `/reportes/operacion` come from here and not from three
 * inline `filter().reduce()` chains in the page: a `.tsx` symbol is not importable
 * from a test (E-015).
 */
export function sumMixByType(mix: IPaymentMixRow[], tipo: string): number {
  return mix.reduce(
    (acc, row) => (row.tipo === tipo ? acc + row.montoBase : acc),
    0,
  );
}

/** Shorthand for `sumMixByType(mix, PAYMENT_MIX_CREDIT_TYPE)`. */
export function sumMixCredit(mix: IPaymentMixRow[]): number {
  return sumMixByType(mix, PAYMENT_MIX_CREDIT_TYPE);
}

/**
 * A row's share of the mix, in percentage points, over the SAME denominator the
 * table's `participacionPorcentaje` uses — credit included. Returns 0 when the
 * denominator is not positive.
 */
export function mixSharePercent(
  amountBase: number,
  totalBase: number,
): number {
  return totalBase > 0 ? (amountBase / totalBase) * 100 : 0;
}

/**
 * Whether the period has credit worth showing on `/reportes/operacion`.
 *
 * It gates THREE things, not one: the credit KPI card, the note of the "Total cobrado"
 * card, and the footnote under the mix table. All three appear and disappear together,
 * because all three exist to explain the same fact.
 *
 * The threshold is imported, not restated: `CREDIT_FIGURE_EPSILON` is half a cent and
 * is already defined once for this epic (E-014, E-039). `creditoCierre.ts` imports only
 * types, so pulling this constant pulls no runtime code.
 *
 * Written WITHOUT `Math.abs`, unlike `hasIncomeStatementCredit`: `Venta.creditoBase`
 * is non-negative, so a guard that allowed for a negative would be a branch nobody
 * ever exercises (contract § 1, E-032).
 */
export function hasCreditKpi(creditoBase: number): boolean {
  return creditoBase > CREDIT_FIGURE_EPSILON;
}

/**
 * Whether the income statement shows its two informative lines: when either figure is
 * further from zero than CREDIT_FIGURE_EPSILON. `cobrado` is compared in absolute value
 * because a reversal makes it negative (ADR 0121), and a period whose drawer went DOWN
 * is precisely one that needs explaining.
 */
export function hasIncomeStatementCredit(
  otorgado: number,
  cobrado: number,
): boolean {
  return (
    Math.abs(otorgado) > CREDIT_FIGURE_EPSILON ||
    Math.abs(cobrado) > CREDIT_FIGURE_EPSILON
  );
}
