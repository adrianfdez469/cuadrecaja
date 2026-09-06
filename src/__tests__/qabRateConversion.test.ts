import { describe, it, expect } from "vitest";
import {
  readQabRate,
  convertQabAmount,
} from "@/lib/qab/qabRateConversion";
import type { IQabRateSnapshot } from "@/schemas/qabRateSnapshot";

/**
 * F-011 — `src/lib/qab/qabRateConversion.ts` (contract § 5, ADR 0060). Acceptance
 * criterion 6: recomputing `unitPrice` from `rateSnapshot` must give "the same cent".
 *
 * Every expected BigInt below is built with `BigInt("...")`, never the `880n` literal
 * form — this repo's tsconfig targets ES2017, and the literal suffix does not compile
 * (E-003).
 *
 * The pinned examples are the contract's own (§5): with
 * `{ base: "CUP", rates: { USD: "440.000000" } }`,
 *   convert("10.00", USD -> CUP)  === "4400.00"
 *   convert("4400.00", CUP -> USD) === "10.00"
 *   convert("1.00", USD -> USD)   === "1.00"      (same code, `rates` never read)
 *   convert("1.00", EUR -> CUP)   === null        (no rate for EUR)
 */

const SNAPSHOT: IQabRateSnapshot = {
  base: "CUP",
  capturedAt: "2026-08-26T02:00:00.000Z",
  rates: { USD: "440.000000" },
};

describe("readQabRate", () => {
  it("should read the base currency as an exact unit, without looking at `rates`", () => {
    // Deliberately absent from `rates`, to prove the base short-circuits it.
    const snapshot: IQabRateSnapshot = { base: "CUP", rates: {} };

    expect(readQabRate(snapshot, "CUP")).toBe(BigInt("1000000"));
  });

  it("should compare currency codes trimmed and upper-cased on BOTH sides", () => {
    const snapshot: IQabRateSnapshot = { base: "cup", rates: {} };

    expect(readQabRate(snapshot, " CUP ")).toBe(BigInt("1000000"));
    expect(readQabRate(SNAPSHOT, " usd ")).toBe(BigInt("440000000"));
  });

  it("should trim/upper-case the SNAPSHOT's own `base`, not only the queried code", () => {
    const snapshot: IQabRateSnapshot = { base: " CUP ", rates: {} };

    expect(readQabRate(snapshot, "cup")).toBe(BigInt("1000000"));
  });

  it("should normalise a `rates` KEY the same way, not just the queried code (trimmed, upper-cased)", () => {
    const snapshot: IQabRateSnapshot = {
      base: "CUP",
      rates: { " usd ": "440.000000" },
    };

    expect(readQabRate(snapshot, "USD")).toBe(BigInt("440000000"));
  });

  it("should read a listed rate, scaled by 10 ** QAB_EXCHANGE_RATE_DECIMALS (6)", () => {
    expect(readQabRate(SNAPSHOT, "USD")).toBe(BigInt("440000000"));
  });

  it("should accept a rate given as a finite number, not only as a string", () => {
    const snapshot: IQabRateSnapshot = { base: "CUP", rates: { EUR: 480 } };

    expect(readQabRate(snapshot, "EUR")).toBe(BigInt("480000000"));
  });

  it("should return null for a currency absent from `rates`", () => {
    expect(readQabRate(SNAPSHOT, "EUR")).toBeNull();
  });

  it.each([
    ["more than 6 decimals", "440.1234567"],
    ["negative", "-440.000000"],
    ["zero", "0.000000"],
    ["an object", { not: "a rate" }],
    ["a non-numeric string", "not-a-number"],
    ["an empty string", ""],
  ] as const)("should return null for an unreadable rate (%s)", (_label, rate) => {
    const snapshot: IQabRateSnapshot = { base: "CUP", rates: { USD: rate } };

    expect(readQabRate(snapshot, "USD")).toBeNull();
  });

  it("one unreadable rate does not cost the rest of the snapshot", () => {
    const snapshot: IQabRateSnapshot = {
      base: "CUP",
      rates: { USD: "440.000000", EUR: -1 },
    };

    expect(readQabRate(snapshot, "EUR")).toBeNull();
    expect(readQabRate(snapshot, "USD")).toBe(BigInt("440000000"));
  });
});

