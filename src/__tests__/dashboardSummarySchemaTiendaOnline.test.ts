import { describe, it, expect } from "vitest";
import { dashboardSummarySchema } from "@/schemas/reports/dashboardSummary";

/**
 * F-014 (contract § 6, ADR 0075 § 11.4a) — the other half of criterion 6's
 * cable: "el cable del criterio 6 no llegaba a ninguna pantalla" because
 * `DashboardKpiRow` reads `IDashboardSummary["ventas"]`, not `SalesSummary`
 * directly. This schema is what closes that gap — see
 * `salesSummaryTiendaOnline.test.ts` for the aggregator half.
 *
 * F-024 (contract § 4.1, ADR 0090) renames `totalTiendaOnline` to
 * `totalMercanciaTiendaOnline` and adds two required fields:
 * `totalEnvioTiendaOnline` and `cantidadVentasTiendaOnlineConEnvio`. All
 * three are `z.number()`, required, no `.optional()` / `.nullable()`
 * (contract § 4.1): the absence of online-store activity is a `0`, resolved
 * in the view (`DashboardKpiRow`), never an absent key here.
 */
describe("dashboardSummarySchema.ventas — totalMercanciaTiendaOnline / totalEnvioTiendaOnline / cantidadVentasTiendaOnlineConEnvio", () => {
  const validVentas = {
    totalPeriodo: 1000,
    unidadesVendidas: 20,
    gananciaTotal: 300,
    totalGastos: 50,
    totalMerma: 10,
    totalDevoluciones: 5,
    gananciaFinal: 235,
    productosActivos: 12,
    cantidadVentasTiendaOnline: 3,
    totalMercanciaTiendaOnline: 250,
    totalEnvioTiendaOnline: 40,
    cantidadVentasTiendaOnlineConEnvio: 2,
  };
  const validSummary = {
    ventas: validVentas,
    topProductos: [],
    topGanancias: [],
    productosMenosVendidos: [],
    productosMenosRentables: [],
  };

  it("accepts a well formed summary carrying all four online-store fields", () => {
    expect(dashboardSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it("accepts every online-store field at 0 — a business with no online sales, and none with delivery, in the range", () => {
    expect(
      dashboardSummarySchema.safeParse({
        ...validSummary,
        ventas: {
          ...validVentas,
          cantidadVentasTiendaOnline: 0,
          totalMercanciaTiendaOnline: 0,
          totalEnvioTiendaOnline: 0,
          cantidadVentasTiendaOnlineConEnvio: 0,
        },
      }).success,
    ).toBe(true);
  });

  it("rejects a summary missing cantidadVentasTiendaOnline — required, not optional", () => {
    const { cantidadVentasTiendaOnline: _omitted, ...withoutCount } = validVentas;

    expect(
      dashboardSummarySchema.safeParse({ ...validSummary, ventas: withoutCount })
        .success,
    ).toBe(false);
  });

  it("rejects a summary missing totalMercanciaTiendaOnline — required, not optional", () => {
    const { totalMercanciaTiendaOnline: _omitted, ...withoutMercancia } = validVentas;

    expect(
      dashboardSummarySchema.safeParse({ ...validSummary, ventas: withoutMercancia })
        .success,
    ).toBe(false);
  });

  it("rejects a summary missing totalEnvioTiendaOnline — required, not optional (F-024)", () => {
    const { totalEnvioTiendaOnline: _omitted, ...withoutEnvio } = validVentas;

    expect(
      dashboardSummarySchema.safeParse({ ...validSummary, ventas: withoutEnvio })
        .success,
    ).toBe(false);
  });

  it("rejects a summary missing cantidadVentasTiendaOnlineConEnvio — required, not optional (F-024)", () => {
    const { cantidadVentasTiendaOnlineConEnvio: _omitted, ...withoutConEnvio } =
      validVentas;

    expect(
      dashboardSummarySchema.safeParse({ ...validSummary, ventas: withoutConEnvio })
        .success,
    ).toBe(false);
  });

  it("accepts a ventas object that ALSO carries the retired totalTiendaOnline key — z.object is not strict, so 'sobra el viejo' is not a valid failure mode (contract § 9.4). The only correct assertion is that the NEW field is missing, never that the OLD one is present", () => {
    expect(
      dashboardSummarySchema.safeParse({
        ...validSummary,
        ventas: { ...validVentas, totalTiendaOnline: 250 },
      }).success,
    ).toBe(true);
  });
});
