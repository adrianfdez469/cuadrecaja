import { describe, it, expect } from "vitest";
import {
  changeAvailability,
  changeErrors,
  changeOptions,
  customChangeSplit,
  distributionBase,
  hasChangeErrors,
  mainCashCurrency,
  toVueltoLineas,
} from "@/app/pos/utils/changeMath";
import { changeBase, paidBase } from "@/app/pos/utils/paymentMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

const RATES: ITasaSnapshot = { USD: 350 };
const BASE = "CUP";

const CUP_BILLS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1];
const USD_BILLS = [100, 50, 20, 10, 5, 1];

const denoms =
  (map: Record<string, number[]>) =>
  (currency: string): number[] =>
    map[currency] ?? [];

const STANDARD = denoms({ CUP: CUP_BILLS, USD: USD_BILLS });
const CURRENCIES = ["CUP", "USD"];

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

const splits = (options: { distribution: Record<string, number> }[]) =>
  options.map((option) => option.distribution);

describe("mainCashCurrency", () => {
  it("picks the cash currency with the largest base equivalent", () => {
    const lines = [cash("CUP", 100), cash("USD", 5, "usd")];
    expect(mainCashCurrency(lines, RATES, BASE)).toBe("USD");
  });

  it("sums cash lines that share a currency before choosing", () => {
    // CUP totals 200 across two lines, beating the USD line's 175 base
    // equivalent. Comparing individual lines (100, 100, 175) would wrongly
    // pick USD.
    const lines = [
      cash("CUP", 100, "a"),
      cash("CUP", 100, "b"),
      cash("USD", 0.5, "usd"),
    ];
    expect(mainCashCurrency(lines, RATES, BASE)).toBe("CUP");
  });

  it("ignores transfer lines", () => {
    const lines: PaymentLine[] = [
      cash("CUP", 100),
      { id: "t", kind: "transfer", currency: "USD", amount: 10 },
    ];
    expect(mainCashCurrency(lines, RATES, BASE)).toBe("CUP");
  });

  it("is null when no cash was received", () => {
    expect(mainCashCurrency([], RATES, BASE)).toBeNull();
  });
});

