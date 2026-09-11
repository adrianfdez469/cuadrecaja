import { describe, it, expect } from "vitest";
import {
  REPORTS_CREDIT_COPY,
  REPORTS_CREDIT_TEST_IDS,
} from "@/constants/reportesCredito";

/**
 * F-039 (design contract § 0.1; spec contract § 5.2, § 8.3.F; E-035 4th
 * appearance — this file is the amendment the `ui-designer` asked for on
 * 2026-09-10, before step 5).
 *
 * `toFixed` is locale-independent (E-033's new variant): it always produces a
 * decimal POINT, never a comma, unlike `formatAmount`. Both conventions
 * coexist on the same screen, so this suite pins the point deliberately.
 *
 * Each function member is asserted with TWO values (E-008): with only one,
 * `toFixed` cannot distinguish a correct implementation from a broken one —
 * any constant string would pass a single-value check.
 */

describe("REPORTS_CREDIT_COPY — the two function members", () => {
  it("kpiShareNote formats a share with one decimal and a literal point, for two distinct inputs", () => {
    expect(REPORTS_CREDIT_COPY.kpiShareNote(50)).toBe(
      "50.0% del total vendido",
    );
    expect(REPORTS_CREDIT_COPY.kpiShareNote(0)).toBe(
      "0.0% del total vendido",
    );
  });

  it("kpiCreditNote appends the credit-specific tail after the MIDDLE DOT (U+00B7), for two distinct inputs", () => {
    expect(REPORTS_CREDIT_COPY.kpiCreditNote(50)).toBe(
      "50.0% del total vendido · no entró a caja",
    );
    expect(REPORTS_CREDIT_COPY.kpiCreditNote(0)).toBe(
      "0.0% del total vendido · no entró a caja",
    );
  });

  it("the separator is U+00B7 (MIDDLE DOT), never U+002D (hyphen-minus) or U+2014 (em dash) — compared by code point, not by eye", () => {
    const note = REPORTS_CREDIT_COPY.kpiCreditNote(50);
    const separatorIndex = note.indexOf("·");

    expect(separatorIndex).toBeGreaterThan(-1);
    expect(note.codePointAt(separatorIndex)).toBe(0x00b7);
    expect(note).not.toContain("-");
    expect(note).not.toContain("—");
  });

  it("composition property: kpiCreditNote(s) starts with kpiShareNote(s), for at least two values of s — what makes it legitimate to read the 'Efectivo' note by EQUALITY rather than substring", () => {
    for (const s of [50, 0]) {
      expect(REPORTS_CREDIT_COPY.kpiCreditNote(s).startsWith(
        REPORTS_CREDIT_COPY.kpiShareNote(s),
      )).toBe(true);
    }
  });
});

describe("REPORTS_CREDIT_COPY — the nine string literals", () => {
  const stringKeys = [
    "kpiCreditLabel",
    "kpiCollectedNote",
    "mixRowLabel",
    "mixNotCollectedCell",
    "mixNote",
    "incomeBlockTitle",
    "incomeGrantedLabel",
    "incomeCollectedLabel",
    "incomeBlockCaption",
  ] as const;

  it("exist and are non-empty strings — the exact wording is QA's to compare, character for character, against the design contract", () => {
    for (const key of stringKeys) {
      const value = REPORTS_CREDIT_COPY[key];
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("has exactly the eleven members the design contract fixes: nine strings and two functions", () => {
    const keys = Object.keys(REPORTS_CREDIT_COPY);
    expect(keys).toHaveLength(11);
    expect(typeof REPORTS_CREDIT_COPY.kpiShareNote).toBe("function");
    expect(typeof REPORTS_CREDIT_COPY.kpiCreditNote).toBe("function");
  });
});

describe("REPORTS_CREDIT_TEST_IDS", () => {
  it("has exactly twelve keys", () => {
    expect(Object.keys(REPORTS_CREDIT_TEST_IDS)).toHaveLength(12);
  });

  it("has twelve DISTINCT values — a duplicate anchor would invalidate every criterion that reads it", () => {
    const values = Object.values(REPORTS_CREDIT_TEST_IDS);
    expect(new Set(values).size).toBe(12);
  });

  it("every value is a non-empty string", () => {
    for (const value of Object.values(REPORTS_CREDIT_TEST_IDS)) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});
