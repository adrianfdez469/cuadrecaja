import { describe, it, expect, beforeAll } from "vitest";
import { formatCurrency } from "@/utils/formatters";

/**
 * F-036 — `src/app/cierre/utils/creditoCierre.ts` (contract § 3, testability § 9) and
 * `src/app/cierre/utils/creditoCierreCopy.ts` (contract § 4; the twelve literals are
 * frozen in `.agents/designs/F-036.md` § 0).
 *
 * Written against the contract, without reading the implementation.
 *
 * Dynamic import, isolated per `describe` (E-019): while the `implementer` works in
 * parallel neither module — nor any single export of them — is guaranteed to exist yet.
 * Scoping the `await import(...)` inside each block's `beforeAll` means a module that
 * isn't there yet only fails the tests that need it, not the whole file.
 */

describe("CREDIT_FIGURE_EPSILON and CREDIT_TEST_IDS", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let mod: any;

  beforeAll(async () => {
    mod = await import("@/app/cierre/utils/creditoCierre");
  });

  it("CREDIT_FIGURE_EPSILON is half a cent (0.005), not the PropinasCard '> 0' style threshold", () => {
    expect(mod.CREDIT_FIGURE_EPSILON).toBe(0.005);
  });

  it("CREDIT_TEST_IDS declares exactly the eight anchors the contract fixes", () => {
    expect(mod.CREDIT_TEST_IDS).toEqual({
      card: "cierre-credit-card",
      totalsCell: "cierre-totals-cell",
      totalsFootnote: "cierre-totals-footnote",
      currencyGrantedLine: "cierre-credit-granted-line",
      currencyCollectedLine: "cierre-credit-collected-line",
      closeDialogNotice: "cierre-credit-close-notice",
      historyGranted: "resumen-cierre-credit-granted",
      historyCollected: "resumen-cierre-credit-collected",
    });
  });
});

describe("readCreditFlow", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let mod: any;

  beforeAll(async () => {
    mod = await import("@/app/cierre/utils/creditoCierre");
  });

  it("returns zeros for undefined", () => {
    expect(mod.readCreditFlow(undefined)).toEqual({ granted: 0, collected: 0 });
  });

  it("returns zeros for null", () => {
    expect(mod.readCreditFlow(null)).toEqual({ granted: 0, collected: 0 });
  });

  it("returns zeros when both figures are absent from the source object", () => {
    expect(mod.readCreditFlow({})).toEqual({ granted: 0, collected: 0 });
  });

  it("treats NaN and Infinity as absent (0 in that key), never propagated", () => {
    expect(
      mod.readCreditFlow({
        totalCreditoOtorgado: Number.NaN,
        totalCobrosCredito: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ granted: 0, collected: 0 });
  });

  it("reads the two figures of the central scenario: 1000 granted, 300 collected", () => {
    expect(
      mod.readCreditFlow({ totalCreditoOtorgado: 1000, totalCobrosCredito: 300 }),
    ).toEqual({ granted: 1000, collected: 300 });
  });

  it("preserves a negative totalCobrosCredito (ADR 0128 reversal) instead of clamping it to 0", () => {
    expect(
      mod.readCreditFlow({ totalCreditoOtorgado: 0, totalCobrosCredito: -300 }),
    ).toEqual({ granted: 0, collected: -300 });
  });
});

describe("hasCreditToExplain — gate by absolute value and epsilon, not '> 0' (contract § 0 decision 6)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let mod: any;

  beforeAll(async () => {
    mod = await import("@/app/cierre/utils/creditoCierre");
  });

  it("is false when both figures are exactly zero", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: 0 })).toBe(false);
  });

  it("is true when only 'collected' is negative — the sign a '> 0' gate would miss (ADR 0128)", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: -300 })).toBe(true);
  });

  it("is false when 'granted' is inside the epsilon (0.004 < 0.005)", () => {
    expect(mod.hasCreditToExplain({ granted: 0.004, collected: 0 })).toBe(false);
  });

  it("is true one thousandth past the epsilon (0.006 > 0.005) — the pair that proves the gate discriminates", () => {
    expect(mod.hasCreditToExplain({ granted: 0.006, collected: 0 })).toBe(true);
  });

  it("is false when 'collected' is a small negative value inside the epsilon (-0.004)", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: -0.004 })).toBe(false);
  });

  it("is true when 'collected' is a negative value past the epsilon (-0.006)", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: -0.006 })).toBe(true);
  });

  it("is true when granted and collected cancel out numerically — proves the two figures are NOT summed before the gate", () => {
    // A naive `isPresent(granted + collected)` implementation would compute
    // isPresent(1000 + -1000) = isPresent(0) = false here, and this test would
    // catch it. The contract's own docstring for shouldShowCreditColumns says
    // the two sums are "tested separately, never added together"; the same
    // reasoning applies here since hasCreditToExplain ORs the same two figures.
    expect(mod.hasCreditToExplain({ granted: 1000, collected: -1000 })).toBe(true);
  });

  it("is false exactly AT the epsilon (0.005) — the comparison is strict '>', not '>='", () => {
    expect(mod.hasCreditToExplain({ granted: 0.005, collected: 0 })).toBe(false);
  });

  it("is true one ten-thousandth past the epsilon (0.0051)", () => {
    expect(mod.hasCreditToExplain({ granted: 0.0051, collected: 0 })).toBe(true);
  });

  it("is false exactly AT the negative epsilon (-0.005)", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: -0.005 })).toBe(false);
  });

  it("is true one ten-thousandth past the negative epsilon (-0.0051)", () => {
    expect(mod.hasCreditToExplain({ granted: 0, collected: -0.0051 })).toBe(true);
  });
});