describe("changeOptions", () => {
  it("has nothing to offer when there is no change to give", () => {
    expect(
      changeOptions([cash("CUP", 1250)], 0, RATES, BASE, CURRENCIES, STANDARD),
    ).toEqual([]);
  });

  it("offers a single split when the change is in the base currency", () => {
    const options = changeOptions(
      [cash("CUP", 1500)],
      250,
      RATES,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(splits(options)).toEqual([{ CUP: 250 }]);
  });

  /**
   * The shape recorded 215 times in production: paid with a 100 USD bill,
   * change comes back as whole USD plus the fraction in CUP. Before this,
   * the split was a single line of 63.33 USD — an amount with no bills.
   */
  it("splits a foreign-cash payment into whole bills plus the remainder", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    // 100 USD against a 24 750 CUP total leaves 42 750 CUP = 63.33 USD.
    const options = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );

    expect(splits(options)).toEqual([
      { USD: 63, CUP: 225 },
      { USD: 60, CUP: 2250 },
      { USD: 50, CUP: 9000 },
      { CUP: 42750 },
    ]);
  });

  it("orders the main currency first, as the cashier counts it", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const [best] = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(Object.keys(best.distribution)).toEqual(["USD", "CUP"]);
  });

  it("always offers settling the whole amount in base currency", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const options = changeOptions(
      [cash("USD", 100)],
      6750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(splits(options).at(-1)).toEqual({ CUP: 6750 });
  });

  it("never offers an amount the currency has no bills for", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const options = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    for (const split of splits(options)) {
      if (split.USD !== undefined) expect(split.USD % 1).toBe(0);
    }
  });

  it("every split adds up to the change owed", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const changeAmount = 42750;
    const options = changeOptions(
      [cash("USD", 100)],
      changeAmount,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );

    for (const split of splits(options)) {
      const total = (split.USD ?? 0) * 675 + (split.CUP ?? 0);
      // Both parts are floored to their own bill, so a split may fall short
      // of the debt by less than one CUP but can never exceed it — money
      // leaving the till that the sale never took.
      expect(total).toBeLessThanOrEqual(changeAmount);
      expect(total).toBeGreaterThan(changeAmount - 1);
    }
  });

  it("falls back to base when the change is worth less than one foreign bill", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    // 300 CUP is 0.44 USD — below the 1 USD bill, so there is nothing to
    // denominate in USD and only one way to hand it over.
    const options = changeOptions(
      [cash("USD", 20)],
      300,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(splits(options)).toEqual([{ CUP: 300 }]);
  });

  it("denominates change in base when the sale took no cash", () => {
    const lines: PaymentLine[] = [
      {
        id: "t",
        kind: "transfer",
        currency: "CUP",
        amount: 1500,
        transferDestinationId: "d",
      },
    ];
    expect(
      splits(changeOptions(lines, 250, RATES, BASE, CURRENCIES, STANDARD)),
    ).toEqual([{ CUP: 250 }]);
  });

  it("drops a remainder below the smallest bill instead of rounding it up", () => {
    // CUPT circulates only whole units, so a 0.4 remainder cannot be handed
    // over at all. Rounding it up to 1 would give back 0.6 the sale never
    // took — the bug this module exists to prevent.
    const cupt = denoms({ CUPT: [1], USD: USD_BILLS });
    const rates: ITasaSnapshot = { USD: 600, CUPT: 1 };
    const options = changeOptions(
      [cash("USD", 10)],
      600.4,
      rates,
      "CUPT",
      ["CUPT", "USD"],
      cupt,
    );
    expect(splits(options)[0]).toEqual({ USD: 1 });
  });

  /**
   * The reported bug, in its simplest form: a 2,75 sale covered with 3
   * because CUP has no bill under 1. The 0,25 owed back cannot be handed
   * over in any denomination, so no split is offered and the overpayment
   * stays in the drawer — where the cash count expects it. Rounding it up
   * to a whole CUP took 0,75 out of the till on every fractional sale.
   */
  it("offers no split when the whole change is below the smallest bill", () => {
    expect(
      changeOptions([cash("CUP", 3)], 0.25, RATES, BASE, ["CUP"], STANDARD),
    ).toEqual([]);
  });

  it("truncates a fractional change down to a deliverable bill", () => {
    const options = changeOptions(
      [cash("CUP", 1200)],
      145.99,
      RATES,
      BASE,
      ["CUP"],
      STANDARD,
    );
    expect(splits(options)).toEqual([{ CUP: 145 }]);
  });

  it("never offers a split with a fraction in it", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const options = changeOptions(
      [cash("USD", 100)],
      42750.6,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(options.length).toBeGreaterThan(0);
    for (const split of splits(options)) {
      for (const amount of Object.values(split)) {
        expect(amount % 1).toBe(0);
      }
    }
  });

  /**
   * Casa de Cristal's actual setup: the business is based in USD — the coarse
   * currency — and settles remainders in CUP. Sending the remainder to the
   * base currency instead would round 63.33 USD up to 64 and hand over money
   * that was never owed.
   */
  it("sends the remainder to the finest currency even when base is the coarse one", () => {
    const usdBase = denoms({ USD: USD_BILLS, CUP: CUP_BILLS });
    // Base is USD, so a CUP is worth 1/675 of the base unit.
    const rates: ITasaSnapshot = { USD: 675 };
    const options = changeOptions(
      [cash("USD", 100)],
      // 42 750 CUP expressed in USD. Written as the quotient, not as
      // 63.333333: `changeBase` quantizes on the anchor's cent grid, so the
      // real input is exact to the last CUP and a truncated fixture would
      // floor the remainder a whole bill down.
      42750 / 675,
      rates,
      "USD",
      ["USD", "CUP"],
      usdBase,
    );

    expect(splits(options)[0]).toEqual({ USD: 63, CUP: 225 });
    expect(splits(options).at(-1)).toEqual({ CUP: 42750 });
  });

  it("never hands over more than is owed when base is the coarse currency", () => {
    const usdBase = denoms({ USD: USD_BILLS, CUP: CUP_BILLS });
    const rates: ITasaSnapshot = { USD: 675 };
    const changeAmount = 42750 / 675;
    const options = changeOptions(
      [cash("USD", 100)],
      changeAmount,
      rates,
      "USD",
      ["USD", "CUP"],
      usdBase,
    );

    for (const split of splits(options)) {
      const totalInUsd = (split.USD ?? 0) + (split.CUP ?? 0) / 675;
      expect(totalInUsd).toBeLessThanOrEqual(changeAmount + 0.0001);
      // One CUP of slack, not one USD — the old behaviour would have
      // overshot by up to a whole dollar.
      expect(totalInUsd).toBeGreaterThan(changeAmount - 1 / 675 - 0.0001);
    }
  });

  it("does not repeat a split that two amounts collapse onto", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const options = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    const ids = options.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps ids stable across recomputation but distinct per split", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    const first = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    const again = changeOptions(
      [cash("USD", 100)],
      42750,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(again.map((o) => o.id)).toEqual(first.map((o) => o.id));

    const other = changeOptions(
      [cash("USD", 100)],
      40000,
      rates,
      BASE,
      CURRENCIES,
      STANDARD,
    );
    expect(other[0].id).not.toBe(first[0].id);
  });

  // Regression: USD-based business, 1 USD = 670 CUP, 500-CUP sale paid with
  // 1 USD. The true change is 170 CUP; when the amount due was quantized to
  // base cents upstream (0.75 USD) this produced 168 CUP instead.
  it("gives exact CUP change for a coarse-base overpayment", () => {
    const usdRates: ITasaSnapshot = { USD: 670 };
    const due = 500 / 670;
    const changeAmountBase = 1 - due; // paid 1 USD
    const options = changeOptions(
      [cash("USD", 1)],
      changeAmountBase,
      usdRates,
      "USD",
      CURRENCIES,
      STANDARD,
    );
    // 0.2537 USD is below the smallest USD bill, so all change lands in CUP.
    expect(splits(options)).toEqual([{ CUP: 170 }]);
  });
});

