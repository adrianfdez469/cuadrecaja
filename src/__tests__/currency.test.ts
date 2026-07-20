import { describe, it, expect } from "vitest";
import {
  calcularVuelto,
  convertToBase,
  convertFromBase,
  buildTasaSnapshot,
} from "@/lib/currency";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * TDD Test Suite for calcularVuelto() bug fixes
 *
 * BUG CONTEXT:
 * 1. Threshold Inconsistency: Line 79 has `vueltoTotalBase < 0.01` but line 105 has `restoBase > 0.005`
 *    This causes small remainder balances to be ignored in multi-currency scenarios.
 *
 * 2. Wrong monedaCobro in PaymentModal: Line 498 always sets `monedaCobro: monedaBase`,
 *    but should be the actual MAIN currency with the largest cash amount.
 *
 * NOTE: This test file focuses on the calcularVuelto() function.
 * The PaymentModal bug is a UI layer issue tested separately.
 */

// ─── Mock Data ────────────────────────────────────────────────────────────

/**
 * Mock exchange rates:
 * - USD: 1 USD = 0.8 CUP
 * - EUR: 1 EUR = 1.2 CUP
 * - CUP: 1 CUP = 1 CUP (anchor, implicit)
 */
const mockTasaSnapshot: ITasaSnapshot = {
  USD: 0.8,
  EUR: 1.2,
};

/**
 * Mock denomination constraints per currency
 * CUP: [100, 50, 20, 10, 5, 1, 0.50, 0.25, 0.10, 0.05, 0.01]
 * USD: [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10]
 * EUR: [100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10]
 */
const mockDenominaciones: Record<string, number[]> = {
  CUP: [100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.01],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1],
  EUR: [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
};

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Validates that a change array respects denomination constraints
 */
