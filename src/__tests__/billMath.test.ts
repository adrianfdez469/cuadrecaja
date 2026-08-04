import { describe, it, expect } from "vitest";
import {
  sumBills,
  breakdownGreedy,
  tallyBills,
} from "@/app/pos/utils/billMath";

const CUP = [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1];

describe("sumBills", () => {
  it("adds the bills up", () => {
    expect(sumBills([1000, 500, 50])).toBe(1550);
  });

  it("is zero for an empty tally", () => {
    expect(sumBills([])).toBe(0);
  });

  it("keeps two-decimal precision", () => {
    expect(sumBills([0.1, 0.2])).toBe(0.3);
  });
});

describe("breakdownGreedy", () => {
  it("represents an amount with the fewest large bills first", () => {
    expect(breakdownGreedy(1550, CUP)).toEqual([1000, 500, 50]);
  });

  it("repeats a denomination when needed", () => {
    expect(breakdownGreedy(2000, CUP)).toEqual([1000, 1000]);
  });

  it("returns an empty tally for zero", () => {
    expect(breakdownGreedy(0, CUP)).toEqual([]);
  });

  it("returns null when the amount is not representable", () => {
    expect(breakdownGreedy(1550.5, CUP)).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(breakdownGreedy(-100, CUP)).toBeNull();
  });

  it("returns null when there are no denominations", () => {
    expect(breakdownGreedy(100, [])).toBeNull();
  });

  it("tolerates unsorted denominations", () => {
    expect(breakdownGreedy(1550, [50, 1000, 500, 1])).toEqual([1000, 500, 50]);
  });
});

describe("tallyBills", () => {
  it("groups bills by denomination, largest first", () => {
    expect(tallyBills([500, 1000, 500])).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 500, count: 2 },
    ]);
  });

  it("is empty for an empty tally", () => {
    expect(tallyBills([])).toEqual([]);
  });
});
