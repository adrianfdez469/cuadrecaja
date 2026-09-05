import { describe, it, expect } from "vitest";
import { pedidoEntrantePagoSchema } from "@/schemas/tiendaOnline";
import { TIENDA_ONLINE_PAYMENT_METHODS } from "@/constants/tiendaOnline";

const UUID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

/**
 * F-014 (contract § 3.2, ADR 0073) — how an online order's payment is declared.
 * ONE method for the whole amount; `transferDestinationId` is REQUIRED for
 * TRANSFERENCIA and FORBIDDEN for EFECTIVO. The two branches are proven
 * distinguishable (E-008), not merely individually valid.
 */
describe("pedidoEntrantePagoSchema", () => {
  it("accepts EFECTIVO with no transferDestinationId", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "EFECTIVO" }).success,
    ).toBe(true);
  });

  it("rejects EFECTIVO carrying a transferDestinationId — FORBIDDEN for EFECTIVO", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "EFECTIVO",
        transferDestinationId: UUID,
      }).success,
    ).toBe(false);
  });

  it("accepts TRANSFERENCIA with a transferDestinationId", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "TRANSFERENCIA",
        transferDestinationId: UUID,
      }).success,
    ).toBe(true);
  });

  it("rejects TRANSFERENCIA missing transferDestinationId — REQUIRED for TRANSFERENCIA", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "TRANSFERENCIA" }).success,
    ).toBe(false);
  });

  it("rejects a transferDestinationId that is not a UUID", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "TRANSFERENCIA",
        transferDestinationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it.each(TIENDA_ONLINE_PAYMENT_METHODS)(
    "the SAME shape ({ metodo: %s }, no destination) is valid for EFECTIVO and invalid for TRANSFERENCIA",
    (metodo) => {
      const result = pedidoEntrantePagoSchema.safeParse({ metodo });

      expect(result.success).toBe(metodo === "EFECTIVO");
    },
  );

  it("rejects a metodo outside TIENDA_ONLINE_PAYMENT_METHODS", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "BIZUM" }).success,
    ).toBe(false);
  });

  it("rejects a missing metodo", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        transferDestinationId: UUID,
      }).success,
    ).toBe(false);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "EFECTIVO",
        propina: 10,
      }).success,
    ).toBe(false);
  });
});
