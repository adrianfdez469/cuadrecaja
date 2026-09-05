import { describe, it, expect } from "vitest";
import {
  orderDeliverySaleNotice,
  orderLandingBlockedCopy,
  orderLandingAppliedNotice,
  orderLandingSkipLines,
  orderLandingAppliedHue,
  TIENDA_ONLINE_PAYMENT_METHOD_LABELS,
} from "@/components/tiendaOnline/orderPresentation";
import {
  TIENDA_ONLINE_ORDER_LANDING_BLOCKERS,
  TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS,
  TIENDA_ONLINE_PAYMENT_METHODS,
} from "@/constants/tiendaOnline";

/**
 * F-014 — the seven pure copy symbols the `ui-designer` levied on
 * `src/components/tiendaOnline/orderPresentation.ts` in the 4b pass (contract
 * § 9.2, "Añadidos por el paso 4b — E-035"). A NEW file, not an extension of
 * `orderPresentation.test.ts`: these seven did not exist when that file's own
 * (already green) tests were written, and importing a not-yet-written symbol
 * into a SHARED file is exactly the collection-phase failure E-019 describes
 * — it would take the whole file down, passing tests included. Isolating them
 * here means a red result stays contained to this file alone.
 *
 * Per contract § 9.2's own warning: four of these seven take `string`, not the
 * narrow union (`IOrderLandingEffect`, `IOrderLandingSkipReason`,
 * `IOrderLandingBlocker`) on purpose — those values cross the wire — so no
 * test here should assert that an unrecognised value throws or is refused.
 */

describe("TIENDA_ONLINE_PAYMENT_METHOD_LABELS", () => {
  it("has a non-empty label for every TIENDA_ONLINE_PAYMENT_METHODS value", () => {
    for (const metodo of TIENDA_ONLINE_PAYMENT_METHODS) {
      expect(TIENDA_ONLINE_PAYMENT_METHOD_LABELS[metodo]).toBeTruthy();
    }
  });
});

describe("orderDeliverySaleNotice", () => {
  it("is defined for a formatted amount", () => {
    expect(orderDeliverySaleNotice("$105.00")).toBeTruthy();
  });

  it("is total: does not throw for null (no delivery fee to report)", () => {
    expect(() => orderDeliverySaleNotice(null)).not.toThrow();
    expect(orderDeliverySaleNotice(null)).toBeTruthy();
  });

  it("distinguishes a real amount from null — the two must not read the same", () => {
    expect(orderDeliverySaleNotice("$105.00")).not.toBe(orderDeliverySaleNotice(null));
  });
});

describe("orderLandingBlockedCopy", () => {
  it.each(TIENDA_ONLINE_ORDER_LANDING_BLOCKERS)(
    "is defined for the known blocker %s",
    (reason) => {
      expect(orderLandingBlockedCopy(reason)).toBeTruthy();
    },
  );

  it("is total over ANY string — a fourth blocker added later must not break the screen", () => {
    expect(() => orderLandingBlockedCopy("A_FUTURE_BLOCKER")).not.toThrow();
    expect(orderLandingBlockedCopy("A_FUTURE_BLOCKER")).toBeTruthy();
  });
});

