import { describe, it, expect } from "vitest";
import {
  parseQuantityText,
  clampQuantity,
  resolveCommittedQuantity,
  getQuickAddChips,
  sanitizeQuantityDraft,
} from "@/app/pos/utils/quantityInput";

describe("sanitizeQuantityDraft", () => {
  it("strips non-digits when decimals are not allowed", () => {
    expect(sanitizeQuantityDraft("1a2.3b", false)).toBe("123");
  });

  it("keeps up to 2 decimal digits when allowed", () => {
    expect(sanitizeQuantityDraft("2.35", true)).toBe("2.35");
  });

  it("truncates beyond 2 decimal digits as they're typed", () => {
    expect(sanitizeQuantityDraft("2.34567", true)).toBe("2.34");
  });

  it("normalizes a comma to a decimal point", () => {
    expect(sanitizeQuantityDraft("2,35", true)).toBe("2.35");
  });

  it("collapses a second decimal point instead of leaving it in", () => {
    expect(sanitizeQuantityDraft("2.3.5", true)).toBe("2.35");
  });

  it("leaves a lone decimal point as-is so typing can continue", () => {
    expect(sanitizeQuantityDraft("2.", true)).toBe("2.");
  });
});

describe("parseQuantityText", () => {
  it("parses a plain integer", () => {
    expect(parseQuantityText("37", false)).toBe(37);
  });

  it("parses a decimal when allowed", () => {
    expect(parseQuantityText("2.35", true)).toBe(2.35);
  });

  it("strips the decimal point when decimals are not allowed", () => {
    expect(parseQuantityText("2.35", false)).toBe(235);
  });

  it("strips non-digit characters", () => {
    expect(parseQuantityText("1a2b3", false)).toBe(123);
  });

  it("returns null for an empty string", () => {
    expect(parseQuantityText("", true)).toBeNull();
  });

  it("returns null for a lone decimal point", () => {
    expect(parseQuantityText(".", true)).toBeNull();
  });
});

describe("clampQuantity", () => {
  it("rounds to 2 decimals when decimals are allowed", () => {
    expect(clampQuantity(2.3456, 0.01, 100, true)).toBe(2.35);
  });

  it("rounds to the nearest integer when decimals are not allowed", () => {
    expect(clampQuantity(4.6, 1, 100, false)).toBe(5);
  });

  it("clamps down to max", () => {
    expect(clampQuantity(500, 1, 86, false)).toBe(86);
  });

  it("clamps up to min", () => {
    expect(clampQuantity(0, 1, 86, false)).toBe(1);
  });
});

describe("resolveCommittedQuantity", () => {
  it("commits a valid in-range value", () => {
    expect(resolveCommittedQuantity("37", 1, 1, 86, false)).toBe(37);
  });

  it("clamps an out-of-range value to max", () => {
    expect(resolveCommittedQuantity("999", 1, 1, 86, false)).toBe(86);
  });

  it("reverts to the previous value on empty input", () => {
    expect(resolveCommittedQuantity("", 5, 1, 86, false)).toBe(5);
  });

  it("reverts to the previous value on an unparsable value", () => {
    expect(resolveCommittedQuantity(".", 5, 0.01, 86, true)).toBe(5);
  });
});

describe("getQuickAddChips", () => {
  it("offers fractions of a unit for a decimal-allowed product", () => {
    expect(getQuickAddChips(true, 86)).toEqual([
      { value: 0.1, label: "+0,1" },
      { value: 0.5, label: "+0,5" },
      { value: 1, label: "+1" },
    ]);
  });

  it("leaves out anything the shop cannot supply", () => {
    expect(getQuickAddChips(false, 9)).toEqual([]);
    expect(getQuickAddChips(false, 10)).toEqual([{ value: 10, label: "+10" }]);
    expect(getQuickAddChips(false, 120)).toEqual([
      { value: 10, label: "+10" },
      { value: 50, label: "+50" },
      { value: 100, label: "+100" },
    ]);
  });

  it("adds the box a fraction is broken out of", () => {
    expect(getQuickAddChips(false, 120, 20)).toEqual([
      { value: 10, label: "+10" },
      { value: 50, label: "+50" },
      { value: 100, label: "+100" },
      { value: 20, label: "Caja \u00d7 20" },
    ]);
  });

  it("skips the box chip when it duplicates a shortcut or exceeds the stock", () => {
    expect(getQuickAddChips(false, 120, 10)).toEqual([
      { value: 10, label: "+10" },
      { value: 50, label: "+50" },
      { value: 100, label: "+100" },
    ]);
    expect(getQuickAddChips(false, 15, 20)).toEqual([
      { value: 10, label: "+10" },
    ]);
  });

  it("never offers more than the four the row fits", () => {
    expect(getQuickAddChips(false, 1000, 7)).toHaveLength(4);
  });
});
