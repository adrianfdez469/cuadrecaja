import type {
  ICreditColumnSums,
  ICreditFlow,
  ICreditFlowSource,
  ICurrencyCreditLines,
} from "@/schemas/cierre";

/**
 * Half a cent. Below it a credit figure is treated as absent.
 *
 * It is NOT `> 0`, which is what `PropinasCard` uses for tips, and the
 * difference is deliberate: `totalCobrosCredito` can be negative when a
 * collection of an earlier period is reversed inside this one (ADR 0121
 * builds the reversal as a negative mirror), and a period whose drawer went
 * DOWN because of a reversal is precisely a period that needs explaining.
 */
export const CREDIT_FIGURE_EPSILON = 0.005;

/** The DOM anchors the acceptance criteria are verified against. */
export const CREDIT_TEST_IDS = {
  card: "cierre-credit-card",
  totalsCell: "cierre-totals-cell",
  totalsFootnote: "cierre-totals-footnote",
  currencyGrantedLine: "cierre-credit-granted-line",
  currencyCollectedLine: "cierre-credit-collected-line",
  closeDialogNotice: "cierre-credit-close-notice",
  historyGranted: "resumen-cierre-credit-granted",
  historyCollected: "resumen-cierre-credit-collected",
} as const;

/**
 * A stored figure as a usable number: anything that is not a finite number —
 * absent, `null`, `NaN`, `Infinity` — becomes 0.
 *
 * Written as an explicit finiteness test and not as `Number(x) || 0`, which
 * reads an explicit 0 as "absent": the same thing here, and not the same thing
 * the day the default stops being 0.
 */
function toFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Whether a credit figure is far enough from zero to be worth saying. */
function isPresent(value: number): boolean {
  return Math.abs(value) > CREDIT_FIGURE_EPSILON;
}

/** Normalizes a currency code for comparison: trimmed and upper-cased. */
function normalizeCode(code: string): string {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

/**
 * Reads the two flow figures out of any cierre payload, normalized to numbers.
 *
 * A missing or non-finite figure becomes 0. It does not use `Number(x) || 0`:
 * that reads an explicit 0 as "absent", which is the same thing but stops
 * being the same thing the day the default is not 0.
 */
export function readCreditFlow(
  source: ICreditFlowSource | null | undefined,
): ICreditFlow {
  return {
    granted: toFiniteNumber(source?.totalCreditoOtorgado),
    collected: toFiniteNumber(source?.totalCobrosCredito),
  };
}

/**
 * Whether the period has anything to say about credit — the gate of
 * `CreditoCard` and of the notice in the close dialog.
 *
 * True when either figure is further from zero than CREDIT_FIGURE_EPSILON.
 */
export function hasCreditToExplain(flow: ICreditFlow): boolean {
  return isPresent(toFiniteNumber(flow?.granted)) ||
    isPresent(toFiniteNumber(flow?.collected));
}

/**
 * Whether the history table shows its two credit columns.
 *
 * Both halves of criterion 10 in one place: the session's permission AND the
 * data. `sums` are the page-level sums of the summary response, which cover
 * every period the filter matched, not only the visible page.
 *
 * Note what this does NOT promise: because `totalCobrosCredito` can be
 * negative (ADR 0121), two periods whose collections cancel out exactly would
 * leave a sum of zero with non-zero rows, and the columns would stay hidden.
 * The two sums are therefore tested separately, never added together, so that
 * only the collections axis can cancel and never the granted one —
 * `Venta.creditoBase` is `z.number().nonnegative()` (src/schemas/venta.ts:66),
 * so `sumTotalCreditoOtorgado` is 0 only when every matched period is 0.
 */
export function shouldShowCreditColumns(
  hasPermission: boolean,
  sums: ICreditColumnSums | null | undefined,
): boolean {
  if (!hasPermission) return false;
  if (!sums) return false;
  return (
    isPresent(toFiniteNumber(sums.sumTotalCreditoOtorgado)) ||
    isPresent(toFiniteNumber(sums.sumTotalCobrosCredito))
  );
}

/**
 * The two informative lines a currency row shows, or `null` when it shows none.
 *
 * Only the row of the negocio's base currency gets them: both figures are
 * denominated in base currency and the engine stores no per-currency split of
 * either, so putting a period total on a non-base row would claim a precision
 * the data does not have (ADR 0124).
 *
 * Codes are compared trimmed and upper-cased: a case mismatch between
 * `ResumenMonedaCierre.monedaCode` and `Negocio.monedaBase` would hide both
 * lines with no error at all.
 */
export function resolveCurrencyCreditLines(
  monedaCode: string,
  monedaBase: string,
  flow: ICreditFlow,
): ICurrencyCreditLines | null {
  const code = normalizeCode(monedaCode);
  const base = normalizeCode(monedaBase);
  if (!code || !base || code !== base) return null;

  const granted = toFiniteNumber(flow?.granted);
  const collected = toFiniteNumber(flow?.collected);
  if (!isPresent(granted) && !isPresent(collected)) return null;

  return {
    granted: isPresent(granted) ? granted : null,
    collected: isPresent(collected) ? collected : null,
  };
}
