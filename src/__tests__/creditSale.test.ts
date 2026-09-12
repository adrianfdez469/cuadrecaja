import { describe, it, expect } from "vitest";

/**
 * F-034, contract § 6.1 — `src/app/pos/utils/creditSale.ts`, NEW.
 *
 * The four pure functions of the checkout side of the feature, and the fix for bugs 1
 * and 2 of the dossier (`.agents/cuentas-por-cobrar.md` § 4): `handleMakePay` lives in a
 * `.tsx` and no symbol of a `.tsx` is importable from a test (E-015), so all decidable
 * logic has to live here to be testable at all.
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019).
 */
const {
  creditoBaseFor,
  buildCreditExtras,
  canSellOnCredit,
  coversSaleTotal,
  persistedCashBase,
} = await import("@/app/pos/utils/creditSale");

describe("creditoBaseFor — THE ONLY definition of the debt a sale leaves", () => {
  it("returns 0 with no selection, regardless of whether the payment covers the total", () => {
    expect(creditoBaseFor(null, 1000, 0)).toBe(0);
    expect(creditoBaseFor(null, 1000, 1000)).toBe(0);
  });

  it("criterion 2: full credit — nothing paid, the whole total goes on credit", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    expect(creditoBaseFor(sel, 1000, 0)).toBe(1000);
  });

  it("criterion 3: partial credit — 600 paid on a 1000 total leaves 400 on credit", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    expect(creditoBaseFor(sel, 1000, 600)).toBe(400);
  });

  it("criterion 7: overpaying (1200 over 1000) with credit selected leaves ZERO debt, not a negative number", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    expect(creditoBaseFor(sel, 1000, 1200)).toBe(0);
  });

  it("an exact payment leaves no debt even with a customer selected", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    expect(creditoBaseFor(sel, 1000, 1000)).toBe(0);
  });

  it("rounds to two decimals", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    // 100.005 of debt should not surface floating point noise beyond two decimals.
    expect(creditoBaseFor(sel, 100.336, 0)).toBeCloseTo(100.34, 2);
  });

  it("never returns a negative number, even with an absurd overpayment", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    expect(creditoBaseFor(sel, 1000, 999999)).toBe(0);
  });
});

describe("buildCreditExtras — the credit keys of the payload, or nothing", () => {
  it("returns {} with no selection", () => {
    expect(buildCreditExtras(null, 400)).toEqual({});
  });

  it("criterion 7: returns {} when creditoBase is not above zero, EVEN WITH a customer selected — an overpaid credit sale must be indistinguishable from one that never touched credit", () => {
    const sel = { clienteId: "cliente-1", clienteNombre: "Ana" };
    const result = buildCreditExtras(sel, 0);
    expect(result).toEqual({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("includes all three fields when a known customer and a positive credit are given", () => {
    const sel = { clienteId: "u1", clienteNombre: "Ana" };
    expect(buildCreditExtras(sel, 400)).toEqual({
      creditoBase: 400,
      clienteId: "u1",
      clienteNombre: "Ana",
    });
  });

  it("omits the clienteId KEY ENTIRELY (not just sets it to null/undefined) for a brand-new offline customer, because multimonedaExtrasSchema.clienteId is a uuid() that a null would fail", () => {
    const sel = { clienteId: null, clienteNombre: "Ana" };
    const result = buildCreditExtras(sel, 400);
    expect(result).toEqual({ creditoBase: 400, clienteNombre: "Ana" });
    expect(Object.prototype.hasOwnProperty.call(result, "clienteId")).toBe(
      false,
    );
  });
});

describe("coversSaleTotal — bug 1 of the dossier", () => {
  it("bug 1, fixed: a purely-on-credit sale (0 cash, 0 transfer, full credit) now covers the total — this used to be false and dropped the sale blaming the cashier", () => {
    expect(coversSaleTotal(1000, 0, 0, 1000)).toBe(true);
  });

  it("a partial-credit sale covers the total when cash + credit add up", () => {
    expect(coversSaleTotal(1000, 600, 0, 400)).toBe(true);
  });

  it("E-008 note: a creditoBase-0 case that fails is a REGRESSION guard, not proof the bug is fixed — it passes identically with the broken formula", () => {
    expect(coversSaleTotal(1000, 600, 0, 0)).toBe(false);
  });

  it("the discriminating case: falling short even with SOME credit still does not cover", () => {
    expect(coversSaleTotal(1000, 300, 0, 400)).toBe(false);
  });

  it("an ordinary cash sale that covers exactly still covers (no-regression, creditoBase 0)", () => {
    expect(coversSaleTotal(1000, 1000, 0, 0)).toBe(true);
  });

  it("compares in cents, tolerating floating point noise", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE754; the comparison must not be fooled by that.
    expect(coversSaleTotal(0.3, 0.1, 0.2, 0)).toBe(true);
  });
});

describe("persistedCashBase — bug 2 of the dossier", () => {
  it("criterion 3: with a 400 partial credit on a 1000 total and no transfer, persisted cash is 600 — bug 2 would have persisted 1000 (booking the debt as cash in the drawer)", () => {
    expect(persistedCashBase(1000, 0, 400)).toBe(600);
  });

  it("the discriminating case: total 1000, transfer 200, credit 300 — correct cash is 500; the buggy formula (total - totalTransfer only) would give 800", () => {
    expect(persistedCashBase(1000, 200, 300)).toBe(500);
  });

  it("E-008 note: creditoBase 0 reproduces today's exact value — this alone does NOT prove bug 2 is fixed, only that the fix does not regress the ordinary case", () => {
    expect(persistedCashBase(1000, 250, 0)).toBe(750);
  });

  it("is NOT rounded, deliberately: floating point noise from the caller survives unchanged", () => {
    const total = 0.1 + 0.2; // 0.30000000000000004
    expect(persistedCashBase(total, 0, 0)).toBe(total);
  });
});

describe("canSellOnCredit — the only reason the row is disabled is nothing to lend", () => {
  it("the exact boundary: 0 is false, 0.01 is true (E-008: a case with only 1000 vs -5 would not catch an inverted function)", () => {
    expect(canSellOnCredit(0)).toBe(false);
    expect(canSellOnCredit(0.01)).toBe(true);
  });

  it("an ordinary positive amount can go on credit", () => {
    expect(canSellOnCredit(1000)).toBe(true);
  });

  it("a negative amount cannot", () => {
    expect(canSellOnCredit(-5)).toBe(false);
  });

  it("NaN cannot — NaN > 0 is already false, so no bespoke guard should exist for it", () => {
    expect(canSellOnCredit(NaN)).toBe(false);
  });
});
