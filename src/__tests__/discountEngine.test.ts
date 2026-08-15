import { describe, it, expect } from "vitest";
import {
  applyDiscounts,
  selectApplicableRules,
  type DiscountRuleInput,
  type ProductMeta,
} from "@/lib/discounts/engine";

const NOW = new Date("2026-06-15T12:00:00Z");

function rule(overrides: Partial<DiscountRuleInput> = {}): DiscountRuleInput {
  return {
    id: "r-1",
    name: "Regla",
    type: "PERCENTAGE",
    value: 10,
    appliesTo: "TICKET",
    isActive: true,
    conditions: {},
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

// 2 × 100 + 1 × 50 = 250
const CART = [
  { productoTiendaId: "pt-a", cantidad: 2, precio: 100 },
  { productoTiendaId: "pt-b", cantidad: 1, precio: 50 },
];

const META: Record<string, ProductMeta> = {
  "pt-a": { productoId: "p-a", categoriaId: "cat-bebidas" },
  "pt-b": { productoId: "p-b", categoriaId: "cat-aseo" },
};

describe("selectApplicableRules", () => {
  it("drops inactive rules", () => {
    expect(
      selectApplicableRules([rule({ isActive: false })], undefined, NOW),
    ).toHaveLength(0);
  });

  it("drops rules outside their date window", () => {
    const future = rule({ startDate: "2026-07-01T00:00:00Z" });
    const past = rule({ endDate: "2026-01-01T00:00:00Z" });
    expect(selectApplicableRules([future, past], undefined, NOW)).toHaveLength(
      0,
    );
  });

  it("accepts ISO strings as well as Date objects", () => {
    const withDates = rule({
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: "2026-12-31T00:00:00Z",
    });
    expect(selectApplicableRules([withDates], undefined, NOW)).toHaveLength(1);
  });

  it("keeps a coded rule out until its code is entered", () => {
    const coded = rule({ conditions: { code: "VERANO" } });
    expect(selectApplicableRules([coded], undefined, NOW)).toHaveLength(0);
    expect(selectApplicableRules([coded], ["otro"], NOW)).toHaveLength(0);
    expect(selectApplicableRules([coded], ["verano"], NOW)).toHaveLength(1);
    expect(selectApplicableRules([coded], ["VeRaNo"], NOW)).toHaveLength(1);
  });
});

describe("applyDiscounts", () => {
  it("returns the plain total when there are no rules", () => {
    expect(applyDiscounts({ rules: [], products: CART, now: NOW })).toEqual({
      baseTotal: 250,
      discountTotal: 0,
      finalTotal: 250,
      applied: [],
    });
  });

  it("applies a percentage over the whole ticket", () => {
    const result = applyDiscounts({
      rules: [rule({ value: 10 })],
      products: CART,
      now: NOW,
    });
    expect(result.discountTotal).toBe(25);
    expect(result.finalTotal).toBe(225);
    expect(result.applied[0]).toMatchObject({
      discountRuleId: "r-1",
      amount: 25,
      ruleName: "Regla",
    });
  });

  it("clamps a percentage to the 0-100 range", () => {
    expect(
      applyDiscounts({
        rules: [rule({ value: 500 })],
        products: CART,
        now: NOW,
      }).discountTotal,
    ).toBe(250);
    expect(
      applyDiscounts({
        rules: [rule({ value: -20 })],
        products: CART,
        now: NOW,
      }).discountTotal,
    ).toBe(0);
  });

  it("never lets a fixed amount exceed the affected subtotal", () => {
    const result = applyDiscounts({
      rules: [rule({ type: "FIXED", value: 1000 })],
      products: CART,
      now: NOW,
    });
    expect(result.discountTotal).toBe(250);
    expect(result.finalTotal).toBe(0);
  });

  it("honours minTotal", () => {
    const tooSmall = rule({ conditions: { minTotal: 300 } });
    expect(
      applyDiscounts({ rules: [tooSmall], products: CART, now: NOW })
        .discountTotal,
    ).toBe(0);

    const reached = rule({ conditions: { minTotal: 250 } });
    expect(
      applyDiscounts({ rules: [reached], products: CART, now: NOW })
        .discountTotal,
    ).toBe(25);
  });

  it("scopes a PRODUCT rule to its products", () => {
    const result = applyDiscounts({
      rules: [
        rule({
          appliesTo: "PRODUCT",
          value: 50,
          conditions: { productIds: ["p-a"] },
        }),
      ],
      products: CART,
      productMeta: META,
      now: NOW,
    });
    // 50% of the 200 that pt-a contributes, not of the 250 ticket.
    expect(result.discountTotal).toBe(100);
    expect(result.applied[0].productsAffected).toEqual([
      { productoTiendaId: "pt-a", cantidad: 2 },
    ]);
  });

  it("scopes a CATEGORY rule to its categories", () => {
    const result = applyDiscounts({
      rules: [
        rule({
          appliesTo: "CATEGORY",
          value: 10,
          conditions: { categoryIds: ["cat-aseo"] },
        }),
      ],
      products: CART,
      productMeta: META,
      now: NOW,
    });
    expect(result.discountTotal).toBe(5);
  });

  it("discounts nothing for a scoped rule with no productMeta", () => {
    const result = applyDiscounts({
      rules: [
        rule({
          appliesTo: "PRODUCT",
          value: 50,
          conditions: { productIds: ["p-a"] },
        }),
      ],
      products: CART,
      now: NOW,
    });
    expect(result.discountTotal).toBe(0);
  });

  it("never discounts more than the basket is worth", () => {
    const result = applyDiscounts({
      rules: [
        rule({ id: "r-1", type: "FIXED", value: 200 }),
        rule({ id: "r-2", type: "FIXED", value: 200 }),
      ],
      products: CART,
      now: NOW,
    });
    expect(result.discountTotal).toBe(250);
    expect(result.finalTotal).toBe(0);
  });

  it("skips unimplemented rule types", () => {
    expect(
      applyDiscounts({
        rules: [rule({ type: "BUY_X_GET_Y" })],
        products: CART,
        now: NOW,
      }).discountTotal,
    ).toBe(0);
  });

  it("handles an empty basket", () => {
    expect(
      applyDiscounts({ rules: [rule()], products: [], now: NOW }),
    ).toMatchObject({ baseTotal: 0, discountTotal: 0, finalTotal: 0 });
  });
});