describe("customChangeSplit", () => {
  const split = (amounts: Record<string, number>, changeBase: number) =>
    customChangeSplit(amounts, changeBase, RATES, BASE, CURRENCIES, STANDARD);

  it("settles what the typed amounts leave over in the finest currency", () => {
    // 2 USD = 700 CUP of a 1750 CUP change.
    expect(split({ USD: 2 }, 1750).distribution).toEqual({
      USD: 2,
      CUP: 1050,
    });
  });

  it("gives the whole change in the finest currency when nothing is typed", () => {
    expect(split({}, 1750).distribution).toEqual({ CUP: 1750 });
  });

  it("adds up to the change owed for any typed amount", () => {
    for (const usd of [0, 1, 2.5, 3, 4.75]) {
      const { distribution } = split({ USD: usd }, 1750);
      const total =
        (distribution.USD ?? 0) * RATES.USD + (distribution.CUP ?? 0);
      // Never over: the remainder is floored to the finest bill, so it can
      // fall short by less than one and never hands back money not owed.
      expect(total).toBeLessThanOrEqual(1750);
      expect(total).toBeGreaterThan(1750 - 1);
    }
  });

  it("omits the remainder when it is below the finest bill", () => {
    // 4.99 USD = 1746.5 CUP of a 1747 CUP change: the 0.5 left cannot be
    // handed over, so no CUP line is added and the sale is not blocked.
    const { distribution, overshootBase } = split({ USD: 4.99 }, 1747);
    expect(distribution).toEqual({ USD: 4.99 });
    expect(overshootBase).toBe(0);
  });

  it("accepts amounts off the denomination grid — that is what it is for", () => {
    expect(split({ USD: 2.5 }, 1750).distribution).toEqual({
      USD: 2.5,
      CUP: 875,
    });
  });

  it("ignores an amount typed for the remainder currency itself", () => {
    // It is computed, not stated: honouring it would let the split miss.
    expect(split({ CUP: 9999, USD: 1 }, 1750).distribution).toEqual({
      USD: 1,
      CUP: 1400,
    });
  });

  it("drops the remainder when the typed amounts cover the change exactly", () => {
    expect(split({ USD: 5 }, 1750).distribution).toEqual({ USD: 5 });
  });

  it("reports how far past the change the typed amounts go", () => {
    const { distribution, overshootBase } = split({ USD: 6 }, 1750);
    expect(overshootBase).toBe(350);
    expect(distribution).toEqual({ USD: 6 });
  });

  it("has no overshoot while the typed amounts still fit", () => {
    expect(split({ USD: 4 }, 1750).overshootBase).toBe(0);
  });

  it("keeps the typed currencies ahead of the remainder, as they are counted", () => {
    expect(Object.keys(split({ USD: 2 }, 1750).distribution)).toEqual([
      "USD",
      "CUP",
    ]);
  });

  it("settles the remainder away from base when base is the coarse currency", () => {
    // Casa de Cristal: base USD, remainders in CUP. Rounding a 0.33 USD
    // leftover up to a whole dollar would hand over money never owed.
    // Base is USD, so a CUP is worth 1/350 of the base unit.
    const rates: ITasaSnapshot = { USD: 350 };
    const result = customChangeSplit(
      {},
      63.33,
      rates,
      "USD",
      ["USD", "CUP"],
      STANDARD,
    );
    expect(result.remainderCurrency).toBe("CUP");
    // 63,33 USD is 22 165,5 CUP: floored to the bill, never rounded up.
    expect(result.distribution).toEqual({ CUP: 22165 });
  });
});