describe("shouldShowCreditColumns — permission AND data (contract § 3, criterion 10)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let mod: any;

  beforeAll(async () => {
    mod = await import("@/app/cierre/utils/creditoCierre");
  });

  it("is false without permission, even with plenty of credit data", () => {
    expect(
      mod.shouldShowCreditColumns(false, {
        sumTotalCreditoOtorgado: 1000,
        sumTotalCobrosCredito: 300,
      }),
    ).toBe(false);
  });

  it("is false with permission but no sums at all (undefined)", () => {
    expect(mod.shouldShowCreditColumns(true, undefined)).toBe(false);
  });

  it("is false with permission but null sums", () => {
    expect(mod.shouldShowCreditColumns(true, null)).toBe(false);
  });

  it("is false with permission and both sums exactly zero — a negocio that never fio, even with the permission", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(false);
  });

  it("is true with permission and a non-zero sumTotalCreditoOtorgado alone", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 1000,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(true);
  });

  it("is true with permission and a non-zero sumTotalCobrosCredito alone", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0,
        sumTotalCobrosCredito: 1000,
      }),
    ).toBe(true);
  });

  it("is true when sumTotalCobrosCredito is negative past the epsilon — the reversal case (ADR 0128)", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0,
        sumTotalCobrosCredito: -300,
      }),
    ).toBe(true);
  });

  it("stays inside the epsilon at 0.004 and crosses it at 0.006 — the discriminating pair", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0.004,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(false);
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0.006,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(true);
  });

  it("is true when the two sums cancel out numerically — proves they are tested SEPARATELY, never added (contract's own docstring)", () => {
    // A naive implementation that summed the two axes before comparing against
    // the epsilon would compute isPresent(1000 + -1000) = isPresent(0) = false
    // here. This is the exact scenario the contract's docstring calls out:
    // "The two sums are therefore tested separately, never added together."
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 1000,
        sumTotalCobrosCredito: -1000,
      }),
    ).toBe(true);
  });

  it("is false exactly AT the epsilon (0.005) — the comparison is strict '>', not '>='", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0.005,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(false);
  });

  it("is true one ten-thousandth past the epsilon (0.0051)", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0.0051,
        sumTotalCobrosCredito: 0,
      }),
    ).toBe(true);
  });

  it("is false exactly AT the negative epsilon (-0.005), on the collected axis", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0,
        sumTotalCobrosCredito: -0.005,
      }),
    ).toBe(false);
  });

  it("is true one ten-thousandth past the negative epsilon (-0.0051), on the collected axis", () => {
    expect(
      mod.shouldShowCreditColumns(true, {
        sumTotalCreditoOtorgado: 0,
        sumTotalCobrosCredito: -0.0051,
      }),
    ).toBe(true);
  });
});

