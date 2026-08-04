import { describe, it, expect } from "vitest";
import {
  autoChangeDistribution,
  changeAvailability,
  changeErrors,
  hasChangeErrors,
  distributedBase,
  toVueltoLineas,
} from "@/app/pos/utils/changeMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

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

describe("autoChangeDistribution", () => {
  it("gives the change in the main cash currency", () => {
    const lines = [cash("CUP", 1500)];
    expect(autoChangeDistribution(lines, 250, RATES, BASE)).toEqual({
      CUP: 250,
    });
  });

  it("picks the cash currency with the largest base equivalent", () => {
    const lines = [cash("CUP", 100), cash("USD", 5, "usd")];
    expect(autoChangeDistribution(lines, 350, RATES, BASE)).toEqual({ USD: 1 });
  });

  it("ignores transfer lines when choosing the currency", () => {
    const lines: PaymentLine[] = [
      cash("CUP", 100),
      { id: "t", kind: "transfer", currency: "USD", amount: 10 },
    ];
    expect(autoChangeDistribution(lines, 50, RATES, BASE)).toEqual({ CUP: 50 });
  });

  it("is empty when there is no change to give", () => {
    expect(autoChangeDistribution([cash("CUP", 1250)], 0, RATES, BASE)).toEqual(
      {},
    );
  });

  it("is empty when no cash was received", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 1500,
        transferDestinationId: "d",
      },
    ];
    expect(autoChangeDistribution(lines, 250, RATES, BASE)).toEqual({});
  });
});

describe("changeAvailability", () => {
  it("adds the cash taken in this sale to the drawer balance", () => {
    const lines = [cash("CUP", 1500)];
    expect(changeAvailability(lines, { CUP: 400 })).toEqual({ CUP: 1900 });
  });

  it("counts only cash, not transfers", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 1000,
        transferDestinationId: "d",
      },
    ];
    expect(changeAvailability(lines, { CUP: 400 })).toEqual({ CUP: 400 });
  });

  it("reports currencies present only in the drawer", () => {
    expect(changeAvailability([], { USD: 12 })).toEqual({ USD: 12 });
  });
});

describe("changeErrors", () => {
  it("has no error when the drawer covers the change", () => {
    const lines = [cash("CUP", 1500)];
    expect(changeErrors({ CUP: 250 }, lines, { CUP: 400 })).toEqual({
      CUP: null,
    });
  });

  it("reports how much is actually available when it falls short", () => {
    const lines: PaymentLine[] = [];
    expect(changeErrors({ CUP: 750 }, lines, { CUP: 400 })).toEqual({
      CUP: "En caja hay 400.00 CUP",
    });
  });

  it("treats a missing drawer entry as zero", () => {
    expect(changeErrors({ USD: 1 }, [], {})).toEqual({
      USD: "En caja hay 0.00 USD",
    });
  });
});

describe("hasChangeErrors", () => {
  it("is false when every entry is null", () => {
    expect(hasChangeErrors({ CUP: null, USD: null })).toBe(false);
  });

  it("is true when any entry has a message", () => {
    expect(hasChangeErrors({ CUP: null, USD: "En caja hay 0.00 USD" })).toBe(
      true,
    );
  });
});

describe("distributedBase", () => {
  it("sums the distribution in base currency", () => {
    expect(distributedBase({ CUP: 400, USD: 1 }, RATES, BASE)).toBe(750);
  });

  it("is zero for an empty distribution", () => {
    expect(distributedBase({}, RATES, BASE)).toBe(0);
  });
});

describe("toVueltoLineas", () => {
  it("maps the distribution to the wire format", () => {
    expect(toVueltoLineas({ CUP: 250 })).toEqual([
      { moneda: "CUP", monto: 250 },
    ]);
  });

  it("drops zero amounts", () => {
    expect(toVueltoLineas({ CUP: 250, USD: 0 })).toEqual([
      { moneda: "CUP", monto: 250 },
    ]);
  });
});
