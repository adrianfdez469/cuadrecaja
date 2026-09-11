import { describe, it, expect } from "vitest";
import { SALE_TOTAL_TOLERANCE_BASE } from "@/constants/venta";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";

/**
 * F-031, criterion 9 — `src/lib/cuentasPorCobrar/creditInvariant.ts` (contract § 5.4).
 * Dynamic import, same E-019 reasoning as the sibling `cuentasPorCobrar*` test files.
 */
const {
  checkCreditInvariant,
  CREDIT_INVARIANT_VIOLATIONS,
  CREDIT_INVARIANT_HTTP_STATUS,
} = await import("@/lib/cuentasPorCobrar/creditInvariant");

const cash = (moneda: string, monto: number, equivalenteBase: number): IPagoLinea => ({
  tipo: "cash",
  moneda,
  monto,
  equivalenteBase,
});

const vuelto = (moneda: string, monto: number): IVueltoLinea => ({ moneda, monto });

describe("CREDIT_INVARIANT_VIOLATIONS", () => {
  it("is exactly the five violations, in evaluation order (the order IS the contract)", () => {
    expect(CREDIT_INVARIANT_VIOLATIONS).toEqual([
      "CREDIT_WITHOUT_CUSTOMER",
      "CREDIT_WITH_CHANGE",
      "CREDIT_WITH_TIP",
      "CREDIT_EXCEEDS_TOTAL",
      "TOTAL_MISMATCH",
    ]);
  });
});

describe("CREDIT_INVARIANT_HTTP_STATUS", () => {
  it("maps CREDIT_WITHOUT_CUSTOMER to 409 and every other violation to 400", () => {
    expect(CREDIT_INVARIANT_HTTP_STATUS).toEqual({
      CREDIT_WITHOUT_CUSTOMER: 409,
      CREDIT_WITH_CHANGE: 400,
      CREDIT_WITH_TIP: 400,
      CREDIT_EXCEEDS_TOTAL: 400,
      TOTAL_MISMATCH: 400,
    });
  });
});

