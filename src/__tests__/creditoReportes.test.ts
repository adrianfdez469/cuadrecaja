import { describe, it, expect } from "vitest";
import {
  sumMixByType,
  sumMixCredit,
  mixSharePercent,
  hasCreditKpi,
  hasIncomeStatementCredit,
} from "@/app/reportes/utils/creditoReportes";
import { PAYMENT_MIX_CREDIT_TYPE } from "@/constants/reportes";
import { CREDIT_FIGURE_EPSILON } from "@/app/cierre/utils/creditoCierre";
import type { IPaymentMixRow } from "@/schemas/reports/operationsReport";

/**
 * F-039 (contract § 5.3, § 8.3.C) — the pure helpers that back the two
 * screens' KPIs and conditional blocks. All five are importable and pure
 * (§ 8.1): no `.tsx`, no Prisma.
 */

function makeRow(overrides: Partial<IPaymentMixRow> = {}): IPaymentMixRow {
  return {
    tipo: "cash",
    moneda: "CUP",
    montoOriginal: 0,
    montoBase: 0,
    transacciones: 0,
    participacionPorcentaje: 0,
    estimado: false,
    ...overrides,
  };
}

describe("sumMixByType / sumMixCredit", () => {
  it("adds up the base amount of every row of one type, across at least three rows of two distinct types (E-008: a 0-1 row fixture wouldn't exercise the accumulation)", () => {
    const mix: IPaymentMixRow[] = [
      makeRow({ tipo: "cash", moneda: "CUP", montoBase: 400 }),
      makeRow({ tipo: "cash", moneda: "USD", montoBase: 100 }),
      makeRow({ tipo: PAYMENT_MIX_CREDIT_TYPE, moneda: "CUP", montoBase: 600 }),
    ];

    expect(sumMixByType(mix, "cash")).toBe(500);
    expect(sumMixByType(mix, PAYMENT_MIX_CREDIT_TYPE)).toBe(600);
    expect(sumMixByType(mix, "transfer")).toBe(0);
  });

  it("sumMixCredit is shorthand for sumMixByType(mix, PAYMENT_MIX_CREDIT_TYPE)", () => {
    const mix: IPaymentMixRow[] = [
      makeRow({ tipo: "cash", montoBase: 400 }),
      makeRow({ tipo: PAYMENT_MIX_CREDIT_TYPE, montoBase: 600 }),
    ];

    expect(sumMixCredit(mix)).toBe(sumMixByType(mix, PAYMENT_MIX_CREDIT_TYPE));
    expect(sumMixCredit(mix)).toBe(600);
  });

  it("returns 0 for a type absent from the mix, and for an empty mix", () => {
    expect(sumMixByType([], "cash")).toBe(0);
    expect(
      sumMixByType([makeRow({ tipo: "transfer", montoBase: 100 })], "cash"),
    ).toBe(0);
  });
});

describe("mixSharePercent", () => {
  it("computes a share over the given denominator — the same one participacionPorcentaje is computed over, credit included (criterion 2)", () => {
    expect(mixSharePercent(1000, 2000)).toBe(50);
    expect(mixSharePercent(600, 1000)).toBe(60);
  });

  it("returns 0 when the denominator is not positive, instead of NaN or Infinity", () => {
    expect(mixSharePercent(1000, 0)).toBe(0);
    expect(mixSharePercent(1000, -50)).toBe(0);
  });
});

describe("hasCreditKpi", () => {
  it("is true just above CREDIT_FIGURE_EPSILON and false just below it — the exact half-cent threshold, not an arbitrary one", () => {
    expect(hasCreditKpi(CREDIT_FIGURE_EPSILON + 0.001)).toBe(true);
    expect(hasCreditKpi(CREDIT_FIGURE_EPSILON - 0.001)).toBe(false);
  });

  it("is false for exactly 0, and true for a real credit figure", () => {
    expect(hasCreditKpi(0)).toBe(false);
    expect(hasCreditKpi(1000)).toBe(true);
  });
});

describe("hasIncomeStatementCredit", () => {
  it("is true when otorgado alone is above the threshold, even with cobrado at 0", () => {
    expect(hasIncomeStatementCredit(1000, 0)).toBe(true);
  });

  it("is true when cobrado alone is above the threshold, even with otorgado at 0", () => {
    expect(hasIncomeStatementCredit(0, 300)).toBe(true);
  });

  it("is true for a NEGATIVE cobrado far from zero (ADR 0128 reversal) — compared in absolute value, not filtered out as if it were harmless", () => {
    expect(hasIncomeStatementCredit(0, -300)).toBe(true);
  });

  it("is false when both figures are within CREDIT_FIGURE_EPSILON of zero, negative or positive", () => {
    expect(hasIncomeStatementCredit(0, 0)).toBe(false);
    expect(
      hasIncomeStatementCredit(
        CREDIT_FIGURE_EPSILON - 0.001,
        -(CREDIT_FIGURE_EPSILON - 0.001),
      ),
    ).toBe(false);
  });
});
