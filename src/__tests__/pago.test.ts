import { describe, it, expect } from "vitest";
import { pagoLineaSchema } from "@/schemas/pago";

/**
 * F-029, criterion 12 (ADR 0104, decision 1). Credit is `Venta.creditoBase`, never a
 * line of `pagosDetalle`: `pagoLineaSchema.tipo` stays `z.enum(["cash", "transfer"])`.
 * This is the test that documents the decision and would catch anyone reverting it by
 * accident (contract § 3.5).
 */
describe("pagoLineaSchema", () => {
  it("still rejects tipo: 'credit' (criterion 12)", () => {
    const result = pagoLineaSchema.safeParse({
      tipo: "credit",
      moneda: "CUP",
      monto: 1,
      equivalenteBase: 1,
    });
    expect(result.success).toBe(false);
  });

  it("still accepts the two forms of payment physically received: cash and transfer", () => {
    expect(
      pagoLineaSchema.safeParse({
        tipo: "cash",
        moneda: "CUP",
        monto: 1,
        equivalenteBase: 1,
      }).success,
    ).toBe(true);
    expect(
      pagoLineaSchema.safeParse({
        tipo: "transfer",
        moneda: "CUP",
        monto: 1,
        equivalenteBase: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects any other made-up tipo just as it would 'credit' — the enum is closed to exactly two values", () => {
    expect(
      pagoLineaSchema.safeParse({
        tipo: "voucher",
        moneda: "CUP",
        monto: 1,
        equivalenteBase: 1,
      }).success,
    ).toBe(false);
  });
});