describe("convertQabAmount — pinned examples of the contract", () => {
  it('convert("10.00", USD -> CUP) === "4400.00"', () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "10.00",
        fromCurrencyCode: "USD",
        toCurrencyCode: "CUP",
      }),
    ).toBe("4400.00");
  });

  it('convert("4400.00", CUP -> USD) === "10.00"', () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "4400.00",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "USD",
      }),
    ).toBe("10.00");
  });

  it('convert("1.00", USD -> USD) === "1.00", and `rates` is never consulted', () => {
    // No USD entry at all: if the same-currency shortcut looked at `rates`, this
    // would come back null instead of "1.00".
    const snapshotWithoutUsd: IQabRateSnapshot = { base: "CUP", rates: {} };

    expect(
      convertQabAmount({
        snapshot: snapshotWithoutUsd,
        amount: "1.00",
        fromCurrencyCode: "USD",
        toCurrencyCode: "USD",
      }),
    ).toBe("1.00");
  });

  it("same-currency shortcut also fires across case/whitespace differences", () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "1.00",
        fromCurrencyCode: " usd ",
        toCurrencyCode: "USD",
      }),
    ).toBe("1.00");
  });

  it('convert("1.00", EUR -> CUP) === null (no rate for EUR)', () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "1.00",
        fromCurrencyCode: "EUR",
        toCurrencyCode: "CUP",
      }),
    ).toBeNull();
  });

  it("returns null when the TARGET currency's rate is unreadable, not only the source's", () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "1.00",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "EUR",
      }),
    ).toBeNull();
  });
});

describe("convertQabAmount — rounding is HALF UP, AWAY FROM ZERO", () => {
  // Rigged so the raw division lands EXACTLY on the half: base "CUP" (rate scaled
  // to 1_000_000) converted to "XXX" (rate scaled to 2_000_000) with 1 scaled cent:
  //   numerator = 1 * 1_000_000 = 1_000_000
  //   divisor   = 2_000_000
  //   quotient  = 0 (truncated toward zero), remainder = 1_000_000
  //   2 * |remainder| (2_000_000) >= |divisor| (2_000_000) -> round away from zero
  const halfwaySnapshot: IQabRateSnapshot = {
    base: "CUP",
    rates: { XXX: "2.000000" },
  };

  it("rounds a positive exact half UP (away from zero): 0.005-equivalent -> +0.01", () => {
    expect(
      convertQabAmount({
        snapshot: halfwaySnapshot,
        amount: "0.01",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "XXX",
      }),
    ).toBe("0.01");
  });

  it("rounds a negative exact half DOWN (away from zero): -0.005-equivalent -> -0.01", () => {
    expect(
      convertQabAmount({
        snapshot: halfwaySnapshot,
        amount: "-0.01",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "XXX",
      }),
    ).toBe("-0.01");
  });

  it("rounds a NEGATIVE, NON-exact remainder away from zero too (not only at the exact-half boundary)", () => {
    // amount "-9.00" against rate "7.000000": -900 * 1_000_000 / 7_000_000 = -128.571428...
    // quotient (truncated toward zero) = -128, remainder = -4_000_000.
    // 2 * |remainder| (8_000_000) >= |divisor| (7_000_000) -> adjust away from zero -> -129.
    // A sign bug in the truncate+adjust arithmetic (not just the abstract half-tie
    // question) would show up here, unlike the exact-half cases above.
    const snapshot: IQabRateSnapshot = { base: "CUP", rates: { XXX: "7.000000" } };

    expect(
      convertQabAmount({
        snapshot,
        amount: "-9.00",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "XXX",
      }),
    ).toBe("-1.29");
  });

  it("does NOT round half-even (banker's rounding would keep this at 0.00)", () => {
    // Half-even rounds 0.005-equivalent to the nearest EVEN cent, which is 0 here.
    // Half-up-away-from-zero (the contract's pinned rule) always goes to 1.
    const result = convertQabAmount({
      snapshot: halfwaySnapshot,
      amount: "0.01",
      fromCurrencyCode: "CUP",
      toCurrencyCode: "XXX",
    });

    expect(result).not.toBe("0.00");
    expect(result).toBe("0.01");
  });

  it("a remainder below the half rounds DOWN (toward zero), not up", () => {
    // 1 scaled cent, target rate 3_000_000: quotient=0, remainder=1_000_000,
    // 2*1_000_000 (2_000_000) < 3_000_000 -> stays at 0.
    const belowHalfSnapshot: IQabRateSnapshot = {
      base: "CUP",
      rates: { XXX: "3.000000" },
    };

    expect(
      convertQabAmount({
        snapshot: belowHalfSnapshot,
        amount: "0.01",
        fromCurrencyCode: "CUP",
        toCurrencyCode: "XXX",
      }),
    ).toBe("0.00");
  });
});