/**
 * The reported bug, walked through the real checkout pipeline rather than
 * through `changeOptions` alone: what the cashier types, what the drawer ends
 * up holding, and what the sale records — the three numbers that have to
 * agree for the cash count to come out.
 */
describe("a 2,75 sale in a currency with no coins", () => {
  const TOTAL = 2.75;
  const scenario = (handedOver: number) => {
    const lines = [cash("CUP", handedOver)];
    const change = changeBase(
      paidBase(lines, RATES, BASE),
      TOTAL,
      RATES,
      BASE,
    );
    const options = changeOptions(
      lines,
      change,
      RATES,
      BASE,
      ["CUP"],
      STANDARD,
    );
    const distribution = options[0]?.distribution ?? {};
    return {
      change,
      distribution,
      given: distributionBase(distribution, RATES, BASE),
      vueltoDetalle: toVueltoLineas(distribution),
      /** What `buildResumenMonedas` will expect to find in the drawer. */
      drawerExpects: handedOver - distributionBase(distribution, RATES, BASE),
    };
  };

  it("asks for 3, the smallest amount the customer can actually hand over", () => {
    expect(suggestedAmounts(TOTAL, CUP_BILLS).exact).toBe(3);
  });

  it("hands nothing back and leaves the 0,25 in the drawer", () => {
    const { change, distribution, given, vueltoDetalle } = scenario(3);
    // The overpayment is real...
    expect(change).toBe(0.25);
    // ...but there is no bill for it, so none is offered and none recorded.
    expect(distribution).toEqual({});
    expect(given).toBe(0);
    expect(vueltoDetalle).toEqual([]);
  });

  it("expects exactly the cash that is physically in the drawer", () => {
    // The bug handed back a whole CUP against a 0,25 debt: the count then
    // expected 2 against a 2,75 sale, 0,75 short on every fractional sale.
    expect(scenario(3).drawerExpects).toBe(3);
  });

  it("still gives change when there is a bill to give it in", () => {
    // Paying with 5 owes 2,25 — two CUP are deliverable, the 0,25 is not.
    const { change, distribution, drawerExpects } = scenario(5);
    expect(change).toBe(2.25);
    expect(distribution).toEqual({ CUP: 2 });
    expect(drawerExpects).toBe(3);
  });
});

describe("distributionBase", () => {
  it("is zero for a split with nothing in it", () => {
    expect(distributionBase({}, RATES, BASE)).toBe(0);
  });

  it("adds every currency up in base", () => {
    const rates: ITasaSnapshot = { USD: 675 };
    expect(distributionBase({ USD: 63, CUP: 225 }, rates, BASE)).toBe(42750);
  });

  it("ignores zero amounts", () => {
    expect(distributionBase({ CUP: 250, USD: 0 }, RATES, BASE)).toBe(250);
  });

  it("is what the split hands over, not what is owed", () => {
    // The gap is the point: the checkout shows the green block only when
    // something actually leaves the drawer.
    const options = changeOptions(
      [cash("CUP", 1200)],
      145.99,
      RATES,
      BASE,
      ["CUP"],
      STANDARD,
    );
    expect(distributionBase(options[0].distribution, RATES, BASE)).toBe(145);
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
      CUP: { available: 400, currency: "CUP" },
    });
  });

  it("treats a missing drawer entry as zero", () => {
    expect(changeErrors({ USD: 1 }, [], {})).toEqual({
      USD: { available: 0, currency: "USD" },
    });
  });
});

describe("hasChangeErrors", () => {
  it("is false when every entry is null", () => {
    expect(hasChangeErrors({ CUP: null, USD: null })).toBe(false);
  });

  it("is true when any entry has a message", () => {
    expect(
      hasChangeErrors({ CUP: null, USD: { available: 0, currency: "USD" } }),
    ).toBe(true);
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
