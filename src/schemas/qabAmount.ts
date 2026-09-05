import { z } from "zod";
import {
  QAB_AMOUNT_DECIMALS,
  QAB_AMOUNT_MAX_INTEGER_DIGITS,
  QAB_QUANTITY_DECIMALS,
  QAB_QUANTITY_MAX_INTEGER_DIGITS,
} from "@/constants/qab";

/**
 * The border where wire money enters cuadrecaja.
 *
 * Everything here is pure logic on purpose: it is the only part of the QAB data
 * foundations that can be covered by Vitest.
 *
 * Operating rule that survives any version of the contract:
 * amounts are compared as NUMBERS, never as strings.
 */

const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

/** Pads (or leaves) the fractional part so the result has exactly `decimals` decimals. */
function toFixedScale(value: string, decimals: number): string {
  const [integerPart, fractionalPart = ""] = value.split(".");
  return `${integerPart}.${fractionalPart.padEnd(decimals, "0")}`;
}

/** `-0`, `-0.00` and friends are not a thing: there is no negative zero. */
function stripNegativeZero(value: string): string {
  return /^-0(\.0*)?$/.test(value) ? value.slice(1) : value;
}

/**
 * Normalizes a wire decimal into a fixed-scale string, or returns null when the
 * input is not acceptable. Prisma takes the resulting string directly for a
 * Decimal column.
 */
function normalizeWireDecimal(
  input: unknown,
  decimals: number,
  pattern: RegExp,
): string | null {
  let raw: string;

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return null;
    }
    raw = input.toFixed(decimals);
    // Reject anything whose fixed-scale form is not the same number: this is the
    // divergent-rounding case the contract documents (2.675 -> "2.67"/"2.68").
    if (Number(raw) !== input) {
      return null;
    }
  } else if (typeof input === "string") {
    raw = input.trim();
  } else {
    // null, undefined, objects, booleans: rejected.
    return null;
  }

  if (!pattern.test(raw)) {
    return null;
  }

  return stripNegativeZero(toFixedScale(raw, decimals));
}

function wireDecimalSchema(
  decimals: number,
  pattern: RegExp,
  message: string,
): z.ZodType<string, unknown> {
  return z.unknown().transform((input, ctx) => {
    const normalized = normalizeWireDecimal(input, decimals, pattern);
    if (normalized === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return normalized;
  });
}

/**
 * Wire money. Accepts "880", "880.00", "880.5" or the number 880.
 * Always yields a fixed-scale string with exactly QAB_AMOUNT_DECIMALS decimals.
 * Prisma accepts this string directly for a Decimal(14, 2) column.
 */
export const qabAmountSchema: z.ZodType<string, unknown> = wireDecimalSchema(
  QAB_AMOUNT_DECIMALS,
  AMOUNT_PATTERN,
  "Invalid QAB amount",
);
export type IQabAmount = z.infer<typeof qabAmountSchema>;

/** Wire quantity. Same idea with three decimals, and never negative. */
export const qabQuantitySchema: z.ZodType<string, unknown> = wireDecimalSchema(
  QAB_QUANTITY_DECIMALS,
  QUANTITY_PATTERN,
  "Invalid QAB quantity",
);
export type IQabQuantity = z.infer<typeof qabQuantitySchema>;

/** An optional sign followed by any run of leading zeros: not significant digits. */
const SIGN_AND_LEADING_ZEROS = /^-?0*/;

/** Integer digits of an already-normalised fixed-scale decimal. Never a Number. */
function integerDigitCount(value: string): number {
  const [integerPart = ""] = value.split(".");
  return integerPart.replace(SIGN_AND_LEADING_ZEROS, "").length;
}

/**
 * PURE. Whether an already-normalised amount fits a Decimal(14, 2) column.
 *
 * `qabAmountSchema` fixes the SCALE but not the MAGNITUDE: verified by running,
 * `qabAmountSchema(1e20)` yields "100000000000000000000.00" and that literal
 * raises `numeric field overflow` in Postgres. F-001 never wrote to the database,
 * so nothing was broken there; F-010 is the feature that does the INSERT.
 *
 * Counts integer digits AFTER dropping an optional sign and any leading zeros —
 * "000880.00" has three integer digits, not six. Never parsed as a Number: past
 * 2^53 that comparison lies, which is the whole point of the check.
 */
export function fitsQabAmountColumn(value: IQabAmount): boolean {
  return integerDigitCount(value) <= QAB_AMOUNT_MAX_INTEGER_DIGITS;
}

/** PURE. Same for Decimal(14, 3), the scale of PedidoEntranteLinea.quantity. */
export function fitsQabQuantityColumn(value: IQabQuantity): boolean {
  return integerDigitCount(value) <= QAB_QUANTITY_MAX_INTEGER_DIGITS;
}
