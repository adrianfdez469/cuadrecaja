import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildResumenPropinas,
  totalPropinasBase,
  validateTip,
} from "@/lib/tips";
import type { IPagoLinea } from "@/schemas/pago";

// 1 USD = 350 CUP; base is CUP.
const RATES = { USD: 350 };
const BASE = "CUP";

const cash = (
  moneda: string,
  monto: number,
  equivalenteBase: number,
): IPagoLinea => ({
  tipo: "cash",
  moneda,
  monto,
  equivalenteBase,
});

describe("validateTip", () => {
  it("accepts a sale with no tip", () => {
    const result = validateTip({
      total: 1000,
      monedaBase: BASE,
      pagosDetalle: [cash("CUP", 1000, 1000)],
    });
    expect(result.ok).toBe(true);
    expect(result.tipTotal).toBe(0);
    expect(result.tipDetail).toBeNull();
  });

  it("accepts a tip backed by the overpayment", () => {
    const result = validateTip({
      tipTotal: 200,
      tipDetail: [cash("CUP", 200, 200)],
      pagosDetalle: [cash("CUP", 1200, 1200)],
      vueltoDetalle: [],
      tasaSnapshot: {},
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(true);
    expect(result.tipTotal).toBe(200);
  });

  it("rejects a tip with no money behind it", () => {
    const result = validateTip({
      tipTotal: 200,
      tipDetail: [cash("CUP", 200, 200)],
      // Paid exactly the total: there is no overpayment to call a tip.
      pagosDetalle: [cash("CUP", 1000, 1000)],
      vueltoDetalle: [],
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/excede el excedente/);
  });

  it("counts change against the overpayment", () => {
    // Paid 1300 on a 1000 sale but handed 200 back: only 100 can be a tip.
    const base = {
      pagosDetalle: [cash("CUP", 1300, 1300)],
      vueltoDetalle: [{ moneda: "CUP", monto: 200 }],
      tasaSnapshot: {},
      total: 1000,
      monedaBase: BASE,
    };
    expect(
      validateTip({
        ...base,
        tipTotal: 100,
        tipDetail: [cash("CUP", 100, 100)],
      }).ok,
    ).toBe(true);
    expect(
      validateTip({
        ...base,
        tipTotal: 150,
        tipDetail: [cash("CUP", 150, 150)],
      }).ok,
    ).toBe(false);
  });

  it("converts foreign-currency change before comparing", () => {
    // Paid 10 USD (3500) on a 3000 sale, gave 1 USD (350) back → 150 left.
    const result = validateTip({
      tipTotal: 150,
      tipDetail: [cash("CUP", 150, 150)],
      pagosDetalle: [cash("USD", 10, 3500)],
      vueltoDetalle: [{ moneda: "USD", monto: 1 }],
      tasaSnapshot: RATES,
      total: 3000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a breakdown that does not add up to the total", () => {
    const result = validateTip({
      tipTotal: 200,
      tipDetail: [cash("CUP", 50, 50)],
      pagosDetalle: [cash("CUP", 1200, 1200)],
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no coincide/);
  });

  it("requires a breakdown when there is a tip", () => {
    const result = validateTip({
      tipTotal: 200,
      pagosDetalle: [cash("CUP", 1200, 1200)],
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tipDetail es requerido/);
  });

  it("rejects malformed breakdown lines", () => {
    const result = validateTip({
      tipTotal: 200,
      tipDetail: [
        { tipo: "cash", moneda: "CUP", monto: 0, equivalenteBase: 200 },
      ],
      pagosDetalle: [cash("CUP", 1200, 1200)],
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/líneas inválidas/);
  });

  it("tolerates sub-cent float noise", () => {
    const result = validateTip({
      tipTotal: 200,
      tipDetail: [cash("CUP", 200, 199.995)],
      pagosDetalle: [cash("CUP", 1200, 1199.999)],
      total: 1000,
      monedaBase: BASE,
    });
    expect(result.ok).toBe(true);
  });
});

describe("buildResumenPropinas", () => {
  it("groups tips by currency and method", () => {
    const resumen = buildResumenPropinas(
      [
        {
          tipDetail: [
            cash("CUP", 100, 100),
            { tipo: "transfer", moneda: "CUP", monto: 50, equivalenteBase: 50 },
          ],
          tasaSnapshot: {},
        },
        { tipDetail: [cash("CUP", 200, 200)], tasaSnapshot: {} },
      ],
      BASE,
    );
    expect(resumen).toEqual([
      {
        monedaCode: "CUP",
        tipCash: 300,
        tipTransfer: 50,
        equivalenteBase: 350,
      },
    ]);
  });

  it("converts each currency with the sale's own snapshot", () => {
    const resumen = buildResumenPropinas(
      [{ tipDetail: [cash("USD", 2, 700)], tasaSnapshot: RATES }],
      BASE,
    );
    expect(resumen).toEqual([
      { monedaCode: "USD", tipCash: 2, tipTransfer: 0, equivalenteBase: 700 },
    ]);
  });

  it("ignores sales without tips", () => {
    expect(
      buildResumenPropinas([{ tasaSnapshot: {} }, { tipDetail: null }], BASE),
    ).toEqual([]);
  });

  /**
   * F-031, criterion 4 — `buildResumenPropinas` (`@/lib/tips.ts:127`), the sibling of
   * `buildResumenMonedas` in `@/lib/movimiento/caja.ts` (contract § 7.2). Same bug,
   * same fix: today the `equivalenteBase` sum sits OUTSIDE the if/cash/else/transfer
   * branch, so a line with a `tipo` that is neither adds to `equivalenteBase` while
   * also falling into the `else` as if it were a transfer — double-counted.
   *
   * `@/constants/pago` is imported per-test (not at module top level) so that, while
   * it does not exist yet, only these two new cases fail to collect — not the whole
   * file, which already has tests in green (E-026 adenda / E-019).
   */
  describe("unknown payment line type (criterion 4)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("does NOT add a tip line of unknown tipo to tipTransfer NOR to equivalenteBase, and warns", async () => {
      const { UNKNOWN_PAYMENT_LINE_TYPE_WARNING } = await import(
        "@/constants/pago"
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const unknown = {
        tipo: "xxx",
        moneda: "CUP",
        monto: 500,
        equivalenteBase: 500,
      } as unknown as IPagoLinea;

      const resumen = buildResumenPropinas(
        [{ tipDetail: [unknown], tasaSnapshot: {} }],
        BASE,
      );

      // The unknown line is the only one of its currency: if it moved anything, that
      // currency's bucket would exist. It must not.
      expect(resumen).toEqual([]);
      expect(warn).toHaveBeenCalledWith(UNKNOWN_PAYMENT_LINE_TYPE_WARNING);
    });

    it("does not move the resumen of a currency that ALSO carries a known tip line", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const unknown = {
        tipo: "xxx",
        moneda: "CUP",
        monto: 999,
        equivalenteBase: 999,
      } as unknown as IPagoLinea;

      const withUnknown = buildResumenPropinas(
        [{ tipDetail: [cash("CUP", 100, 100), unknown], tasaSnapshot: {} }],
        BASE,
      );
      const withoutUnknown = buildResumenPropinas(
        [{ tipDetail: [cash("CUP", 100, 100)], tasaSnapshot: {} }],
        BASE,
      );
      expect(withUnknown).toEqual(withoutUnknown);
    });
  });
});

describe("totalPropinasBase", () => {
  it("sums the denormalized tip of each sale", () => {
    expect(
      totalPropinasBase([
        { tipTotal: 100 },
        { tipTotal: 0 },
        { tipTotal: 55.5 },
      ]),
    ).toBe(155.5);
  });

  it("treats a missing tip as zero", () => {
    expect(totalPropinasBase([{}, { tipTotal: null }])).toBe(0);
  });
});
