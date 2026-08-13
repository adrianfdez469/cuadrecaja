import { describe, it, expect } from "vitest";
import { ceilToStep, suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";

const CUP = [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1];
const USD = [100, 50, 20, 10, 5, 1];

describe("ceilToStep", () => {
  it("rounds up to the next multiple of the step", () => {
    expect(ceilToStep(1249.5, 1)).toBe(1250);
    expect(ceilToStep(1250, 1)).toBe(1250);
    expect(ceilToStep(3.57, 1)).toBe(4);
  });

  it("does not overshoot whole amounts because of float noise", () => {
    expect(ceilToStep(0.1 + 0.2, 0.01)).toBe(0.3);
    expect(ceilToStep(63.64, 1)).toBe(64);
  });

  it("supports sub-unit steps", () => {
    expect(ceilToStep(1.234, 0.05)).toBe(1.25);
  });
});

describe("suggestedAmounts", () => {
  it("returns the exact amount rounded up to the smallest denomination", () => {
    expect(suggestedAmounts(1249.5, CUP).exact).toBe(1250);
    expect(suggestedAmounts(3.57, USD).exact).toBe(4);
  });

  it("suggests the round amounts above a mid-magnitude total", () => {
    expect(suggestedAmounts(1250, CUP).suggestions).toEqual([1300, 1500, 2000]);
  });

  it("suggests strictly greater amounts when the total is already round", () => {
    expect(suggestedAmounts(1000, CUP).suggestions).toEqual([1100, 1500, 2000]);
  });

  it("never suggests amounts built on the odd 3-unit denomination", () => {
    const { suggestions } = suggestedAmounts(1000, CUP);
    expect(suggestions).not.toContain(1002);
    expect(suggestions.every((s) => s % 50 === 0)).toBe(true);
  });

  it("handles small totals without suggesting near-exact noise", () => {
    expect(suggestedAmounts(35, CUP).suggestions).toEqual([40, 50]);
  });

  it("works for a currency whose smallest denomination is 1 unit", () => {
    expect(suggestedAmounts(3.57, USD).suggestions).toEqual([5, 10, 20]);
  });

  it("returns no suggestions when nothing is pending", () => {
    expect(suggestedAmounts(0, CUP)).toEqual({ exact: 0, suggestions: [] });
    expect(suggestedAmounts(-10, CUP)).toEqual({ exact: 0, suggestions: [] });
  });

  it("falls back to a 2-decimal exact when there are no denominations", () => {
    expect(suggestedAmounts(12.345, [])).toEqual({
      exact: 12.35,
      suggestions: [],
    });
  });

  it("caps the suggestion list at three entries", () => {
    expect(suggestedAmounts(1250, CUP).suggestions.length).toBeLessThanOrEqual(
      3,
    );
  });
});
