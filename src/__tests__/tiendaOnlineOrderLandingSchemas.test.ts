import { describe, it, expect } from "vitest";
import {
  tiendaOnlineOrderLandingSkipSchema,
  tiendaOnlineOrderLandingSchema,
} from "@/schemas/tiendaOnline";
import {
  TIENDA_ONLINE_ORDER_LANDING_EFFECTS,
  TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS,
} from "@/constants/tiendaOnline";

const UUID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

/**
 * F-014 (contract § 3.2) — the two schemas that shape what the PATCH's 200
 * body says the aterrizaje actually did. `landing` is present if and only if
 * `persisted` is true (tested against `tiendaOnlineOrderStatusResultSchema`
 * in `tiendaOnlineSchemas.test.ts`); these two are its internals.
 */
describe("tiendaOnlineOrderLandingSkipSchema", () => {
  it.each(TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS)(
    "accepts the skip reason %s",
    (reason) => {
      expect(
        tiendaOnlineOrderLandingSkipSchema.safeParse({ lineaId: UUID, reason })
          .success,
      ).toBe(true);
    },
  );

  it("rejects a reason outside TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS", () => {
    expect(
      tiendaOnlineOrderLandingSkipSchema.safeParse({
        lineaId: UUID,
        reason: "PRODUCT_DISCONTINUED",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid lineaId", () => {
    expect(
      tiendaOnlineOrderLandingSkipSchema.safeParse({
        lineaId: "not-a-uuid",
        reason: "INSUFFICIENT_STOCK",
      }).success,
    ).toBe(false);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      tiendaOnlineOrderLandingSkipSchema.safeParse({
        lineaId: UUID,
        reason: "INSUFFICIENT_STOCK",
        productoNombre: "should not be here",
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderLandingSchema", () => {
  const validLanding = {
    effect: "RESERVE",
    reservedProducts: 2,
    skipped: [],
    ventaId: null,
    alreadyLanded: false,
  };

  it("accepts a well formed landing block", () => {
    expect(tiendaOnlineOrderLandingSchema.safeParse(validLanding).success).toBe(
      true,
    );
  });

  it.each(TIENDA_ONLINE_ORDER_LANDING_EFFECTS)(
    "accepts the effect %s",
    (effect) => {
      expect(
        tiendaOnlineOrderLandingSchema.safeParse({ ...validLanding, effect })
          .success,
      ).toBe(true);
    },
  );

  it("accepts reservedProducts: 0 — either RESERVE already-landed or NONE, ambiguity is fine at the schema level", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        reservedProducts: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative reservedProducts", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        reservedProducts: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer reservedProducts", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        reservedProducts: 1.5,
      }).success,
    ).toBe(false);
  });

  it("accepts a populated skipped array", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        skipped: [{ lineaId: UUID, reason: "NO_PRODUCT_REFERENCE" }],
      }).success,
    ).toBe(true);
  });

  it("accepts a non-null ventaId — the SELL effect's sale id", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        effect: "SELL",
        ventaId: UUID,
      }).success,
    ).toBe(true);
  });

  it("rejects a ventaId that is not a UUID and not null", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        ventaId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects an effect outside TIENDA_ONLINE_ORDER_LANDING_EFFECTS", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        effect: "REFUND",
      }).success,
    ).toBe(false);
  });

  it.each([true, false])(
    "requires alreadyLanded as a real boolean, %s included — the amendment to ADR 0072",
    (alreadyLanded) => {
      expect(
        tiendaOnlineOrderLandingSchema.safeParse({
          ...validLanding,
          alreadyLanded,
        }).success,
      ).toBe(true);
    },
  );

  it("rejects a missing alreadyLanded", () => {
    const { alreadyLanded: _omitted, ...withoutFlag } = validLanding;

    expect(tiendaOnlineOrderLandingSchema.safeParse(withoutFlag).success).toBe(
      false,
    );
  });

  it("rejects a non-boolean alreadyLanded", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        alreadyLanded: "true",
      }).success,
    ).toBe(false);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      tiendaOnlineOrderLandingSchema.safeParse({
        ...validLanding,
        pedidoId: UUID,
      }).success,
    ).toBe(false);
  });
});