describe("checkCreditInvariant", () => {
  it("ok: true for a plain fully-paid sale (creditoBase 0, no tip, no change)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      pagosDetalle: [cash("CUP", 1000, 1000)],
    });
    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
    expect(result.delta).toBe(0);
    expect(result.creditoBase).toBe(0);
  });

  it("ok: true for a valid credit sale that respects every hard rule", () => {
    // 700 paid + 300 on credit = 1000 total, no change, no tip, a named customer.
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      clienteId: "cliente-1",
      pagosDetalle: [cash("CUP", 700, 700)],
    });
    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
    expect(result.creditoBase).toBe(300);
  });

  it("CREDIT_WITHOUT_CUSTOMER: credit granted with no clienteId (rule 1, checked first)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      pagosDetalle: [cash("CUP", 700, 700)],
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("CREDIT_WITHOUT_CUSTOMER");
  });

  it("CREDIT_WITHOUT_CUSTOMER: an empty-string clienteId counts as absent, same as null or undefined", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      clienteId: "",
      pagosDetalle: [cash("CUP", 700, 700)],
    });
    expect(result.violation).toBe("CREDIT_WITHOUT_CUSTOMER");
  });

  it("CREDIT_WITH_CHANGE: a credit sale that also hands back change (rule 2 looks at the RAW sum of vueltoDetalle.monto, any currency)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      clienteId: "cliente-1",
      pagosDetalle: [cash("CUP", 800, 800)],
      vueltoDetalle: [vuelto("CUP", 100)],
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("CREDIT_WITH_CHANGE");
  });

  it("CREDIT_WITH_TIP: a credit sale that also carries a tip (rule 3)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      clienteId: "cliente-1",
      tipTotal: 50,
      pagosDetalle: [cash("CUP", 750, 750)],
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("CREDIT_WITH_TIP");
  });

  it("CREDIT_EXCEEDS_TOTAL: creditoBase greater than total + tolerance (rule 4)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 1000.02, // > 1000 + 0.01
      clienteId: "cliente-1",
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("CREDIT_EXCEEDS_TOTAL");
  });

  it("CREDIT_EXCEEDS_TOTAL boundary: creditoBase exactly total + tolerance does NOT violate rule 4", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 1000 + SALE_TOTAL_TOLERANCE_BASE,
      clienteId: "cliente-1",
    });
    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
  });

  it("TOTAL_MISMATCH: the paid/change/credit sum does not add up to total + tipTotal beyond tolerance (rule 5)", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      pagosDetalle: [cash("CUP", 900, 900)],
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("TOTAL_MISMATCH");
    expect(result.delta).toBe(-100);
  });

  it("TOTAL_MISMATCH boundary: exactly at tolerance does not violate, one cent past it does", () => {
    const atBoundary = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      pagosDetalle: [cash("CUP", 1000.01, 1000.01)],
    });
    expect(atBoundary.ok).toBe(true);
    expect(atBoundary.violation).toBeNull();

    const pastBoundary = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      pagosDetalle: [cash("CUP", 1000.02, 1000.02)],
    });
    expect(pastBoundary.ok).toBe(false);
    expect(pastBoundary.violation).toBe("TOTAL_MISMATCH");
  });

  it("an explicit tolerance: 0 means EXACT, not 'use the default' — a delta of 0.01 violates at tolerance 0 even though it would pass at the default 0.01", () => {
    // Same one-cent gap as the "TOTAL_MISMATCH boundary" `atBoundary` case above (paid
    // 1000.01 on a 1000 total), which is ok: true there because it sits AT the default
    // tolerance. Here, with tolerance explicitly 0, `Math.abs(0.01) > 0` is true:
    // TOTAL_MISMATCH. A caller that reads tolerance with `Number(tolerance) || DEFAULT`
    // would treat the explicit 0 as falsy, silently fall back to
    // SALE_TOTAL_TOLERANCE_BASE (0.01), and let 0.01 > 0.01 be false — wrongly ok: true.
    // Only `Number.isFinite(tolerance) ? Number(tolerance) : DEFAULT` tells the two
    // apart; this is the one input where two contract-faithful readings diverge.
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      pagosDetalle: [cash("CUP", 1000.01, 1000.01)],
      tolerance: 0,
    });
    expect(result.delta).toBe(0.01);
    expect(result.ok).toBe(false);
    expect(result.violation).toBe("TOTAL_MISMATCH");
  });

  it("THE ORDER IS THE CONTRACT: CREDIT_WITHOUT_CUSTOMER wins over CREDIT_WITH_CHANGE when both apply", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      // no clienteId AND change present: rule 1 must fire, not rule 2.
      pagosDetalle: [cash("CUP", 750, 750)],
      vueltoDetalle: [vuelto("CUP", 50)],
    });
    expect(result.violation).toBe("CREDIT_WITHOUT_CUSTOMER");
  });

  it("THE ORDER IS THE CONTRACT: CREDIT_WITH_CHANGE wins over CREDIT_WITH_TIP when both apply", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 300,
      clienteId: "cliente-1",
      tipTotal: 50,
      pagosDetalle: [cash("CUP", 700, 700)],
      vueltoDetalle: [vuelto("CUP", 20)],
    });
    expect(result.violation).toBe("CREDIT_WITH_CHANGE");
  });

  it("THE ORDER IS THE CONTRACT: CREDIT_EXCEEDS_TOTAL wins over TOTAL_MISMATCH when both apply", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 5000, // exceeds total, AND the arithmetic is also nowhere close
      clienteId: "cliente-1",
    });
    expect(result.violation).toBe("CREDIT_EXCEEDS_TOTAL");
  });

  it("THE ORDER IS THE CONTRACT: the three hard rules run BEFORE CREDIT_EXCEEDS_TOTAL — a credit that both lacks a customer AND exceeds the total is CREDIT_WITHOUT_CUSTOMER, never CREDIT_EXCEEDS_TOTAL", () => {
    // creditoBase satisfies BOTH rule 1 (credit > 0, no clienteId) AND rule 4
    // (credit > total + tolerance). Only the RELATIVE order of "the three hard rules"
    // vs. "CREDIT_EXCEEDS_TOTAL" is exercised here — rules 2 and 3 are kept out of play
    // (no vueltoDetalle, no tipTotal) so the only candidates are 1 and 4. Contract order
    // puts all three hard rules first, so rule 1 must win. An implementation that moved
    // ONLY rule 4 ahead of the hard rules (leaving TOTAL_MISMATCH last) would return
    // CREDIT_EXCEEDS_TOTAL instead — the mutation this test exists to catch.
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: 2000, // > 1000 + tolerance, AND > 0 with no clienteId
    });
    expect(result.violation).toBe("CREDIT_WITHOUT_CUSTOMER");
  });

  it("converts vueltoDetalle through convertToBase against tasaSnapshot, but reads pagosDetalle from its own stored equivalenteBase without reconverting", () => {
    // 10 USD paid (already recorded as 3500 CUP equivalente), 1 USD change (350 CUP),
    // net 3150 CUP kept against a 3000 CUP total => 150 CUP of legitimate tip.
    const result = checkCreditInvariant({
      total: 3000,
      monedaBase: "CUP",
      tipTotal: 150,
      pagosDetalle: [cash("USD", 10, 3500)],
      vueltoDetalle: [vuelto("USD", 1)],
      tasaSnapshot: { USD: 350 },
    });
    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
  });

  it("coerces creditoBase/tipTotal/total/amounts with Number(x) || 0 — undefined, null and NaN read as 0", () => {
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: undefined,
      tipTotal: null,
      pagosDetalle: [cash("CUP", 1000, 1000)],
    });
    expect(result.ok).toBe(true);
    expect(result.creditoBase).toBe(0);
  });

  it("does NOT clamp a negative creditoBase: it does not trigger any of the first four violations by itself, and can still balance the books (documented, not a bug)", () => {
    // creditoBase = -50 (corrupt data that bypassed Zod). Rules 1/3 require
    // creditoBase > 0 and rule 4 requires creditoBase > total + tolerance: none fire.
    // The arithmetic can still balance: 1050 paid - 0 change - 50 "credit" = 1000.
    const result = checkCreditInvariant({
      total: 1000,
      monedaBase: "CUP",
      creditoBase: -50,
      pagosDetalle: [cash("CUP", 1050, 1050)],
    });
    expect(result.ok).toBe(true);
    expect(result.creditoBase).toBe(-50);
  });

  describe("no-regression with creditoBase = 0 (criterion 9)", () => {
    it("a plain sale whose payments equal the total exactly stays ok: true", () => {
      const result = checkCreditInvariant({
        total: 1000,
        monedaBase: "CUP",
        creditoBase: 0,
        pagosDetalle: [cash("CUP", 1000, 1000)],
      });
      expect(result.ok).toBe(true);
    });

    it("an overpayment fully accounted for as change stays ok: true — the shape calcularVuelto produces", () => {
      // Paid 1200, handed back 200 change, credit 0: this is exactly the invariant
      // calcularVuelto already guarantees for every cash sale in this repo.
      const result = checkCreditInvariant({
        total: 1000,
        monedaBase: "CUP",
        creditoBase: 0,
        pagosDetalle: [cash("CUP", 1200, 1200)],
        vueltoDetalle: [vuelto("CUP", 200)],
      });
      expect(result.ok).toBe(true);
    });

    it("a tip and change coexisting is still ok: true when creditoBase is 0 — those two rules are guarded by creditoBase > 0 and must not fire", () => {
      const result = checkCreditInvariant({
        total: 1000,
        monedaBase: "CUP",
        creditoBase: 0,
        tipTotal: 100,
        pagosDetalle: [cash("CUP", 1200, 1200)],
        vueltoDetalle: [vuelto("CUP", 100)],
      });
      expect(result.ok).toBe(true);
    });

    it("an unbacked overpayment (not registered as change) is still TOTAL_MISMATCH with creditoBase 0 — the honestly-documented stricter-than-today qualification (contract § 5.4)", () => {
      const result = checkCreditInvariant({
        total: 1000,
        monedaBase: "CUP",
        creditoBase: 0,
        pagosDetalle: [cash("CUP", 1200, 1200)],
      });
      expect(result.ok).toBe(false);
      expect(result.violation).toBe("TOTAL_MISMATCH");
    });

    it("the same mismatch that fails today (a client total that does not match the persisted lines) still fails here, unrelated to credit", () => {
      const result = checkCreditInvariant({
        total: 500,
        monedaBase: "CUP",
        creditoBase: 0,
        pagosDetalle: [cash("CUP", 900, 900)],
      });
      expect(result.ok).toBe(false);
      expect(result.violation).toBe("TOTAL_MISMATCH");
    });
  });
});
