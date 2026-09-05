import { describe, it, expect } from "vitest";
import { hasQabScale, toQabPrice, toQabExchangeRate } from "@/schemas/qabDecimals";
import { QAB_AMOUNT_DECIMALS, QAB_EXCHANGE_RATE_DECIMALS } from "@/constants/qab";

/**
 * F-006 — `src/schemas/qabDecimals.ts` (contract §2, ADR 0047).
 *
 * Two DIFFERENT scales, two DIFFERENT helpers, on purpose: `price` rounds to
 * QAB_AMOUNT_DECIMALS (2) and `rate` rounds to QAB_EXCHANGE_RATE_DECIMALS (6),
 * and `qabAmountSchema` (`src/schemas/qabAmount.ts`) must NOT be reused for
 * either — it REJECTS a value with more decimals instead of rounding it, which
 * is the opposite of what this feature's acceptance criterion 5 requires.
 *
 * `toQabPrice(2.675) === 2.67` and `toQabPrice(2.005) === 2` are pinned literally
 * by the contract, because `toFixed` on the IEEE-754 double diverges from
 * "banker's" rounding here — a naive `Math.round(x * 100) / 100` would give
 * 2.68 and 2.01 respectively, which is exactly the bug this suite exists to
 * catch (spec, criterion 5 and "Riesgos de redacción").
 */

describe("hasQabScale", () => {
  it("should be true for a value that already has at most `decimals` decimals", () => {
    expect(hasQabScale(2.67, 2)).toBe(true);
    expect(hasQabScale(450, 2)).toBe(true);
    expect(hasQabScale(0, 2)).toBe(true);
  });

  it("should be false for a value with MORE than `decimals` decimals — the exact case toFixed rounds away", () => {
    // This is the discriminating case: 2.675 survives a naive `=== ` comparison against its
    // OWN toFixed(2) result in floating point in some implementations, so the test picks a
    // value where the real extra decimal is unambiguous.
    expect(hasQabScale(2.675, 2)).toBe(false);
    expect(hasQabScale(2.6749999999999998, 2)).toBe(false);
  });

  it("should work at 6 decimals for the exchange-rate scale", () => {
    expect(hasQabScale(420.123456, 6)).toBe(true);
    expect(hasQabScale(420.1234567, 6)).toBe(false);
  });
});

describe("toQabPrice — pinned behaviour of the contract", () => {
  it("should round 2.675 down to 2.67, NOT up to 2.68 (toFixed on the IEEE-754 double, not banker's rounding)", () => {
    expect(toQabPrice(2.675)).toBe(2.67);
  });

  it("should round 2.005 down to 2, NOT to 2.01 — this is the case that discriminates toFixed from a naive Math.round(x*100)/100", () => {
    // Math.round(2.005 * 100) / 100 === 2.01 in plain floating point, which is the bug this
    // pinned case exists to catch (spec §5, "Riesgos de redacción de los criterios").
    expect(toQabPrice(2.005)).toBe(2);
  });

  it("should leave an integer amount untouched", () => {
    expect(toQabPrice(450)).toBe(450);
  });

  it("should round 0.125 up to 0.13", () => {
    expect(toQabPrice(0.125)).toBe(0.13);
  });

  it("should never introduce more than QAB_AMOUNT_DECIMALS decimals in its own constant", () => {
    // Guards against the constant drifting without this test noticing (E-017 spirit): the
    // module's contract is written in terms of the constant, not the literal 2.
    expect(QAB_AMOUNT_DECIMALS).toBe(2);
  });

  it("should return the value unchanged (never throw) on a non-finite input — rejecting it is qabProductPriceSchema's job", () => {
    expect(toQabPrice(Number.NaN)).toBeNaN();
    expect(toQabPrice(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it("should produce a value with at most 2 real decimals, verified with hasQabScale (not a string comparison)", () => {
    expect(hasQabScale(toQabPrice(2.675), QAB_AMOUNT_DECIMALS)).toBe(true);
    expect(hasQabScale(toQabPrice(2.005), QAB_AMOUNT_DECIMALS)).toBe(true);
  });

  it("2.005 serializes to a bare `2` through JSON, not `2.00` — a naive string check for trailing zeros would be misled", () => {
    // The number 2 and the number 2.00 are the same value; JSON.stringify never writes the
    // trailing zeros back, which is the second half of the pinned case above.
    expect(JSON.stringify(toQabPrice(2.005))).toBe("2");
  });

  it("should never preserve a NEGATIVE zero — toFixed's own rounding normalizes -0 to +0, unlike NaN/Infinity which pass through untouched", () => {
    // -0 is finite, so this does NOT take the non-finite early-return path (verified: it goes
    // through Number((-0).toFixed(2)), which yields +0 in V8).
    const result = toQabPrice(-0);
    expect(result).toBe(0);
    expect(Object.is(result, -0)).toBe(false);
  });
});

describe("toQabExchangeRate — pinned behaviour of the contract, SIX decimals, never QAB_AMOUNT_DECIMALS", () => {
  it("should round 420.1234567 to 420.123457 (six decimals)", () => {
    expect(toQabExchangeRate(420.1234567)).toBe(420.123457);
  });

  it("should leave an integer rate untouched", () => {
    expect(toQabExchangeRate(420)).toBe(420);
  });

  it("should use QAB_EXCHANGE_RATE_DECIMALS (6), never QAB_AMOUNT_DECIMALS (2) — the whole point of ADR 0047", () => {
    // This is the discriminating case: if the implementation accidentally reused the 2-decimal
    // helper/constant, this would round to 420.12 instead of 420.123457.
    expect(QAB_EXCHANGE_RATE_DECIMALS).toBe(6);
    expect(toQabExchangeRate(420.1234567)).not.toBe(toQabPrice(420.1234567));
    expect(toQabExchangeRate(420.1234567)).not.toBeCloseTo(420.12, 5);
  });

  it("should return the value unchanged (never throw) on a non-finite input, exactly like toQabPrice", () => {
    expect(toQabExchangeRate(Number.NaN)).toBeNaN();
  });

  it("should round a rate under half of the smallest representable unit down to 0 — the boundary that makes exchangeRateTooSmall possible", () => {
    expect(toQabExchangeRate(0.0000001)).toBe(0);
  });

  it("should NOT round a clearly-above-zero small rate to 0", () => {
    expect(toQabExchangeRate(0.0000009)).toBeGreaterThan(0);
  });
});
