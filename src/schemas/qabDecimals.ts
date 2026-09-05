import {
  QAB_AMOUNT_DECIMALS,
  QAB_EXCHANGE_RATE_DECIMALS,
} from "@/constants/qab";

/**
 * The two decimal scales of the catalog wire, and the ONE place each is written.
 *
 * They live in `src/schemas/` and not in `src/lib/` for the same reason
 * `qabAmount.ts` does: this is pure arithmetic with no Prisma in sight, and the
 * schemas import it — the other way round would invert the layers.
 *
 * Neither helper reuses `qabAmountSchema`: that one produces a fixed-scale
 * STRING and REJECTS a value with more decimals than it allows instead of
 * rounding it. See ADR 0047.
 */

/**
 * PURE. True when `value` is finite and survives a round-trip through
 * `toFixed(decimals)` unchanged — i.e. it already has at most `decimals`
 * decimals. `hasQabScale(2.67, 2)` is true; `hasQabScale(2.675, 2)` is false.
 */
export function hasQabScale(value: number, decimals: number): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return Number(value.toFixed(decimals)) === value;
}

/**
 * PURE. The contract's price rule, and the ONE place it is written:
 * `Number(value.toFixed(QAB_AMOUNT_DECIMALS))`.
 *
 * TOTAL: a non-finite input is returned unchanged, so this function never
 * throws. Rejecting it is `qabProductPriceSchema`'s job, not this one's.
 *
 * Pinned behaviour (the contract publishes the first two):
 *   toQabPrice(2.675) === 2.67   // NOT 2.68: toFixed on the IEEE-754 double
 *   toQabPrice(2.005) === 2      // NOT 2.01: same reason, and JSON drops ".00"
 *   toQabPrice(450)   === 450
 *   toQabPrice(0.125) === 0.13
 */
export function toQabPrice(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Number(value.toFixed(QAB_AMOUNT_DECIMALS));
}

/**
 * PURE. `Number(value.toFixed(QAB_EXCHANGE_RATE_DECIMALS))`. SIX decimals,
 * because the other side stores Decimal(18,6). NEVER uses QAB_AMOUNT_DECIMALS.
 * TOTAL, exactly like `toQabPrice`.
 *
 * Pinned behaviour:
 *   toQabExchangeRate(420.1234567) === 420.123457
 *   toQabExchangeRate(420)         === 420
 */
export function toQabExchangeRate(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Number(value.toFixed(QAB_EXCHANGE_RATE_DECIMALS));
}
