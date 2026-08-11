import { describe, it, expect } from "vitest";
import { packsToOpen, unitsFromPacks } from "@/lib/fractionStock";

// A pack of 10 loose units, e.g. a box of cigarettes.
const PACK = 10;

describe("packsToOpen", () => {
  it("opens nothing when the loose stock already covers the sale", () => {
    expect(packsToOpen(4, 10, PACK)).toBe(0);
  });

  it("opens nothing when the sale takes exactly the loose stock", () => {
    expect(packsToOpen(10, 10, PACK)).toBe(0);
  });

  it("opens one pack when a few units are missing", () => {
    expect(packsToOpen(5, 3, PACK)).toBe(1);
  });

  it("opens as many packs as the shortfall needs", () => {
    // 25 sold, 3 loose on the shelf: 22 missing → three packs.
    expect(packsToOpen(25, 3, PACK)).toBe(3);
  });

  it("opens a whole pack for a single missing unit", () => {
    expect(packsToOpen(11, 10, PACK)).toBe(1);
  });

  it("opens exactly one pack when the shortfall is a whole pack", () => {
    expect(packsToOpen(10, 0, PACK)).toBe(1);
  });

  it("opens nothing for a product that is not fractioned", () => {
    expect(packsToOpen(5, 0, null)).toBe(0);
    expect(packsToOpen(5, 0, 0)).toBe(0);
  });

  it("treats a negative loose stock as empty rather than as debt", () => {
    // Defensive: existencia should never be negative, but if it ever is, the
    // sale must not silently open fewer packs than it needs.
    expect(packsToOpen(5, -2, PACK)).toBe(1);
  });
});

describe("unitsFromPacks", () => {
  it("multiplies the packs by their size", () => {
    expect(unitsFromPacks(3, PACK)).toBe(30);
  });

  it("is zero for a product that is not fractioned", () => {
    expect(unitsFromPacks(3, null)).toBe(0);
  });
});
