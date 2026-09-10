import { convertToBase } from "@/lib/currency";
import { SALE_TOTAL_TOLERANCE_BASE } from "@/constants/venta";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * The five ways a sale can break the credit invariant, in the order they are evaluated.
 * THE ORDER IS THE CONTRACT and the first one to fire wins — same shape as
 * TENANT_SCOPE_DECISIONS in src/lib/tenantScope.ts.
 *
 * The three hard rules are checked BEFORE the arithmetic on purpose: a sale that breaks
 * one of them usually breaks the sum as well, and the caller needs the reason it can act
 * on, not "the numbers do not add up".
 */
export const CREDIT_INVARIANT_VIOLATIONS = [
  "CREDIT_WITHOUT_CUSTOMER",
  "CREDIT_WITH_CHANGE",
  "CREDIT_WITH_TIP",
  "CREDIT_EXCEEDS_TOTAL",
  "TOTAL_MISMATCH",
] as const;

export type ICreditInvariantViolation =
  (typeof CREDIT_INVARIANT_VIOLATIONS)[number];

/**
 * The HTTP status each violation gets when a sale route rejects with it. Declared here
 * so F-032 does not restate the mapping in two routes.
 *
 * CREDIT_WITHOUT_CUSTOMER is a 409 and not a 400 because `isPermanentSyncError` parks a
 * 409 instead of retrying it forever: an offline sale naming a customer that does not
 * exist has to stop, not spin.
 */
export const CREDIT_INVARIANT_HTTP_STATUS: Record<
  ICreditInvariantViolation,
  400 | 409
> = {
  CREDIT_WITHOUT_CUSTOMER: 409,
  CREDIT_WITH_CHANGE: 400,
  CREDIT_WITH_TIP: 400,
  CREDIT_EXCEEDS_TOTAL: 400,
  TOTAL_MISMATCH: 400,
};

export interface ICreditInvariantInput {
  /** The sale total the server will persist, in base currency, net of discounts. */
  total: number;
  tipTotal?: number | null;
  creditoBase?: number | null;
  clienteId?: string | null;
  pagosDetalle?: IPagoLinea[] | null;
  vueltoDetalle?: IVueltoLinea[] | null;
  tasaSnapshot?: ITasaSnapshot | null;
  monedaBase: string;
  /** Defaults to SALE_TOTAL_TOLERANCE_BASE. */
  tolerance?: number;
}

/**
 * A FLAT shape rather than a discriminated union, for the same reason
 * TipValidationResult in src/lib/tips.ts is flat: `strict` is off in this project, so a
 * boolean discriminant does not narrow (E-036). Callers read `result.violation === null`
 * or `result.ok === true`; `if (!result.ok)` does not narrow anything here.
 */
export interface ICreditInvariantResult {
  ok: boolean;
  /** null when ok. */
  violation: ICreditInvariantViolation | null;
  /** (paid - change + creditoBase) - (total + tipTotal), rounded to two decimals. */
  delta: number;
  /** The credit actually read, after coercion. */
  creditoBase: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Checks the invariant of a sale that may carry credit:
 *
 *   Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) + creditoBase = total + tipTotal
 *
 * The two sums are computed the same way validateTip already computes them: the payments
 * are read from their stored `equivalenteBase` and are NOT reconverted, and the change
 * lines, which carry no equivalenteBase, are converted with `convertToBase` against
 * `tasaSnapshot`. Same definition, one place.
 *
 * F-029 only ships this function. Calling it from the two sale routes and turning a
 * violation into a 400 or a 409 is F-032.
 */
export function checkCreditInvariant(
  input: ICreditInvariantInput,
): ICreditInvariantResult {
  const {
    total,
    tipTotal,
    creditoBase,
    clienteId,
    pagosDetalle,
    vueltoDetalle,
    tasaSnapshot,
    monedaBase,
    tolerance,
  } = input;

  const saleTotal = Number(total) || 0;
  const tip = Number(tipTotal) || 0;
  // Not normalized against negatives on purpose: -50 is truthy, so it survives the
  // coercion and surfaces as TOTAL_MISMATCH instead of being masked. Every caller feeds
  // input that already went through multimonedaExtrasSchema or ventaSchema, where
  // .nonnegative() rejects it.
  const credit = Number(creditoBase) || 0;
  // Not `Number(tolerance) || …`: a caller that deliberately passes 0 asks for an exact
  // comparison, and `|| …` would silently give it back the default cent.
  const limit = Number.isFinite(tolerance)
    ? Number(tolerance)
    : SALE_TOTAL_TOLERANCE_BASE;

  const tasas = tasaSnapshot ?? {};
  const paid = (pagosDetalle ?? []).reduce(
    (sum, pago) => sum + (Number(pago?.equivalenteBase) || 0),
    0,
  );
  const changeLines = vueltoDetalle ?? [];
  const changeBase = changeLines.reduce(
    (sum, vuelto) =>
      sum +
      convertToBase(Number(vuelto?.monto) || 0, vuelto?.moneda, tasas, monedaBase),
    0,
  );
  // The raw sum of the change lines, in whatever currency each was handed back: change
  // is change in the currency it was given.
  const changeRaw = changeLines.reduce(
    (sum, vuelto) => sum + (Number(vuelto?.monto) || 0),
    0,
  );

  const delta = round2(paid - changeBase + credit - (saleTotal + tip));

  const reject = (
    violation: ICreditInvariantViolation,
  ): ICreditInvariantResult => ({
    ok: false,
    violation,
    delta,
    creditoBase: credit,
  });

  if (credit > 0 && !clienteId) return reject("CREDIT_WITHOUT_CUSTOMER");
  if (credit > 0 && changeRaw > 0) return reject("CREDIT_WITH_CHANGE");
  if (credit > 0 && tip > 0) return reject("CREDIT_WITH_TIP");
  if (credit > saleTotal + limit) return reject("CREDIT_EXCEEDS_TOTAL");
  if (Math.abs(delta) > limit) return reject("TOTAL_MISMATCH");

  return { ok: true, violation: null, delta, creditoBase: credit };
}