describe("orderLandingSkipLines", () => {
  const nameByLineaId = new Map([["l-1", "Coca-Cola 500ml"]]);

  it.each(TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS)(
    "produces one line for a skip with the known reason %s",
    (reason) => {
      const lines = orderLandingSkipLines(
        [{ lineaId: "l-1", reason }],
        nameByLineaId,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBeTruthy();
    },
  );

  it("is total: an unknown reason still produces a defined line, not a throw", () => {
    const lines = orderLandingSkipLines(
      [{ lineaId: "l-1", reason: "A_FUTURE_REASON" }],
      nameByLineaId,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBeTruthy();
  });

  it("is total: a lineaId absent from nameByLineaId still produces a defined line, not a throw", () => {
    const lines = orderLandingSkipLines(
      [{ lineaId: "l-unknown", reason: "NO_PRODUCT_REFERENCE" }],
      nameByLineaId,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBeTruthy();
  });

  it("produces one line PER skipped entry, in the order given", () => {
    const lines = orderLandingSkipLines(
      [
        { lineaId: "l-1", reason: "NO_PRODUCT_REFERENCE" },
        { lineaId: "l-2", reason: "INSUFFICIENT_STOCK" },
      ],
      nameByLineaId,
    );

    expect(lines).toHaveLength(2);
  });

  it("returns [] for no skipped lines", () => {
    expect(orderLandingSkipLines([], nameByLineaId)).toEqual([]);
  });
});

describe("orderLandingAppliedNotice", () => {
  const base = {
    label: "Entregado",
    effect: "SELL",
    reservedProducts: 0,
    saleRegistered: true,
    alreadyLanded: false,
  };

  it("is defined for every effect the contract names", () => {
    for (const effect of ["RESERVE", "RELEASE", "SELL", "NONE"]) {
      expect(orderLandingAppliedNotice({ ...base, effect })).toBeTruthy();
    }
  });

  it("SELL: alreadyLanded true and false read differently — the second counter must be told the payment they declared was dropped", () => {
    const first = orderLandingAppliedNotice({ ...base, effect: "SELL", alreadyLanded: false });
    const second = orderLandingAppliedNotice({ ...base, effect: "SELL", alreadyLanded: true });

    expect(first).not.toBe(second);
  });

  it("RESERVE: alreadyLanded true and false read differently — 'ya reservado' replaces the count-of-zero the design chose not to print (E-013)", () => {
    const first = orderLandingAppliedNotice({
      ...base,
      effect: "RESERVE",
      reservedProducts: 2,
      alreadyLanded: false,
    });
    const second = orderLandingAppliedNotice({
      ...base,
      effect: "RESERVE",
      reservedProducts: 0,
      alreadyLanded: true,
    });

    expect(first).not.toBe(second);
  });

  it("RELEASE: alreadyLanded: true never adds a count, REGARDLESS of reservedProducts — the flag has two indistinguishable causes there (already-released or never-reserved) and the amendment to ADR 0072 deliberately refuses to translate it into a sentence (E-013)", () => {
    // The real invariant is not "true and false always match": with
    // alreadyLanded: false the count IS printed (reservedProducts: 5 below
    // reads differently from reservedProducts: 0). The invariant is that
    // alreadyLanded: true suppresses the count NO MATTER what reservedProducts
    // says — proof that the branch is silence, not a coincidence of zero.
    const withCount = orderLandingAppliedNotice({
      ...base,
      effect: "RELEASE",
      reservedProducts: 5,
      alreadyLanded: false,
    });
    const alreadyLandedWithCount = orderLandingAppliedNotice({
      ...base,
      effect: "RELEASE",
      reservedProducts: 5,
      alreadyLanded: true,
    });
    const alreadyLandedWithoutCount = orderLandingAppliedNotice({
      ...base,
      effect: "RELEASE",
      reservedProducts: 0,
      alreadyLanded: true,
    });

    expect(alreadyLandedWithCount).not.toBe(withCount);
    // Same alreadyLanded: true, different reservedProducts — same silence.
    expect(alreadyLandedWithCount).toBe(alreadyLandedWithoutCount);
  });
});

describe("orderLandingAppliedHue", () => {
  it("SELL + alreadyLanded: true is `caution` — the only bad news of these two screens, fixed by the contract itself (§ 9.2)", () => {
    expect(orderLandingAppliedHue("SELL", true)).toBe("caution");
  });

  it("is total: an unrecognised effect string still returns a defined hue, not a throw", () => {
    expect(() => orderLandingAppliedHue("A_FUTURE_EFFECT", false)).not.toThrow();
    expect(["caution", "positive", "negative"]).toContain(
      orderLandingAppliedHue("A_FUTURE_EFFECT", false),
    );
  });

  it("every combination returns one of the three known hues", () => {
    for (const effect of ["RESERVE", "RELEASE", "SELL", "NONE"]) {
      for (const alreadyLanded of [true, false]) {
        expect(["caution", "positive", "negative"]).toContain(
          orderLandingAppliedHue(effect, alreadyLanded),
        );
      }
    }
  });
});
