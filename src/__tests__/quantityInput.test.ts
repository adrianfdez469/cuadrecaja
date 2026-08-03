import { describe, it, expect } from "vitest";
import {
  parseQuantityText,
  clampQuantity,
  resolveCommittedQuantity,
  getStepChips,
  getDefaultStep,
} from "@/app/pos/utils/quantityInput";

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

describe("getStepChips", () => {
  it("returns the fixed decimal chip set for decimal-allowed products", () => {
    expect(getStepChips(true, false, false, false)).toEqual([
      { value: 0.01, label: "0.01" },
      { value: 0.1, label: "0.1" },
      { value: 0.5, label: "0.5" },
      { value: 1, label: "1" },
    ]);
  });

  it("returns only the 1 chip when no bulk thresholds are met", () => {
    expect(getStepChips(false, false, false, false)).toEqual([
      { value: 1, label: "1" },
    ]);
  });

  it("adds bulk chips as thresholds are met", () => {
    expect(getStepChips(false, true, false, false)).toEqual([
      { value: 1, label: "1" },
      { value: 10, label: "10" },
    ]);
    expect(getStepChips(false, true, true, true)).toEqual([
      { value: 1, label: "1" },
      { value: 10, label: "10" },
      { value: 50, label: "50" },
      { value: 100, label: "100" },
    ]);
  });
});

describe("getDefaultStep", () => {
  it("defaults to 0.1 for decimal-allowed products", () => {
    expect(getDefaultStep(true)).toBe(0.1);
  });

  it("defaults to 1 for integer products", () => {
    expect(getDefaultStep(false)).toBe(1);
  });
});
