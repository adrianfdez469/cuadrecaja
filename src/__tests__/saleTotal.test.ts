import { describe, it, expect } from "vitest";
import {
  grossTotalBase,
  linePriceInBase,
  reconcileSaleTotal,
} from "@/lib/saleTotal";
import { SALE_TOTAL_TOLERANCE_BASE } from "@/constants/venta";

// USD-based business: 1 USD = 680 CUP, 1 EUR = 775 CUP.
const tasas = { USD: 680, EUR: 775 };
const BASE = "USD";

describe("linePriceInBase", () => {
  it("keeps a price already in monedaBase (null code means base)", () => {
    expect(
      linePriceInBase({ precio: 22, monedaPrecioCode: null }, tasas, BASE),
    ).toBe(22);
    expect(
      linePriceInBase({ precio: 22, monedaPrecioCode: "USD" }, tasas, BASE),
    ).toBe(22);
  });

  it("converts a CUP price through the base's own rate", () => {
    expect(
      linePriceInBase({ precio: 6800, monedaPrecioCode: "CUP" }, tasas, BASE),
    ).toBeCloseTo(10, 10);
  });

  it("converts a third currency via CUP", () => {
    expect(
      linePriceInBase({ precio: 1, monedaPrecioCode: "EUR" }, tasas, BASE),
    ).toBeCloseTo(775 / 680, 10);
  });

  it("treats a missing or invalid price as 0", () => {
    expect(
      linePriceInBase({ precio: null, monedaPrecioCode: "CUP" }, tasas, BASE),
    ).toBe(0);
    expect(linePriceInBase({ precio: Number.NaN }, tasas, BASE)).toBe(0);
  });
});

describe("grossTotalBase", () => {
  it("regression: a mixed basket is not the raw sum of its prices", () => {
    // 40 × 3 USD + 1 × 1500 CUP + 2 × 3 USD + 20 × 70 CUP + 2 × 10 USD.
    // A client once stored this as 3046 — the prices added across currencies.
    const lines = [
      { precio: 3, cantidad: 40, monedaPrecioCode: null },
      { precio: 1500, cantidad: 1, monedaPrecioCode: "CUP" },
      { precio: 3, cantidad: 2, monedaPrecioCode: null },
      { precio: 70, cantidad: 20, monedaPrecioCode: "CUP" },
      { precio: 10, cantidad: 2, monedaPrecioCode: null },
    ];
    const expected = 120 + 1500 / 680 + 6 + 1400 / 680 + 20;
    expect(grossTotalBase(lines, tasas, BASE)).toBeCloseTo(expected, 10);
    expect(grossTotalBase(lines, tasas, BASE)).not.toBeCloseTo(3046, 0);
  });

  it("is 0 for an empty basket", () => {
    expect(grossTotalBase([], tasas, BASE)).toBe(0);
  });

  it("with base CUP and no rates, CUP prices need no conversion", () => {
    expect(
      grossTotalBase(
        [{ precio: 250, cantidad: 4, monedaPrecioCode: "CUP" }],
        {},
        "CUP",
      ),
    ).toBe(1000);
  });
});

describe("reconcileSaleTotal", () => {
  it("keeps the server total and does not flag float noise", () => {
    const r = reconcileSaleTotal(22.666666666666668, 22.66666666666667);
    expect(r.total).toBe(22.66666666666667);
    expect(r.diverged).toBe(false);
  });

  it("flags a client total that priced CUP lines as base", () => {
    const r = reconcileSaleTotal(15300, 22.5);
    expect(r.total).toBe(22.5);
    expect(r.clientTotal).toBe(15300);
    expect(r.delta).toBeCloseTo(-15277.5, 6);
    expect(r.diverged).toBe(true);
  });

  it("uses the tolerance as an inclusive bound", () => {
    expect(
      reconcileSaleTotal(10, 10 + SALE_TOTAL_TOLERANCE_BASE).diverged,
    ).toBe(false);
    expect(
      reconcileSaleTotal(10, 10 + SALE_TOTAL_TOLERANCE_BASE * 2).diverged,
    ).toBe(true);
  });

  it("normalizes a missing or negative client total to 0 and never persists a negative total", () => {
    expect(reconcileSaleTotal(undefined, 5).clientTotal).toBe(0);
    expect(reconcileSaleTotal("abc", 5).clientTotal).toBe(0);
    expect(reconcileSaleTotal(-3, -2).total).toBe(0);
  });
});
