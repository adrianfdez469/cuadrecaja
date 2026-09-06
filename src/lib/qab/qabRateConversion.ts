import {
  QAB_AMOUNT_DECIMALS,
  QAB_EXCHANGE_RATE_DECIMALS,
} from "@/constants/qab";
import type { IQabRateSnapshot } from "@/schemas/qabRateSnapshot";

/**
 * The rate arithmetic of an incoming order.
 *
 * Scaled integers with BigInt, never `Number`: this compares against a value
 * another system computed, and a double loses exactly the cent the comparison is
 * about. `BigInt(...)` and never the literal form, because the target is ES2017
 * (E-003).
 */

/** A readable rate: non-negative, at most QAB_EXCHANGE_RATE_DECIMALS decimals. */
const QAB_RATE_PATTERN = /^\d+(\.\d{1,6})?$/;

/** A fixed-scale amount as `toAmountString` produces it, sign included. */
const QAB_AMOUNT_PATTERN = /^-?\d+\.\d{2}$/;

const RATE_SCALE = BigInt(10) ** BigInt(QAB_EXCHANGE_RATE_DECIMALS);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

/** Trimmed and upper-cased, which is how currency codes are compared on both sides. */
function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * A decimal string with at most `decimals` decimals, as an integer scaled by
 * `10 ** decimals`. The caller has already checked the shape.
 */
function toScaledInteger(value: string, decimals: number): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const padded = fraction.padEnd(decimals, "0");
  const magnitude = BigInt(`${whole}${padded}`);
  return negative ? -magnitude : magnitude;
}

/** The inverse of `toScaledInteger`, with the scale written out in full. */
function fromScaledInteger(value: bigint, decimals: number): string {
  const negative = value < ZERO;
  const magnitude = (negative ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = magnitude.slice(0, magnitude.length - decimals);
  const fraction = magnitude.slice(magnitude.length - decimals);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** The raw value of `currencyCode` in the snapshot's map, compared code by code. */
function findRawRate(
  snapshot: IQabRateSnapshot,
  normalizedCode: string,
): unknown {
  for (const [key, value] of Object.entries(snapshot.rates)) {
    if (normalizeCurrencyCode(key) === normalizedCode) return value;
  }
  return undefined;
}

/**
 * PURE. The rate of `currencyCode` in `snapshot`, scaled by
 * 10 ** QAB_EXCHANGE_RATE_DECIMALS, or `null` when it cannot be read.
 *
 * The snapshot's own `base` yields the exact unit without looking at `rates` at
 * all. Codes are compared trimmed and upper-cased on both sides.
 *
 * A rate is readable when it is a string, or a finite number, that matches
 * QAB_RATE_PATTERN once trimmed AND is strictly greater than zero. Anything else
 * — more decimals than the scale, zero, negative, an object, absent — yields
 * `null` for THAT currency and leaves the rest of the snapshot usable.
 */
export function readQabRate(
  snapshot: IQabRateSnapshot,
  currencyCode: string,
): bigint | null {
  const normalized = normalizeCurrencyCode(currencyCode);
  if (normalized.length === 0) return null;
  if (normalizeCurrencyCode(snapshot.base) === normalized) return RATE_SCALE;

  const raw = findRawRate(snapshot, normalized);

  let text: string;
  if (typeof raw === "string") {
    text = raw.trim();
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    text = String(raw).trim();
  } else {
    return null;
  }

  if (!QAB_RATE_PATTERN.test(text)) return null;

  const scaled = toScaledInteger(text, QAB_EXCHANGE_RATE_DECIMALS);
  return scaled > ZERO ? scaled : null;
}

/** HALF UP AWAY FROM ZERO: truncate toward zero, then adjust when 2*|r| >= |divisor|. */
function divideHalfUpAwayFromZero(numerator: bigint, divisor: bigint): bigint {
  const quotient = numerator / divisor;
  const remainder = numerator % divisor;
  if (remainder === ZERO) return quotient;

  const absRemainder = remainder < ZERO ? -remainder : remainder;
  const absDivisor = divisor < ZERO ? -divisor : divisor;
  if (absRemainder * TWO < absDivisor) return quotient;

  const negative = numerator < ZERO !== divisor < ZERO;
  return negative ? quotient - ONE : quotient + ONE;
}

/**
 * PURE. `amount` expressed in `toCurrencyCode`, as a fixed-scale string of
 * QAB_AMOUNT_DECIMALS decimals, or `null` when either rate is unreadable.
 *
 * `amount` must already be a fixed-scale string of QAB_AMOUNT_DECIMALS decimals
 * — what `toAmountString` produces.
 *
 * When both codes are the same once trimmed and upper-cased, it returns `amount`
 * unchanged without reading `rates`.
 *
 * Otherwise: `round(cents * rateFrom / rateTo)`, where `round` is HALF UP AWAY
 * FROM ZERO — truncate toward zero, then adjust by one when
 * `2 * |remainder| >= |divisor|`.
 *
 * Pinned behaviour, with base "CUP" and rates { "USD": "440.000000" }:
 *
 *   convert("10.00", "USD" -> "CUP")   === "4400.00"
 *   convert("4400.00", "CUP" -> "USD") === "10.00"
 *   convert("1.00", "USD" -> "USD")    === "1.00"
 *   convert("1.00", "EUR" -> "CUP")    === null      // no rate for EUR
 */
export function convertQabAmount(params: {
  snapshot: IQabRateSnapshot;
  amount: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
}): string | null {
  const { snapshot, amount, fromCurrencyCode, toCurrencyCode } = params;

  const from = normalizeCurrencyCode(fromCurrencyCode);
  const to = normalizeCurrencyCode(toCurrencyCode);
  if (from.length === 0 || to.length === 0) return null;
  if (!QAB_AMOUNT_PATTERN.test(amount)) return null;
  // Same currency: nothing to look up and nothing to round.
  if (from === to) return amount;

  const rateFrom = readQabRate(snapshot, from);
  const rateTo = readQabRate(snapshot, to);
  if (rateFrom === null || rateTo === null) return null;

  const cents = toScaledInteger(amount, QAB_AMOUNT_DECIMALS);
  const converted = divideHalfUpAwayFromZero(cents * rateFrom, rateTo);
  return fromScaledInteger(converted, QAB_AMOUNT_DECIMALS);
}
