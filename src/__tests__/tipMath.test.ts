import { describe, it, expect } from "vitest";
import {
  tipLinesFromAmounts,
  tipLinesFromChange,
  tipTotalBase,
  tipTotalFromAmounts,
} from "@/app/pos/utils/tipMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

// 1 USD = 350 CUP; base is CUP.
const RATES: ITasaSnapshot = { USD: 350 };
const BASE = "CUP";

const cash = (
  currency: string,
  amount: number,
  id = currency,
): PaymentLine => ({
  id,
  kind: "cash",
  currency,
  amount,
});

const transfer = (
  currency: string,
  amount: number,
  transferDestinationId = "dest-1",
  id = `${currency}-t`,
): PaymentLine => ({
  id,
  kind: "transfer",
  currency,
  amount,
  transferDestinationId,
});

describe("tipLinesFromChange", () => {
  it("turns a single-currency change split into a cash tip", () => {
    expect(tipLinesFromChange({ CUP: 200 }, RATES, BASE)).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 200, equivalenteBase: 200 },
    ]);
  });

  it("converts each currency of a multi-currency split to base", () => {
    const lines = tipLinesFromChange({ CUP: 150, USD: 2 }, RATES, BASE);
    expect(lines).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 150, equivalenteBase: 150 },
      { tipo: "cash", moneda: "USD", monto: 2, equivalenteBase: 700 },
    ]);
    expect(tipTotalBase(lines, RATES, BASE)).toBe(850);
  });

  it("drops currencies with no amount", () => {
    expect(tipLinesFromChange({ CUP: 200, USD: 0 }, RATES, BASE)).toHaveLength(
      1,
    );
  });

  it("returns nothing for an empty split", () => {
    expect(tipLinesFromChange({}, RATES, BASE)).toEqual([]);
  });
});

describe("tipLinesFromAmounts", () => {
  it("keeps the currency the cashier typed, not the one paid with", () => {
    // Paid in USD, tipped in CUP — the tip must land in the CUP pile.
    const lines = tipLinesFromAmounts(
      { CUP: 300 },
      [cash("USD", 10)],
      RATES,
      BASE,
    );
    expect(lines).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 300, equivalenteBase: 300 },
    ]);
  });

  it("supports a tip split across currencies", () => {
    const lines = tipLinesFromAmounts(
      { CUP: 300, USD: 2 },
      [cash("CUP", 1000)],
      RATES,
      BASE,
    );
    expect(lines).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 300, equivalenteBase: 300 },
      { tipo: "cash", moneda: "USD", monto: 2, equivalenteBase: 700 },
    ]);
    expect(tipTotalBase(lines, RATES, BASE)).toBe(1000);
  });

  it("rides the transfer when that currency was only paid by transfer", () => {
    const lines = tipLinesFromAmounts(
      { CUP: 200 },
      [transfer("CUP", 1000, "dest-9")],
      RATES,
      BASE,
    );
    expect(lines).toEqual([
      {
        tipo: "transfer",
        moneda: "CUP",
        monto: 200,
        equivalenteBase: 200,
        transferDestinationId: "dest-9",
      },
    ]);
  });

  it("prefers cash when the currency was paid both ways", () => {
    const lines = tipLinesFromAmounts(
      { CUP: 200 },
      [transfer("CUP", 1000), cash("CUP", 500)],
      RATES,
      BASE,
    );
    expect(lines[0].tipo).toBe("cash");
    expect(lines[0].transferDestinationId).toBeUndefined();
  });

  it("treats a currency that was not used to pay as cash on the counter", () => {
    const lines = tipLinesFromAmounts(
      { USD: 1 },
      [cash("CUP", 1000)],
      RATES,
      BASE,
    );
    expect(lines).toEqual([
      { tipo: "cash", moneda: "USD", monto: 1, equivalenteBase: 350 },
    ]);
  });

  it("ignores currencies left empty or at zero", () => {
    expect(
      tipLinesFromAmounts({ CUP: 0, USD: 0 }, [cash("CUP", 100)], RATES, BASE),
    ).toEqual([]);
    expect(tipLinesFromAmounts({}, [cash("CUP", 100)], RATES, BASE)).toEqual(
      [],
    );
  });

  it("ignores a transfer line with no amount when picking the method", () => {
    const lines = tipLinesFromAmounts(
      { CUP: 200 },
      [transfer("CUP", 0)],
      RATES,
      BASE,
    );
    expect(lines[0].tipo).toBe("cash");
  });
});

describe("tipTotalFromAmounts", () => {
  it("converts every currency to base", () => {
    expect(tipTotalFromAmounts({ CUP: 300, USD: 2 }, RATES, BASE)).toBe(1000);
  });

  it("skips zero and negative amounts", () => {
    expect(tipTotalFromAmounts({ CUP: 0, USD: -1 }, RATES, BASE)).toBe(0);
  });

  it("returns zero for no amounts", () => {
    expect(tipTotalFromAmounts({}, RATES, BASE)).toBe(0);
  });
});

describe("tipTotalBase", () => {
  it("returns zero for an empty breakdown", () => {
    expect(tipTotalBase([], RATES, BASE)).toBe(0);
  });
});
