import { describe, it, expect } from "vitest";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";

/**
 * F-029, criterion 5 — `src/lib/cuentasPorCobrar/saldo.ts` (contract § 5.1).
 *
 * Imported via a dynamic top-level `await import`, same idiom as `tenantScope.test.ts`:
 * this module does not exist until the `implementer` creates it, and destructuring a
 * still-missing named export this way fails locally at the point of use, not at
 * static-import collection time for the whole file (E-019).
 */
const { computeSaldoAlCierre, MOVIMIENTO_CUENTA_POR_COBRAR_SIGN } = await import(
  "@/lib/cuentasPorCobrar/saldo"
);

describe("MOVIMIENTO_CUENTA_POR_COBRAR_SIGN", () => {
  it("is exactly the four documented signs: ABONO/AJUSTE_DEVOLUCION/CONDONACION lower, REVERSION_ABONO raises", () => {
    expect(MOVIMIENTO_CUENTA_POR_COBRAR_SIGN).toEqual({
      ABONO: -1,
      AJUSTE_DEVOLUCION: -1,
      CONDONACION: -1,
      REVERSION_ABONO: 1,
    });
  });
});

describe("computeSaldoAlCierre", () => {
  it("subtracts ABONO, AJUSTE_DEVOLUCION and CONDONACION but ADDS REVERSION_ABONO — all four exercised in ONE test (criterion 5, E-008)", () => {
    // montoOriginal 1000, one movement of each of the four types at 100 each:
    //   1000 - 100(ABONO) - 100(AJUSTE_DEVOLUCION) - 100(CONDONACION) + 100(REVERSION_ABONO) = 800.
    // An implementation that subtracts all four (including REVERSION_ABONO) would give 600.
    const saldo = computeSaldoAlCierre(1000, [
      { tipo: "ABONO", monto: 100 },
      { tipo: "AJUSTE_DEVOLUCION", monto: 100 },
      { tipo: "CONDONACION", monto: 100 },
      { tipo: "REVERSION_ABONO", monto: 100 },
    ]);
    expect(saldo).toBe(800);
  });

  it("returns montoOriginal rounded to two decimals when there are no movements", () => {
    expect(computeSaldoAlCierre(123.456, [])).toBe(123.46);
  });

  it("does not depend on the order of the movements", () => {
    const a = computeSaldoAlCierre(1000, [
      { tipo: "ABONO", monto: 300 },
      { tipo: "REVERSION_ABONO", monto: 50 },
    ]);
    const b = computeSaldoAlCierre(1000, [
      { tipo: "REVERSION_ABONO", monto: 50 },
      { tipo: "ABONO", monto: 300 },
    ]);
    expect(a).toBe(750);
    expect(b).toBe(a);
  });

  it("treats a non-finite or missing monto as 0 (Number(m.monto) || 0)", () => {
    expect(
      computeSaldoAlCierre(500, [
        { tipo: "ABONO", monto: NaN },
        { tipo: "ABONO", monto: undefined as unknown as number },
      ]),
    ).toBe(500);
  });

  it("returns a negative balance as-is, NOT clamped to zero — an over-collected account has to be visible", () => {
    expect(computeSaldoAlCierre(100, [{ tipo: "ABONO", monto: 500 }])).toBe(-400);
  });

  it("treats a tipo outside the sign map as 0 without throwing (only reachable by forcing the type)", () => {
    expect(
      computeSaldoAlCierre(500, [
        {
          tipo: "OTRO" as unknown as ITipoMovimientoCuentaPorCobrar,
          monto: 999,
        },
      ]),
    ).toBe(500);
  });
});
