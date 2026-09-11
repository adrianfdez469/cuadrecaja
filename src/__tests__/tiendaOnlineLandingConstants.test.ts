import { describe, it, expect } from "vitest";
import {
  TIENDA_ONLINE_ORDER_LANDING_EFFECTS,
  TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS,
  TIENDA_ONLINE_ORDER_LANDING_BLOCKERS,
  TIENDA_ONLINE_PAYMENT_METHODS,
  TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX,
  TIENDA_ONLINE_API_ERRORS,
} from "@/constants/tiendaOnline";

/**
 * F-014 (contract § 2.2, § 2.4) — the new constants of the online-order landing.
 * These are plain `as const` arrays/objects: what is worth pinning is their
 * MEMBERSHIP (each value the rest of the feature depends on is really there),
 * not merely that the symbol exists.
 */

describe("TIENDA_ONLINE_ORDER_LANDING_EFFECTS", () => {
  it("has exactly the four effects the contract names, in the order documented", () => {
    expect(TIENDA_ONLINE_ORDER_LANDING_EFFECTS).toEqual([
      "RESERVE",
      "RELEASE",
      "SELL",
      "NONE",
    ]);
  });
});

describe("TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS", () => {
  it("has exactly the three causes a line can be skipped for", () => {
    expect(TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS).toEqual([
      "NO_PRODUCT_REFERENCE",
      "PRODUCT_NOT_RESOLVED",
      "INSUFFICIENT_STOCK",
    ]);
  });
});

describe("TIENDA_ONLINE_ORDER_LANDING_BLOCKERS", () => {
  // F-036 (contract § 2.1, § 8.5): gains a FOURTH local reason, UNKNOWN_CLIENTE,
  // appended at the end — this array's order is a vocabulary, not semantic
  // (unlike CREDIT_INVARIANT_VIOLATIONS), so the new member is not inserted.
  it("has exactly the four local reasons DELIVERED can be refused before calling QAB", () => {
    expect(TIENDA_ONLINE_ORDER_LANDING_BLOCKERS).toEqual([
      "NO_OPEN_PERIOD",
      "UNKNOWN_TRANSFER_DESTINATION",
      "MISSING_EXCHANGE_RATE",
      "UNKNOWN_CLIENTE",
    ]);
  });
});

describe("TIENDA_ONLINE_PAYMENT_METHODS", () => {
  // F-036 (contract § 2.1, ADR 0130 amending ADR 0073): gains CREDITO as the
  // third and LAST method — its position is observable (contract § 2.1):
  // PedidoPagoFields walks this array in order to paint rows and to move
  // focus with the arrow keys, so putting CREDITO first would move two rows
  // F-014's own design criteria already fixed (E-018).
  it("has exactly the three payment methods ADR 0073 (amended by ADR 0130) allows, CREDITO last", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHODS).toEqual([
      "EFECTIVO",
      "TRANSFERENCIA",
      "CREDITO",
    ]);
  });
});

describe("TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX", () => {
  it("is the fixed prefix, and never contains PedidoEntrante.code-shaped text", () => {
    expect(TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX).toBe(
      "Pedido tienda online",
    );
    // ADR 0061: the public order code (e.g. "ORD-0001") must never ride along
    // a constant that feeds a movement's `motivo`.
    expect(TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX).not.toMatch(/ORD-/);
  });
});

describe("TIENDA_ONLINE_API_ERRORS.pedidoNotLandable", () => {
  it("is the one new error code F-014 adds, and forbidden/internal stay the sole 403/500 bodies", () => {
    expect(TIENDA_ONLINE_API_ERRORS.pedidoNotLandable).toBe(
      "PEDIDO_NOT_LANDABLE",
    );
    expect(TIENDA_ONLINE_API_ERRORS.forbidden).toBe("FORBIDDEN");
    expect(TIENDA_ONLINE_API_ERRORS.internal).toBe("TIENDA_ONLINE_UNAVAILABLE");
  });
});