/**
 * This IS the contract now (§5, "IT RETURNS `null` IN EXACTLY THREE CASES" — case 1
 * is this guard). The reason is verified, not guessed: `BigInt("1250.00")` throws
 * `SyntaxError: Cannot convert 1250.00 to a BigInt`, and the message QUOTES the
 * offending value. `convertQabAmount` sits on the path that builds the response
 * body, so without this guard that message would reach `logRouteError` with an
 * order's amount inside it — the third appearance of E-031's shape (after
 * `JSON.parse` in F-010, and the response `.parse()` of ADR 0061). Symmetric with
 * `readQabRate`'s own guard for an unreadable rate: `null` is this module's existing
 * word for "cannot convert", not a new one.
 *
 * It does NOT add a fifth cause to the four causes of `conversion === null` in § 2.2:
 * the only production caller, `toTiendaOnlineOrderLine`, always feeds it the output
 * of `toAmountString`, which is fixed-scale by construction, so this branch is
 * unreachable from there. It exists for future callers (F-012) and for this suite —
 * `tiendaOnlineOrderMapping.test.ts` still enumerates exactly four causes, on purpose.
 */
describe("convertQabAmount — a malformed `amount` (§5, case 1 of exactly three null causes)", () => {
  it.each([
    ["not a number at all", "abc"],
    ["missing decimals", "10"],
    ["wrong decimal scale", "10.5"],
    ["empty string", ""],
  ] as const)("returns null instead of throwing for %s (%s)", (_label, amount) => {
    expect(() =>
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount,
        fromCurrencyCode: "USD",
        toCurrencyCode: "CUP",
      }),
    ).not.toThrow();

    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount,
        fromCurrencyCode: "USD",
        toCurrencyCode: "CUP",
      }),
    ).toBeNull();
  });

  it("runs BEFORE the same-currency short-circuit — order of evaluation is fixed by §5", () => {
    // "1" is not a fixed-scale 2-decimal string. If the same-code shortcut ran
    // first, this would return "1" unchanged (same code both sides); the guard
    // must win, so the malformed amount is rejected even with nothing to convert.
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "1",
        fromCurrencyCode: "USD",
        toCurrencyCode: "USD",
      }),
    ).toBeNull();
  });

  it("a well-formed amount still takes the same-currency short-circuit (control case for the above)", () => {
    expect(
      convertQabAmount({
        snapshot: SNAPSHOT,
        amount: "1.00",
        fromCurrencyCode: "USD",
        toCurrencyCode: "USD",
      }),
    ).toBe("1.00");
  });
});
