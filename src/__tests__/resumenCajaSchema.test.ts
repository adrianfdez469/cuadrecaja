import { describe, it, expect } from "vitest";
import { resumenCajaMonedaSchema } from "@/schemas/resumenCaja";

/**
 * F-032, contract § 7 — `resumenCajaMonedaSchema` gains `cobrosCreditoEfectivo`,
 * required (not `.optional()`): the route always sends it.
 */
describe("resumenCajaMonedaSchema (F-032)", () => {
  const valid = {
    monedaCode: "CUP",
    fondoInicial: 0,
    ventasEfectivo: 100,
    totalEsperado: 130,
    equivalenteBase: 130,
    tipCash: 0,
    cobrosCreditoEfectivo: 30,
  };

  it("accepts a row that carries cobrosCreditoEfectivo", () => {
    expect(resumenCajaMonedaSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a row missing cobrosCreditoEfectivo — it is required, not optional", () => {
    const { cobrosCreditoEfectivo: _omitted, ...withoutField } = valid;
    expect(() => resumenCajaMonedaSchema.parse(withoutField)).toThrow();
  });

  it("keeps ventasEfectivo and cobrosCreditoEfectivo as two distinct numeric fields — a sale is not a debt collection", () => {
    const row = resumenCajaMonedaSchema.parse(valid);
    expect(row.ventasEfectivo).toBe(100);
    expect(row.cobrosCreditoEfectivo).toBe(30);
  });
});
