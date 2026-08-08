/**
 * Suggested cash amounts for a payment line.
 *
 * The exact amount is derived from the currency's smallest denomination —
 * a cashier cannot receive less than one bill. The suggestions, however,
 * are derived from the *magnitude* of the amount rather than from the
 * denominations: CUP circulates a 3-unit bill, and rounding up to a
 * multiple of 3 yields absurd suggestions such as 1002. Magnitude steps
 * always produce amounts a customer actually hands over.
 */

const MAX_SUGGESTIONS = 3;

/** Smallest step that is worth suggesting, relative to the smallest bill. */
const STEP_FLOOR_FACTOR = 5;

/**
 * Suggestions can never be finer-grained than the bills in circulation, so
 * below this many minimum bills the scale comes from the denominations
 * rather than from the amount. Without it, a 4 USD total (minimum bill 1)
 * derives a magnitude of 1, whose steps are all filtered out by
 * STEP_FLOOR_FACTOR, leaving a single suggestion instead of 5 · 10 · 20.
 */
const MAGNITUDE_FLOOR_FACTOR = 10;

/** Rounds up to the next multiple of `step`, immune to float noise. */
export function ceilToStep(value: number, step: number): number {
  if (step <= 0) return round2(value);
  const scaled = Number((value / step).toFixed(6));
  return round2(Math.ceil(scaled) * step);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SuggestedAmounts {
  /** Smallest payable amount that covers `pending`. */
  exact: number;
  /** Round amounts strictly above `exact`, ascending, at most three. */
  suggestions: number[];
}

export function suggestedAmounts(
  pending: number,
  denominations: number[],
): SuggestedAmounts {
  if (!(pending > 0)) return { exact: 0, suggestions: [] };

  const positive = denominations.filter((d) => d > 0);
  if (positive.length === 0) {
    return { exact: round2(pending), suggestions: [] };
  }

  const minDenom = Math.min(...positive);
  const exact = ceilToStep(pending, minDenom);

  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(Math.max(exact, minDenom * MAGNITUDE_FLOOR_FACTOR))),
  );
  const steps = [
    magnitude / 10,
    magnitude / 2,
    magnitude,
    magnitude * 2,
    magnitude * 5,
  ].filter((step) => step >= minDenom * STEP_FLOOR_FACTOR);

  const candidates = steps.map((step) =>
    round2((Math.floor(round2(exact) / step) + 1) * step),
  );

  const suggestions = Array.from(new Set(candidates))
    .filter((amount) => amount > exact)
    .sort((a, b) => a - b)
    .slice(0, MAX_SUGGESTIONS);

  return { exact, suggestions };
}