describe("resolveCurrencyCreditLines — only the base-currency row, codes compared trimmed/upper-cased (ADR 0131)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let mod: any;

  beforeAll(async () => {
    mod = await import("@/app/cierre/utils/creditoCierre");
  });

  it("returns null for a currency row that is not the base currency", () => {
    expect(
      mod.resolveCurrencyCreditLines("USD", "CUP", { granted: 1000, collected: 300 }),
    ).toBeNull();
  });

  it("matches the base currency despite different case and surrounding spaces", () => {
    expect(
      mod.resolveCurrencyCreditLines(" cup ", "CUP", { granted: 1000, collected: 300 }),
    ).toEqual({ granted: 1000, collected: 300 });
  });

  it("hides only the 'collected' line when totalCobrosCredito is zero, on the base-currency row", () => {
    expect(
      mod.resolveCurrencyCreditLines("CUP", "CUP", { granted: 1000, collected: 0 }),
    ).toEqual({ granted: 1000, collected: null });
  });

  it("hides only the 'granted' line when totalCreditoOtorgado is zero, on the base-currency row", () => {
    expect(
      mod.resolveCurrencyCreditLines("CUP", "CUP", { granted: 0, collected: 300 }),
    ).toEqual({ granted: null, collected: 300 });
  });

  it("returns null on the base-currency row when both figures are exactly zero", () => {
    expect(
      mod.resolveCurrencyCreditLines("CUP", "CUP", { granted: 0, collected: 0 }),
    ).toBeNull();
  });

  // The contract fixes CREDIT_FIGURE_EPSILON for hasCreditToExplain and
  // shouldShowCreditColumns, but does NOT explicitly state whether
  // resolveCurrencyCreditLines compares each figure to that same epsilon or to
  // an exact zero — its worked example only covers collected: 0 -> null. The
  // two cases below are an INFERENCE, not a contract clause: they assume
  // consistency with the gates, since this function decides "is there a line
  // to paint" over the same two figures. Flagged here so a reader a year from
  // now does not mistake this for a fixed guarantee.
  it("[inference, not fixed by the contract] hides 'collected' when it is within the epsilon (0.004), consistent with the gates", () => {
    expect(
      mod.resolveCurrencyCreditLines("CUP", "CUP", { granted: 1000, collected: 0.004 }),
    ).toEqual({ granted: 1000, collected: null });
  });

  it("[inference, not fixed by the contract] shows 'collected' once it is past the epsilon (0.0051)", () => {
    expect(
      mod.resolveCurrencyCreditLines("CUP", "CUP", { granted: 1000, collected: 0.0051 }),
    ).toEqual({ granted: 1000, collected: 0.0051 });
  });
});

describe("CREDIT_COPY — the twelve literals frozen in .agents/designs/F-036.md § 0", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module not guaranteed to exist yet (E-019)
  let copy: any;

  beforeAll(async () => {
    ({ CREDIT_COPY: copy } = await import("@/app/cierre/utils/creditoCierreCopy"));
  });

  it("cardTitle names the FLOW ('Crédito del período'), not the stock", () => {
    expect(copy.cardTitle).toBe("Crédito del período");
  });

  it("cardGrantedLabel is 'Ventas a crédito' — same phrase the currency row and the recalc dialog use", () => {
    expect(copy.cardGrantedLabel).toBe("Ventas a crédito");
  });

  it("cardCollectedLabel is 'Cobros de crédito'", () => {
    expect(copy.cardCollectedLabel).toBe("Cobros de crédito");
  });

  it("cardHint speaks of the period's cash, never 'this drawer'", () => {
    expect(copy.cardHint).toBe(
      "Los cobros ya están dentro del efectivo del período. Las ventas a crédito no: se cobran más adelante.",
    );
  });

  it("currencyGrantedLine states the amount did NOT enter the drawer (criterion 4), with the formatted amount interpolated", () => {
    expect(copy.currencyGrantedLine(formatCurrency(1000))).toBe(
      "Ventas a crédito $1000,00 — ese monto no entró a la caja: no lo restes del conteo",
    );
  });

  it("currencyCollectedLine speaks of the period's cash, not 'this row'", () => {
    expect(copy.currencyCollectedLine(formatCurrency(300))).toBe(
      "Cobros de crédito $300,00 — ya están en el efectivo del período",
    );
  });

  it("totalsFootnote is the note under the net sales cell", () => {
    expect(copy.totalsFootnote(formatCurrency(1000))).toBe("Incluye $1000,00 a crédito");
  });

  it("closeDialogNotice carries both figures and ends stating neither descuadra la caja (criterion 8)", () => {
    expect(copy.closeDialogNotice(formatCurrency(1000), formatCurrency(300))).toBe(
      "Ventas a crédito: $1000,00 · Cobros de crédito: $300,00. Ninguna de las dos descuadra la caja.",
    );
  });

  it("historyGrantedHeader is the one-word header 'Crédito'", () => {
    expect(copy.historyGrantedHeader).toBe("Crédito");
  });

  it("historyCollectedHeader is the one-word header 'Cobros'", () => {
    expect(copy.historyCollectedHeader).toBe("Cobros");
  });

  it("recalcGrantedRow matches cardGrantedLabel — one name for one figure across screens", () => {
    expect(copy.recalcGrantedRow).toBe("Ventas a crédito");
    expect(copy.recalcGrantedRow).toBe(copy.cardGrantedLabel);
  });

  it("recalcCollectedRow matches cardCollectedLabel", () => {
    expect(copy.recalcCollectedRow).toBe("Cobros de crédito");
    expect(copy.recalcCollectedRow).toBe(copy.cardCollectedLabel);
  });
});
