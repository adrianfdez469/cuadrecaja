import { describe, it, expect } from "vitest";
import { tiendaOnlineTransferDestinationSchema } from "@/schemas/tiendaOnline";

const UUID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

/**
 * F-014 (contract § 3.3, ADR 0074) — one transfer destination of the order's
 * OWN store, as it travels in `GET /api/tienda-online/pedidos/[pedidoId]`.
 * `descripcion` is deliberately NOT part of this projection: it is where an
 * account number gets written, and the delivery dialog only needs to name and
 * preselect a destination.
 */
describe("tiendaOnlineTransferDestinationSchema", () => {
  const valid = { id: UUID, nombre: "Caja principal", default: true };

  it("accepts a well formed destination", () => {
    expect(tiendaOnlineTransferDestinationSchema.safeParse(valid).success).toBe(
      true,
    );
  });

  it("accepts default: false — not every destination is the store's default", () => {
    expect(
      tiendaOnlineTransferDestinationSchema.safeParse({
        ...valid,
        default: false,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(
      tiendaOnlineTransferDestinationSchema.safeParse({
        ...valid,
        id: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing default", () => {
    const { default: _omitted, ...withoutDefault } = valid;

    expect(
      tiendaOnlineTransferDestinationSchema.safeParse(withoutDefault).success,
    ).toBe(false);
  });

  it("rejects a non-boolean default", () => {
    expect(
      tiendaOnlineTransferDestinationSchema.safeParse({
        ...valid,
        default: "true",
      }).success,
    ).toBe(false);
  });

  it("rejects a descripcion key — deliberately not projected, this is where an account number lives (ADR 0074)", () => {
    expect(
      tiendaOnlineTransferDestinationSchema.safeParse({
        ...valid,
        descripcion: "cta 1234-5678",
      }).success,
    ).toBe(false);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      tiendaOnlineTransferDestinationSchema.safeParse({
        ...valid,
        tiendaId: UUID,
      }).success,
    ).toBe(false);
  });
});
