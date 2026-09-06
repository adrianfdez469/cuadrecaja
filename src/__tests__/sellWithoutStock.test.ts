import { describe, it, expect } from "vitest";
import {
  UNLIMITED_QUANTITY,
  allowsSellingWithoutStock,
  getMaxSellableQuantity,
  isSellingWithoutStock,
  isVisibleInPos,
} from "@/app/pos/utils/sellWithoutStock";

describe("allowsSellingWithoutStock", () => {
  it("always allows it offline, whatever the setting says", () => {
    expect(allowsSellingWithoutStock(false, false)).toBe(true);
    expect(allowsSellingWithoutStock(false, true)).toBe(true);
  });

  it("online, the cashier's setting decides", () => {
    expect(allowsSellingWithoutStock(true, false)).toBe(false);
    expect(allowsSellingWithoutStock(true, true)).toBe(true);
  });
});

describe("isVisibleInPos", () => {
  it("hides what the catalog has run out of", () => {
    expect(isVisibleInPos({ disponible: 0 }, false)).toBe(false);
    expect(isVisibleInPos({ disponible: -3 }, false)).toBe(false);
  });

  it("keeps showing anything with stock left", () => {
    expect(isVisibleInPos({ disponible: 0.5 }, false)).toBe(true);
    expect(isVisibleInPos({ disponible: 12 }, false)).toBe(true);
  });

  it("shows the sold-out ones too when they can still be sold", () => {
    expect(isVisibleInPos({ disponible: 0 }, true)).toBe(true);
    expect(isVisibleInPos({ disponible: -3 }, true)).toBe(true);
  });
});

describe("getMaxSellableQuantity", () => {
  it("is what is left after what the basket already took", () => {
    expect(getMaxSellableQuantity(10, 4, false)).toBe(6);
  });

  it("never goes below zero", () => {
    expect(getMaxSellableQuantity(2, 5, false)).toBe(0);
    expect(getMaxSellableQuantity(-4, 0, false)).toBe(0);
  });

  it("has no ceiling at all when selling without stock", () => {
    expect(getMaxSellableQuantity(0, 0, true)).toBe(UNLIMITED_QUANTITY);
    // Even with stock left: past it the server is what says no, and no figure
    // derived from a count that is not the truth would be one either.
    expect(getMaxSellableQuantity(10, 4, true)).toBe(UNLIMITED_QUANTITY);
  });
});

describe("isSellingWithoutStock", () => {
  it("is true once the basket has taken everything the catalog holds", () => {
    expect(isSellingWithoutStock(3, 3)).toBe(true);
    expect(isSellingWithoutStock(0, 0)).toBe(true);
    expect(isSellingWithoutStock(3, 4)).toBe(true);
  });

  it("is false while something is still left", () => {
    expect(isSellingWithoutStock(3, 2)).toBe(false);
  });
});
