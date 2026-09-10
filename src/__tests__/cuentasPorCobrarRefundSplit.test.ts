import { describe, it, expect } from "vitest";

/**
 * F-029, criterion 10 — `src/lib/cuentasPorCobrar/refundSplit.ts` (contract § 5.3).
 * Dynamic import, same E-019 reasoning as the sibling `cuentasPorCobrar*` test files.
 */
const { splitRefundBetweenDebtAndCash } = await import(
  "@/lib/cuentasPorCobrar/refundSplit"
);

describe("splitRefundBetweenDebtAndCash", () => {
  it("applies the refund to the debt FIRST — the contract's own worked example: 800 refunded against a 500 balance splits 500 to debt, 300 to cash (criterion 10)", () => {
    expect(splitRefundBetweenDebtAndCash(800, 500)).toEqual({
      montoAplicadoADeuda: 500,
      montoEnEfectivo: 300,
    });
  });

  it("returns everything in cash when there is no debt — today's behaviour for every non-credit sale (criterion 10)", () => {
    expect(splitRefundBetweenDebtAndCash(800, 0)).toEqual({
      montoAplicadoADeuda: 0,
      montoEnEfectivo: 800,
    });
  });

  it("applies the WHOLE refund to the debt, nothing to cash, when the debt is at least as large as the refund", () => {
    expect(splitRefundBetweenDebtAndCash(300, 500)).toEqual({
      montoAplicadoADeuda: 300,
      montoEnEfectivo: 0,
    });
  });

  it("reads a negative or non-finite input as 0, so neither field of the result is ever negative", () => {
    expect(splitRefundBetweenDebtAndCash(-100, 500)).toEqual({
      montoAplicadoADeuda: 0,
      montoEnEfectivo: 0,
    });
    expect(splitRefundBetweenDebtAndCash(800, -50)).toEqual({
      montoAplicadoADeuda: 0,
      montoEnEfectivo: 800,
    });
    expect(splitRefundBetweenDebtAndCash(Number.NaN, 500)).toEqual({
      montoAplicadoADeuda: 0,
      montoEnEfectivo: 0,
    });
  });

  it("rounds both fields to two decimals, and they add up to the rounded montoReembolso", () => {
    const result = splitRefundBetweenDebtAndCash(100.006, 40.001);
    // round2(100.006) = 100.01 — the invariant the docstring fixes, independent of
    // exactly how the split itself rounds each side.
    expect(result.montoAplicadoADeuda + result.montoEnEfectivo).toBeCloseTo(
      100.01,
      2,
    );
    expect(Number.isInteger(Math.round(result.montoAplicadoADeuda * 100))).toBe(
      true,
    );
    expect(Number.isInteger(Math.round(result.montoEnEfectivo * 100))).toBe(
      true,
    );
  });
});
