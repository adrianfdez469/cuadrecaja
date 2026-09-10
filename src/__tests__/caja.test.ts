import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IPagoLinea } from "@/schemas/pago";

/**
 * F-029, criterion 4 — `buildResumenMonedas` (`@/lib/movimiento/caja.ts:144`).
 *
 * `@/lib/movimiento/caja` imports `@/lib/prisma` at module top level; mocked
 * defensively here, same pattern as `tenantScope.test.ts` and `tenantIsolation.test.ts`.
 * Only `buildResumenMonedas` is in scope (contract § 1) — nothing else in the module.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { buildResumenMonedas } = await import("@/lib/movimiento/caja");
const { UNKNOWN_PAYMENT_LINE_TYPE_WARNING } = await import("@/constants/pago");

const cash = (moneda: string, monto: number): IPagoLinea => ({
  tipo: "cash",
  moneda,
  monto,
  equivalenteBase: monto,
});

describe("buildResumenMonedas — unknown payment line type (criterion 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT add a payment line of unknown tipo to totalTransfer NOR to equivalenteBase, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Today's bug (contract § 7.1): this line enters the `else` branch as a transfer
    // AND separately adds to equivalenteBase outside the if/else — double-counted.
    // The fix must move neither number.
    const unknown = {
      tipo: "xxx",
      moneda: "CUP",
      monto: 500,
      equivalenteBase: 500,
    } as unknown as IPagoLinea;

    const resumen = buildResumenMonedas(
      [{ pagosDetalle: [unknown], vueltoDetalle: [], tasaSnapshot: {} }],
      "CUP",
    );

    // The unknown line is the ONLY line of its currency: if it moved anything, that
    // currency's bucket would exist. It must not.
    expect(resumen.find((r) => r.monedaCode === "CUP")).toBeUndefined();
    expect(resumen).toEqual([]);
    expect(warn).toHaveBeenCalledWith(UNKNOWN_PAYMENT_LINE_TYPE_WARNING);

    warn.mockRestore();
  });

  it("does not move the resumen of a currency that ALSO carries a known line — neither field, in the presence of an unknown line of the SAME currency", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unknown = {
      tipo: "xxx",
      moneda: "CUP",
      monto: 999,
      equivalenteBase: 999,
    } as unknown as IPagoLinea;

    const withUnknown = buildResumenMonedas(
      [{ pagosDetalle: [cash("CUP", 100), unknown], tasaSnapshot: {} }],
      "CUP",
    );
    const withoutUnknown = buildResumenMonedas(
      [{ pagosDetalle: [cash("CUP", 100)], tasaSnapshot: {} }],
      "CUP",
    );

    expect(withUnknown).toEqual(withoutUnknown);
  });

  it("still counts cash and transfer lines normally — the guard only intercepts an unrecognized tipo", () => {
    const resumen = buildResumenMonedas(
      [
        {
          pagosDetalle: [
            cash("CUP", 100),
            { tipo: "transfer", moneda: "CUP", monto: 50, equivalenteBase: 50 },
          ],
          tasaSnapshot: {},
        },
      ],
      "CUP",
    );
    expect(resumen).toEqual([
      {
        id: "CUP",
        monedaCode: "CUP",
        totalEfectivo: 100,
        totalTransfer: 50,
        equivalenteBase: 150,
      },
    ]);
  });
});
