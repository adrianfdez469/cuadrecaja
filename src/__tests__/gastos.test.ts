import { describe, expect, it } from "vitest";
import {
  computePercentageBaseTotals,
  type PercentageBaseSale,
} from "@/lib/gastos";
import {
  computeCierreTotals,
  type CierreComputationInput,
  type CierreSale,
  type CierreSaleLine,
} from "@/lib/cierre/computeCierreTotals";

/**
 * F-029 — contract § 5.3, § 12 (ADR 0106).
 *
 * `computePercentageBaseTotals` is the base that PORCENTAJE_VENTAS and
 * PORCENTAJE_GANANCIAS expenses are a percentage OF, moved verbatim from the
 * preview route (`src/app/api/gastos/cierre/[cierreId]/preview/route.ts`) so
 * `apply` stops trusting the body for these two types.
 *
 * Its `totalGanancia` is GROSS of discounts — deliberately the opposite of
 * `computeCierreTotals`'s own `totalGanancia`, which is NET. A test that
 * cannot tell the two apart would let an "unification" of the two formulas
 * through, and that moves real money (contract § 12).
 */

const line = (over: Partial<PercentageBaseSale["productos"][number]> = {}) => ({
  cantidad: 1,
  precio: 0,
  costo: 0,
  monedaPrecioCode: null,
  monedaCostoCode: null,
  ...over,
});

const percentageSale = (
  over: Partial<PercentageBaseSale> = {},
): PercentageBaseSale => ({
  createdAt: new Date("2026-09-08T10:00:00"),
  frontendCreatedAt: null,
  discountTotal: 0,
  tasaSnapshot: null,
  productos: [],
  ...over,
});

const cierreLine = (over: Partial<CierreSaleLine> = {}): CierreSaleLine => ({
  productoTiendaId: "pt-1",
  productoId: "p-1",
  nombre: "Producto",
  cantidad: 1,
  costo: 0,
  precio: 0,
  monedaCostoCode: null,
  monedaPrecioCode: null,
  proveedor: null,
  existencia: 10,
  ...over,
});

const cierreSale = (over: Partial<CierreSale> = {}): CierreSale => ({
  id: "v",
  createdAt: new Date("2026-09-08T10:00:00"),
  discountTotal: 0,
  tipTotal: 0,
  totaltransfer: 0,
  tasaSnapshot: null,
  pagosDetalle: null,
  vueltoDetalle: null,
  tipDetail: null,
  usuario: null,
  transferDestination: null,
  appliedDiscounts: [],
  productos: [],
  ...over,
});

describe("computePercentageBaseTotals", () => {
  it("returns zero for no sales", () => {
    expect(computePercentageBaseTotals([], "CUP", [])).toEqual({
      totalVentas: 0,
      totalGanancia: 0,
    });
  });

  it("totalVentas is gross minus discount, floored at zero PER SALE — same formula the preview route always used", () => {
    const totals = computePercentageBaseTotals(
      [
        percentageSale({
          discountTotal: 3,
          productos: [line({ precio: 10 })],
        }),
        percentageSale({
          discountTotal: 50, // exceeds this sale's own gross of 10
          productos: [line({ precio: 10 })],
        }),
      ],
      "CUP",
      [],
    );
    // Sale 1: 10 - 3 = 7. Sale 2: max(0, 10 - 50) = 0. Total: 7.
    expect(totals.totalVentas).toBeCloseTo(7, 6);
  });

  it("totalGanancia is the sum of (precio - costo) * cantidad, GROSS of discount", () => {
    const totals = computePercentageBaseTotals(
      [
        percentageSale({
          discountTotal: 4, // must NOT reduce totalGanancia
          productos: [line({ precio: 10, costo: 6, cantidad: 2 })],
        }),
      ],
      "CUP",
      [],
    );
    expect(totals.totalGanancia).toBeCloseTo((10 - 6) * 2, 6);
  });

  it("sums multiple product lines and multiple sales", () => {
    const totals = computePercentageBaseTotals(
      [
        percentageSale({
          productos: [
            line({ precio: 10, costo: 4 }),
            line({ precio: 5, costo: 2, cantidad: 3 }),
          ],
        }),
        percentageSale({ productos: [line({ precio: 20, costo: 8 })] }),
      ],
      "CUP",
      [],
    );
    // Ventas: (10+15+20) = 45. Ganancia: (10-4) + (5-2)*3 + (20-8) = 6+9+12 = 27.
    expect(totals.totalVentas).toBeCloseTo(45, 6);
    expect(totals.totalGanancia).toBeCloseTo(27, 6);
  });

  it("THE DISCRIMINATOR (contract § 12): its totalGanancia is GROSS of discounts, while computeCierreTotals's is NET — the two must NOT agree when there is a discount", () => {
    const grossInputs: PercentageBaseSale[] = [
      percentageSale({
        discountTotal: 15,
        productos: [line({ precio: 40, costo: 10, cantidad: 1 })],
      }),
    ];
    const equivalentCierreInputs: CierreComputationInput = {
      monedaBase: "CUP",
      fechaFin: null,
      historialTasas: [],
      ventas: [
        cierreSale({
          discountTotal: 15,
          productos: [cierreLine({ precio: 40, costo: 10, cantidad: 1 })],
        }),
      ],
      gastos: [],
      movimientos: [],
      initialFundAmounts: {},
    };

    const { totalGanancia: grossGanancia } = computePercentageBaseTotals(
      grossInputs,
      "CUP",
      [],
    );
    const { totalGanancia: netGanancia } = computeCierreTotals(
      equivalentCierreInputs,
    ).totals;

    // Gross ganancia: (40 - 10) = 30, untouched by the 15 discount.
    expect(grossGanancia).toBeCloseTo(30, 6);
    // Net ganancia: the single bucket absorbs the whole discount: 30 - 15 = 15.
    expect(netGanancia).toBeCloseTo(15, 6);
    // The two must differ by EXACTLY the discount — proving neither formula
    // silently became the other one.
    expect(grossGanancia - netGanancia).toBeCloseTo(15, 6);
  });

  it("uses frontendCreatedAt over createdAt to resolve the rate, and completes a snapshot missing the base currency from history — same resolution as the rest of the closing engine", () => {
    const historialTasas = [
      {
        monedaCode: "USD",
        tasa: 675,
        createdAt: new Date("2026-09-02T10:00:00Z"),
      },
      {
        monedaCode: "USD",
        tasa: 680,
        createdAt: new Date("2026-09-02T16:50:00Z"),
      },
    ];
    const totals = computePercentageBaseTotals(
      [
        percentageSale({
          createdAt: new Date("2026-09-03T00:00:00Z"), // AFTER both rate updates
          frontendCreatedAt: new Date("2026-09-02T12:00:00Z"), // BEFORE the 680 update
          tasaSnapshot: null,
          productos: [line({ precio: 675, monedaPrecioCode: "CUP" })],
        }),
      ],
      "USD",
      historialTasas,
    );
    // At 12:00 the rate was still 675: 675 CUP == 1 USD, not 675/680.
    expect(totals.totalVentas).toBeCloseTo(1, 6);
  });
});
