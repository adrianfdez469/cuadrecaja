import { describe, it, expect } from "vitest";
import {
  paidBase,
  pendingInCurrency,
  isMissing,
  changeBase,
  hasMissingTransferDestination,
  toPagoLineas,
  type PaymentLine,
} from "@/app/pos/utils/paymentMath";
import { convertFromBase } from "@/lib/currency";
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

describe("paidBase", () => {
  it("sums a single base-currency line", () => {
    expect(paidBase([cash("CUP", 1500)], RATES, BASE)).toBe(1500);
  });

  it("converts foreign currency lines to base", () => {
    const lines = [cash("CUP", 500), cash("USD", 2, "usd")];
    expect(paidBase(lines, RATES, BASE)).toBe(1200);
  });

  it("returns zero for an empty list", () => {
    expect(paidBase([], RATES, BASE)).toBe(0);
  });
});

describe("pendingInCurrency", () => {
  it("returns the full total when there are no lines", () => {
    expect(pendingInCurrency([], 1250, "CUP", RATES, BASE)).toBe(1250);
  });

  it("subtracts what other lines already cover", () => {
    const lines = [cash("CUP", 500)];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE)).toBe(750);
  });

  it("expresses the pending amount in the requested currency", () => {
    const lines = [cash("CUP", 550)];
    expect(pendingInCurrency(lines, 1250, "USD", RATES, BASE)).toBe(2);
  });

  it("excludes the line being edited so it does not cancel itself", () => {
    const lines = [cash("CUP", 500, "a"), cash("CUP", 300, "b")];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE, "b")).toBe(750);
  });

  it("excludes a whole card when given several ids", () => {
    // A cash line and the transfer embedded in it, both re-denominated at
    // once: what the card owes must ignore everything the card itself holds.
    const lines = [
      cash("CUP", 500, "a"),
      cash("CUP", 300, "b"),
      { id: "c", kind: "transfer" as const, currency: "CUP", amount: 200 },
    ];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE, ["b", "c"])).toBe(
      750,
    );
  });

  it("never goes negative when the payment overshoots", () => {
    const lines = [cash("CUP", 5000)];
    expect(pendingInCurrency(lines, 1250, "CUP", RATES, BASE)).toBe(0);
  });
});

describe("isMissing", () => {
  it("is true when the paid amount falls short", () => {
    expect(isMissing(1000, 1250, RATES, BASE)).toBe(true);
  });

  it("is false on an exact payment", () => {
    expect(isMissing(1250, 1250, RATES, BASE)).toBe(false);
  });

  it("ignores sub-cent float noise", () => {
    expect(isMissing(0.1 + 0.2, 0.3, RATES, BASE)).toBe(false);
  });
});

describe("changeBase", () => {
  it("returns the overshoot", () => {
    expect(changeBase(1500, 1250, RATES, BASE)).toBe(250);
  });

  it("returns zero when the payment falls short", () => {
    expect(changeBase(1000, 1250, RATES, BASE)).toBe(0);
  });
});

// Regression: business based in a coarse currency (USD) selling CUP-priced
// products. 1 USD = 670 CUP, two 250-CUP items → 500 CUP = 0.746268… USD.
// Quantizing that total to base cents (0.75 USD) used to corrupt everything
// derived from it: it asked 503 CUP when paying in CUP and returned 168 CUP
// of change on a 1-USD payment instead of 170.
describe("coarse base currency (USD business, CUP prices)", () => {
  const USD_RATES: ITasaSnapshot = { USD: 670 };
  const USD_BASE = "USD";
  /** 500 CUP expressed in the USD base, exactly as useCartTotal computes it. */
  const DUE = 500 / 670;

  it("asks exactly 500 CUP when paying in CUP", () => {
    expect(pendingInCurrency([], DUE, "CUP", USD_RATES, USD_BASE)).toBe(500);
  });

  it("suggests 0.75 USD (cent-ceiled) when paying in USD", () => {
    expect(pendingInCurrency([], DUE, "USD", USD_RATES, USD_BASE)).toBe(0.75);
  });

  it("returns 170 CUP of change on a 1 USD payment", () => {
    const paid = paidBase([cash("USD", 1)], USD_RATES, USD_BASE);
    const change = changeBase(paid, DUE, USD_RATES, USD_BASE);
    expect(convertFromBase(change, "CUP", USD_RATES, USD_BASE)).toBeCloseTo(
      170,
      6,
    );
  });

  it("considers an exact 500 CUP payment complete", () => {
    const paid = paidBase([cash("CUP", 500)], USD_RATES, USD_BASE);
    expect(isMissing(paid, DUE, USD_RATES, USD_BASE)).toBe(false);
    expect(changeBase(paid, DUE, USD_RATES, USD_BASE)).toBe(0);
  });

  it("flags a payment short by real CUP even below a base cent", () => {
    // 497 CUP short of 500: 3 CUP ≈ 0.0045 USD — under half a base cent,
    // which the old base-cents comparison silently accepted.
    const paid = paidBase([cash("CUP", 497)], USD_RATES, USD_BASE);
    expect(isMissing(paid, DUE, USD_RATES, USD_BASE)).toBe(true);
  });
});

describe("hasMissingTransferDestination", () => {
  it("flags a transfer line with an amount but no destination", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 100 },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(true);
  });

  it("accepts a transfer line with a destination", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 100,
        transferDestinationId: "dest-1",
      },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(false);
  });

  it("ignores empty transfer lines", () => {
    const lines: PaymentLine[] = [
      { id: "t", kind: "transfer", currency: "CUP", amount: 0 },
    ];
    expect(hasMissingTransferDestination(lines)).toBe(false);
  });

  it("ignores cash lines", () => {
    expect(hasMissingTransferDestination([cash("CUP", 500)])).toBe(false);
  });
});

describe("toPagoLineas", () => {
  it("maps a cash line with its base equivalent", () => {
    expect(toPagoLineas([cash("CUP", 1500)], RATES, BASE)).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 1500, equivalenteBase: 1500 },
    ]);
  });

  it("converts foreign currency amounts to the base equivalent", () => {
    expect(toPagoLineas([cash("USD", 2, "usd")], RATES, BASE)).toEqual([
      { tipo: "cash", moneda: "USD", monto: 2, equivalenteBase: 700 },
    ]);
  });

  it("carries the destination on transfer lines", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 100,
        transferDestinationId: "dest-1",
      },
    ];
    expect(toPagoLineas(lines, RATES, BASE)).toEqual([
      {
        tipo: "transfer",
        moneda: "CUP",
        monto: 100,
        equivalenteBase: 100,
        transferDestinationId: "dest-1",
      },
    ]);
  });

  it("drops lines with no amount, which the schema would reject", () => {
    const lines = [cash("CUP", 1500), cash("USD", 0, "usd")];
    expect(toPagoLineas(lines, RATES, BASE)).toHaveLength(1);
  });

  it("omits transferDestinationId when it is empty rather than sending an empty string", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 100,
        transferDestinationId: "",
      },
    ];
    expect(toPagoLineas(lines, RATES, BASE)[0]).not.toHaveProperty(
      "transferDestinationId",
    );
  });
});
