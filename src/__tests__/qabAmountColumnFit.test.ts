import { describe, it, expect } from "vitest";
import { fitsQabAmountColumn, fitsQabQuantityColumn } from "@/schemas/qabAmount";
import { qabAmountSchema } from "@/schemas/qabAmount";

/**
 * F-010 — `fitsQabAmountColumn`/`fitsQabQuantityColumn` (contract § `qabAmount.ts`,
 * ADR 0053). New file on purpose, per [E-019]: `qabAmount.test.ts` already has green
 * tests for `qabAmountSchema`/`qabQuantitySchema` (F-001), and these two new symbols
 * do not exist until the implementer adds them — importing them here, in a file of
 * their own, cannot drag that suite down if the import resolves to `undefined`.
 *
 * The QA note this feature exists to close, verified literally: `qabAmountSchema`
 * fixes the SCALE of an amount but never its MAGNITUDE. `qabAmountSchema(1e20)`
 * yields `"100000000000000000000.00"`, a 21-digit integer part that a
 * `Decimal(14, 2)` (12 integer digits, per `QAB_AMOUNT_MAX_INTEGER_DIGITS`) cannot
 * store. Before F-010, nothing checked that; this predicate is the check.
 */

describe("fitsQabAmountColumn — Decimal(14, 2), 12 integer digits", () => {
  it("should reject the exact overflow case documented in ADR 0053: qabAmountSchema(1e20)", () => {
    const normalized = qabAmountSchema.parse(1e20);
    expect(normalized).toBe("100000000000000000000.00");
    expect(fitsQabAmountColumn(normalized)).toBe(false);
  });

  it("should accept exactly 12 integer digits, the column's own boundary", () => {
    expect(fitsQabAmountColumn("999999999999.99")).toBe(true);
  });

  it("should reject 13 integer digits, one past the boundary", () => {
    expect(fitsQabAmountColumn("9999999999999.99")).toBe(false);
  });

  it("should accept '0.00'", () => {
    expect(fitsQabAmountColumn("0.00")).toBe(true);
  });

  it("should ignore a leading sign when counting integer digits", () => {
    expect(fitsQabAmountColumn("-999999999999.99")).toBe(true);
    expect(fitsQabAmountColumn("-9999999999999.99")).toBe(false);
  });

  it("should ignore leading zeros when counting integer digits: '000880.00' has 3, not 6", () => {
    expect(fitsQabAmountColumn("000880.00")).toBe(true);
    // A value that would only overflow if the leading zeros were counted:
    expect(fitsQabAmountColumn(`${"0".repeat(20)}880.00`)).toBe(true);
  });

  it("should accept a typical small amount", () => {
    expect(fitsQabAmountColumn(qabAmountSchema.parse("880"))).toBe(true);
  });

  it("should not need Number precision to decide: a 12-digit value at the edge of 2^53 is still counted by digits", () => {
    // 2^53 has 16 digits, so a 12-digit integer part never risks float rounding;
    // the point of this case is that the function must count digits, not parse
    // the value back into a Number and compare magnitudes.
    expect(fitsQabAmountColumn("100000000000.00")).toBe(true);
  });
});

describe("fitsQabQuantityColumn — Decimal(14, 3), 11 integer digits", () => {
  it("should accept exactly 11 integer digits, the column's own boundary", () => {
    expect(fitsQabQuantityColumn("99999999999.999")).toBe(true);
  });

  it("should reject 12 integer digits, one past the boundary", () => {
    expect(fitsQabQuantityColumn("999999999999.999")).toBe(false);
  });

  it("should accept '0.000'", () => {
    expect(fitsQabQuantityColumn("0.000")).toBe(true);
  });

  it("should ignore leading zeros when counting integer digits", () => {
    expect(fitsQabQuantityColumn("00000000002.000")).toBe(true);
  });

  it("should accept a typical small quantity", () => {
    expect(fitsQabQuantityColumn("2.000")).toBe(true);
  });
});