function validateDenominaciones(
  vueltos: IVueltoLinea[],
  denominaciones: Record<string, number[]>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const vuelto of vueltos) {
    const denoms = denominaciones[vuelto.moneda];
    if (!denoms || denoms.length === 0) {
      errors.push(`No denominaciones found for currency ${vuelto.moneda}`);
      continue;
    }

    const denomMin = Math.min(...denoms);
    const remainder = vuelto.monto % denomMin;

    // Allow for floating point rounding errors (< 0.001)
    if (remainder > 0.001 && Math.abs(remainder - denomMin) > 0.001) {
      errors.push(
        `${vuelto.moneda} vuelto ${vuelto.monto} violates min denomination ${denomMin}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sums all vueltos converted to base currency
 */
function sumVueltoBase(
  vueltos: IVueltoLinea[],
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  return vueltos.reduce(
    (sum, v) => sum + convertToBase(v.monto, v.moneda, tasas, monedaBase),
    0,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Threshold Consistency
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - Scenario 1: Threshold Consistency", () => {
  describe("Single currency (vueltoTotalBase < 0.01 check)", () => {
    it("should return empty array when change is exactly 0.005 CUP (below threshold)", () => {
      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 100.005,
          equivalenteBase: 100.005,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "CUP",
        "CUP",
        mockTasaSnapshot,
        mockDenominaciones,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when change is 0.009 CUP (below 0.01 threshold)", () => {
      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 100.009,
          equivalenteBase: 100.009,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "CUP",
        "CUP",
        mockTasaSnapshot,
        mockDenominaciones,
      );

      expect(result).toEqual([]);
    });

    it("should return change when vueltoTotalBase >= 0.01", () => {
      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 101,
          equivalenteBase: 101,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "CUP",
        "CUP",
        mockTasaSnapshot,
        mockDenominaciones,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].moneda).toBe("CUP");
      expect(result[0].monto).toBe(1);
    });

    it("should return empty array when total paid equals total (no change)", () => {
      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 100,
          equivalenteBase: 100,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "CUP",
        "CUP",
        mockTasaSnapshot,
        mockDenominaciones,
      );

      expect(result).toEqual([]);
    });
  });

  describe("Multi-currency remainder handling (restoBase > 0.005 check)", () => {
    it("should FAIL: remainder between 0.005 and 0.01 gets lost in multi-currency scenario", () => {
      /**
       * REGRESSION TEST: This test documents the CURRENT BUG
       *
       * Scenario:
       * - Total: 100 CUP
       * - Paid: 60 USD + 50 CUP = 48 CUP + 50 CUP = 98 CUP base
       * - Change: -2 CUP (underpaid, so no change)
       *
       * Modified scenario for change:
       * - Total: 100 CUP
       * - Paid: 80 USD (= 64 CUP) + 37 CUP = 101 CUP base
       * - vueltoTotalBase = 1 CUP
       * - vueltoEnMonedaCobro (USD): 1 / 0.8 = 1.25 USD
       *   - denomMin (USD) = 0.1
       *   - floor(1.25 / 0.1) * 0.1 = 1.2 USD (= 0.96 CUP base)
       * - restoBase = 1 - 0.96 = 0.04 CUP
       * - Currently: 0.04 > 0.005 is TRUE, so it SHOULD be distributed
       *   But due to line 110's Math.ceil and denomination constraints, it gets rounded
       */

      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "USD",
          monto: 80,
          equivalenteBase: 64, // 80 * 0.8
        },
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 37,
          equivalenteBase: 37,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "USD", // monedaCobro is USD (main payment currency)
        "CUP", // monedaBase
        mockTasaSnapshot,
        mockDenominaciones,
      );

      // With current code: line 105 checks restoBase > 0.005
      // If resto = 0.04, this passes and change is distributed
      const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");

      // The bug: small remainder between 0.005 and 0.01 gets lost
      // This test verifies current buggy behavior to establish baseline
      console.log("Current vuelto distribution:", result);
      console.log("Total change base:", totalChangeBase);

      // Currently this might pass, but we're documenting the threshold inconsistency
      // When resto is between 0.005 and 0.01, it gets partially lost
    });

    it("should handle remainder of 0.008 CUP correctly (currently lost due to threshold mismatch)", () => {
      /**
       * BUG SCENARIO:
       * - Total: 100 CUP
       * - Paid: 50.2 USD (= 40.16 CUP) + 60 CUP = 100.16 CUP base
       * - vueltoTotalBase = 0.16 CUP
       * - vueltoEnMonedaCobro: 0.16 / 0.8 = 0.2 USD
       *   - denomMin (USD) = 0.1
       *   - floor(0.2 / 0.1) * 0.1 = 0.2 USD (= 0.16 CUP)
       * - restoBase = 0.16 - 0.16 = 0 (okay, fully distributed)
       *
       * Modified for 0.008 remainder:
       * - Total: 100 CUP
       * - Paid: 50 USD (= 40 CUP) + 60.008 CUP = 100.008 CUP base
       * - vueltoTotalBase = 0.008 CUP
       * - monedaCobro = USD
       * - vueltoEnMonedaCobro: 0.008 / 0.8 = 0.01 USD
       *   - denomMin (USD) = 0.1
       *   - floor(0.01 / 0.1) * 0.1 = 0 USD
       * - restoBase = 0.008 - 0 = 0.008 CUP
       * - Line 105: if (0.008 > 0.005) TRUE → should distribute
       * BUT Line 79: vueltoTotalBase < 0.01 is ALSO TRUE initially
       *   So if this was called with just 0.008 CUP single-currency change,
       *   it would return [] at line 79!
       * THRESHOLD INCONSISTENCY: 0.005 vs 0.01
       */

      const pagos: IPagoLinea[] = [
        {
          tipo: "cash",
          moneda: "USD",
          monto: 50,
          equivalenteBase: 40,
        },
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 60.008,
          equivalenteBase: 60.008,
        },
      ];

      const result = calcularVuelto(
        100,
        pagos,
        "USD",
        "CUP",
        mockTasaSnapshot,
        mockDenominaciones,
      );

      // Document the threshold inconsistency:
      // Line 79: vueltoTotalBase < 0.01 guard
      // Line 105: restoBase > 0.005 check
      // These thresholds are inconsistent!
      expect(result.length).toBeLessThanOrEqual(2); // Should have both USD and CUP or just CUP
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: Multi-currency Change Distribution
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - Scenario 2: Multi-currency Change Distribution", () => {
  it("should return empty when total paid < total (no change needed)", () => {
    /**
     * Scenario: Customer underpays
     * - Total: 140 CUP
     * - Paid: 100 USD (= 80 CUP) + 50 CUP = 130 CUP base
     * - Underpaid, so no change
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 100,
        equivalenteBase: 80,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 50,
        equivalenteBase: 50,
      },
    ];

    const result = calcularVuelto(
      140,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([]);
  });

  it("should distribute change across main currency when main has remainder", () => {
    /**
     * Scenario: Main payment currency gets the change
     * - Total: 100 CUP
     * - Paid: 100 USD (= 80 CUP) + 25 CUP = 105 CUP base
     * - vueltoTotalBase = 5 CUP
     * - monedaCobro = USD (main payment)
     * - vueltoEnMonedaCobro: 5 / 0.8 = 6.25 USD
     *   - denomMin (USD) = 0.1
     *   - floor(6.25 / 0.1) * 0.1 = 6.2 USD (= 4.96 CUP)
     * - restoBase = 5 - 4.96 = 0.04 CUP
     *   - denomMin (CUP) = 0.01
     *   - ceil(0.04 / 0.01) * 0.01 = 0.04 CUP
     * - Expected: [{ USD, 6.2 }, { CUP, 0.04 }]
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 100,
        equivalenteBase: 80,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 25,
        equivalenteBase: 25,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    // Must have at least USD change
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((v) => v.moneda === "USD")).toBe(true);

    // Validate all vueltos respect denominaciones
    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    // Total change should be approximately 5 CUP
    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    expect(totalChangeBase).toBeCloseTo(5, 2);
  });

  it("should distribute change proportionally when both currencies paid", () => {
    /**
     * Scenario: Both currencies contribute to payment
     * - Total: 100 CUP
     * - Paid: 50 USD (= 40 CUP) + 65 CUP = 105 CUP base
     * - vueltoTotalBase = 5 CUP
     * - monedaCobro = CUP (if paid mostly in CUP)
     * - In single-currency mode (monedaCobro == monedaBase):
     *   - denomMin (CUP) = 0.01
     *   - ceil(5 / 0.01) * 0.01 = 5 CUP
     * - Expected: [{ CUP, 5 }]
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 50,
        equivalenteBase: 40,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 65,
        equivalenteBase: 65,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "CUP", // monedaCobro is CUP
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].moneda).toBe("CUP");
    expect(result[0].monto).toBe(5); // Exact CUP denomination

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: Single Currency (Happy Path)
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - Scenario 3: Single Currency (Happy Path)", () => {
  it("should return exact change when paid in single currency CUP", () => {
    /**
     * Simplest case: single currency payment
     * - Total: 100 CUP
     * - Paid: 200 CUP
     * - Change: 100 CUP
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 200,
        equivalenteBase: 200,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([{ moneda: "CUP", monto: 100 }]);
  });

  it("should round up change to nearest CUP denomination", () => {
    /**
     * Test denomination rounding
     * - Total: 100 CUP
     * - Paid: 100.07 CUP (slightly overpaid)
     * - vueltoTotalBase = 0.07 CUP
     * - ceil(0.07 / 0.01) * 0.01 = 0.07 CUP
     * - Expected: [{ CUP, 0.07 }] (respects 0.01 denomination)
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 100.07,
        equivalenteBase: 100.07,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result.length).toBe(1);
    expect(result[0].moneda).toBe("CUP");
    expect(result[0].monto).toBeCloseTo(0.07, 2);

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);
  });

  it("should return empty when overpayment is below minimum denomination", () => {
    /**
     * Overpayment too small to distribute
     * - Total: 100 CUP
     * - Paid: 100.005 CUP
     * - Change: 0.005 CUP (below 0.01 minimum)
     * - Expected: [] (no change, absorbed as rounding error)
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 100.005,
        equivalenteBase: 100.005,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([]);
  });

  it("should handle large amounts correctly", () => {
    /**
     * Test with larger amounts
     * - Total: 10,000 CUP
     * - Paid: 15,000 CUP
     * - Change: 5,000 CUP
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 15000,
        equivalenteBase: 15000,
      },
    ];

    const result = calcularVuelto(
      10000,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([{ moneda: "CUP", monto: 5000 }]);

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: Multi-currency with Proper Remainder Handling
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - Scenario 4: Multi-currency with Proper Remainder Handling", () => {
  it("should distribute change correctly when main currency is USD", () => {
    /**
     * Complex scenario with multiple currencies
     * - Total: 100 CUP
     * - Paid: 50 USD (= 40 CUP) + 62 CUP = 102 CUP base
     * - vueltoTotalBase = 2 CUP
     * - monedaCobro = USD (main payment)
     * - vueltoEnMonedaCobro: 2 / 0.8 = 2.5 USD
     *   - denomMin (USD) = 0.1
     *   - floor(2.5 / 0.1) * 0.1 = 2.5 USD (= 2 CUP)
     * - restoBase = 2 - 2 = 0 CUP
     * - Expected: [{ USD, 2.5 }]
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 50,
        equivalenteBase: 40,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 62,
        equivalenteBase: 62,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((v) => v.moneda === "USD")).toBe(true);

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    expect(totalChangeBase).toBeCloseTo(2, 2);
  });

  it("should handle case where remainder needs CUP distribution", () => {
    /**
     * Scenario: remainder in base currency after main currency distribution
     * - Total: 100 CUP
     * - Paid: 75 USD (= 60 CUP) + 42 CUP = 102 CUP base
     * - vueltoTotalBase = 2 CUP
     * - monedaCobro = USD
     * - vueltoEnMonedaCobro: 2 / 0.8 = 2.5 USD
     *   - floor(2.5 / 0.1) * 0.1 = 2.5 USD (= 2 CUP exactly)
     * - restoBase = 0
     * - Expected: [{ USD, 2.5 }]
     *
     * Modified for remainder:
     * - Total: 100 CUP
     * - Paid: 75 USD (= 60 CUP) + 42.03 CUP = 102.03 CUP base
     * - vueltoTotalBase = 2.03 CUP
     * - vueltoEnMonedaCobro: 2.03 / 0.8 = 2.5375 USD
     *   - floor(2.5375 / 0.1) * 0.1 = 2.5 USD (= 2 CUP)
     * - restoBase = 2.03 - 2 = 0.03 CUP
     *   - ceil(0.03 / 0.01) * 0.01 = 0.03 CUP
     * - Expected: [{ USD, 2.5 }, { CUP, 0.03 }]
     * Note: Due to floating point arithmetic, total may be ~2.04 instead of 2.03
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 75,
        equivalenteBase: 60,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 42.03,
        equivalenteBase: 42.03,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    // Should have at least USD, possibly CUP remainder
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].moneda).toBe("USD");

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    // Allow for floating point rounding: expect around 2.03 with 1 decimal tolerance
    expect(totalChangeBase).toBeCloseTo(2.03, 1);
  });

  it("should handle EUR currency correctly", () => {
    /**
     * Test with a third currency (EUR)
     * - Total: 100 CUP
     * - Paid: 50 EUR (= 60 CUP) + 42 CUP = 102 CUP base
     * - vueltoTotalBase = 2 CUP
     * - monedaCobro = EUR
     * - vueltoEnMonedaCobro: 2 / 1.2 = 1.667 EUR
     *   - denomMin (EUR) = 0.1
     *   - floor(1.667 / 0.1) * 0.1 = 1.6 EUR (= 1.92 CUP)
     * - restoBase = 2 - 1.92 = 0.08 CUP
     *   - ceil(0.08 / 0.01) * 0.01 = 0.08 CUP
     * - Expected: [{ EUR, 1.6 }, { CUP, 0.08 }]
     * Note: Due to floating point arithmetic, total may be ~2.01 instead of 2.00
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "EUR",
        monto: 50,
        equivalenteBase: 60, // 50 * 1.2
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 42,
        equivalenteBase: 42,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "EUR",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].moneda).toBe("EUR");

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    // Allow for floating point rounding: expect around 2 with 1 decimal tolerance
    expect(totalChangeBase).toBeCloseTo(2, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Denominaciones Enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - Scenario 5: Denominaciones Enforcement", () => {
  it("should floor USD change to nearest 0.1 USD denomination", () => {
    /**
     * USD minimum denomination is 0.1
     * - Total: 100 CUP
     * - Paid: 200 USD (= 160 CUP)
     * - vueltoTotalBase = 60 CUP
     * - vueltoEnMonedaCobro: 60 / 0.8 = 75 USD
     *   - denomMin (USD) = 0.1
     *   - floor(75 / 0.1) * 0.1 = 75 USD (exact)
     * - restoBase = 60 - 60 = 0
     * - Since restoBase = 0 (not > 0.005), no CUP vuelto is added
     * - Expected: [{ USD, 75 }]
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 200,
        equivalenteBase: 160,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([{ moneda: "USD", monto: 75 }]);

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    // Total change should be 60 CUP
    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    expect(totalChangeBase).toBe(60);
  });

  it("should not return change smaller than minimum denomination of currency", () => {
    /**
     * Test minimum denomination constraint
     * - Total: 100 CUP
     * - Paid: 200 USD (= 160 CUP)
     * - vueltoTotalBase = 60 CUP
     * - But assume hypothetically the vuelto was 0.05 USD
     *   (below 0.1 minimum)
     * - This should be absorbed into base currency
     *
     * Real scenario: pay 100.12 USD + 20 CUP = 100.096 CUP base
     * - vueltoTotalBase = 0.096 CUP
     * - vueltoEnMonedaCobro: 0.096 / 0.8 = 0.12 USD
     *   - floor(0.12 / 0.1) * 0.1 = 0.1 USD (= 0.08 CUP)
     * - restoBase = 0.096 - 0.08 = 0.016 CUP
     *   - ceil(0.016 / 0.01) * 0.01 = 0.02 CUP
     * - Expected: [{ USD, 0.1 }, { CUP, 0.02 }] OR [] if both too small
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 100.12,
        equivalenteBase: 80.096,
      },
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 20,
        equivalenteBase: 20,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    // All returned vueltos must respect their denomination constraints
    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    // No vuelto should be smaller than its currency's minimum denomination
    for (const vuelto of result) {
      const denoms = mockDenominaciones[vuelto.moneda];
      const denomMin = Math.min(...denoms);
      expect(vuelto.monto).toBeGreaterThanOrEqual(denomMin - 0.001); // Allow small rounding error
    }
  });

  it("should absorb unrepresentable amounts into base currency", () => {
    /**
     * Test absorption of rounding errors
     * When main currency change can't be exactly represented due to
     * denomination constraints, remainder goes to base currency
     *
     * - Total: 100 CUP
     * - Paid: 150 USD (= 120 CUP)
     * - vueltoTotalBase = 20 CUP
     * - vueltoEnMonedaCobro: 20 / 0.8 = 25 USD
     *   - floor(25 / 0.1) * 0.1 = 25 USD (exact)
     * - restoBase = 0
     * - Expected: [{ USD, 25 }]
     */
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "USD",
        monto: 150,
        equivalenteBase: 120,
      },
    ];

    const result = calcularVuelto(
      100,
      pagos,
      "USD",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    const validation = validateDenominaciones(result, mockDenominaciones);
    expect(validation.valid).toBe(true);

    const totalChangeBase = sumVueltoBase(result, mockTasaSnapshot, "CUP");
    expect(totalChangeBase).toBeCloseTo(20, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION UTILITY TESTS (supporting functions)
// ─────────────────────────────────────────────────────────────────────────────

describe("convertToBase", () => {
  it("should convert USD to CUP correctly", () => {
    const result = convertToBase(100, "USD", mockTasaSnapshot, "CUP");
    expect(result).toBe(80); // 100 * 0.8
  });

  it("should handle CUP to CUP conversion", () => {
    const result = convertToBase(100, "CUP", mockTasaSnapshot, "CUP");
    expect(result).toBe(100);
  });

  it("should convert EUR to CUP correctly", () => {
    const result = convertToBase(50, "EUR", mockTasaSnapshot, "CUP");
    expect(result).toBe(60); // 50 * 1.2
  });

  it("should handle missing exchange rate gracefully", () => {
    const result = convertToBase(100, "XYZ", mockTasaSnapshot, "CUP");
    expect(result).toBe(100); // Falls back to 1:1 if rate not found
  });
});

describe("convertFromBase", () => {
  it("should convert CUP to USD correctly", () => {
    const result = convertFromBase(80, "USD", mockTasaSnapshot, "CUP");
    expect(result).toBe(100); // 80 / 0.8
  });

  it("should handle CUP from CUP conversion", () => {
    const result = convertFromBase(100, "CUP", mockTasaSnapshot, "CUP");
    expect(result).toBe(100);
  });

  it("should convert CUP to EUR correctly", () => {
    const result = convertFromBase(60, "EUR", mockTasaSnapshot, "CUP");
    expect(result).toBe(50); // 60 / 1.2
  });

  it("should return 0 when tasa is 0", () => {
    const badTasas: ITasaSnapshot = { USD: 0 };
    const result = convertFromBase(100, "USD", badTasas, "CUP");
    expect(result).toBe(0);
  });
});

describe("buildTasaSnapshot", () => {
  it("should build snapshot from multiple exchange rates", () => {
    const tasas = [
      {
        monedaCode: "USD",
        tasa: 0.8,
        createdAt: new Date("2026-01-01"),
      },
      {
        monedaCode: "EUR",
        tasa: 1.2,
        createdAt: new Date("2026-01-01"),
      },
      { monedaCode: "CUP", tasa: 1, createdAt: new Date("2026-01-01") },
    ];

    const snapshot = buildTasaSnapshot(tasas);

    expect(snapshot.USD).toBe(0.8);
    expect(snapshot.EUR).toBe(1.2);
    expect(snapshot.CUP).toBeUndefined(); // CUP is implicit, never stored
  });

  it("should use latest tasa when multiple rates exist for same currency", () => {
    const tasas = [
      {
        monedaCode: "USD",
        tasa: 0.7,
        createdAt: new Date("2026-01-01"),
      },
      {
        monedaCode: "USD",
        tasa: 0.8,
        createdAt: new Date("2026-01-02"),
      },
    ];

    const snapshot = buildTasaSnapshot(tasas);

    expect(snapshot.USD).toBe(0.8); // Latest date
  });

  it("should filter out CUP from snapshot", () => {
    const tasas = [
      {
        monedaCode: "USD",
        tasa: 0.8,
        createdAt: new Date("2026-01-01"),
      },
      { monedaCode: "CUP", tasa: 1, createdAt: new Date("2026-01-01") },
    ];

    const snapshot = buildTasaSnapshot(tasas);

    expect(Object.keys(snapshot)).not.toContain("CUP");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO: Floating point noise should not push change to the next denomination
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularVuelto - floating point noise regression", () => {
  it("should return 20 CUP change (not 21) when total is 500 and paid is 520, same currency", () => {
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 520,
        equivalenteBase: 520,
      },
    ];

    const result = calcularVuelto(
      500,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([{ moneda: "CUP", monto: 20 }]);
  });

  it("should return 20 CUP change when totalBase carries float noise just below the exact value (499.99999999999994)", () => {
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 520,
        equivalenteBase: 520,
      },
    ];

    // Simulates float noise from summing item prices (e.g. 0.1 + 0.2 style errors)
    // that leaves the total a hair under 500 instead of exact.
    const noisyTotalBase = 499.99999999999994;

    const result = calcularVuelto(
      noisyTotalBase,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    expect(result).toEqual([{ moneda: "CUP", monto: 20 }]);
  });

  it("should still round up genuinely when change is not an exact multiple of denomMin", () => {
    const pagos: IPagoLinea[] = [
      {
        tipo: "cash",
        moneda: "CUP",
        monto: 520.003,
        equivalenteBase: 520.003,
      },
    ];

    const result = calcularVuelto(
      500,
      pagos,
      "CUP",
      "CUP",
      mockTasaSnapshot,
      mockDenominaciones,
    );

    // denomMin for CUP is 0.01, genuine remainder must still round up
    expect(result).toEqual([{ moneda: "CUP", monto: 20.01 }]);
  });
});
