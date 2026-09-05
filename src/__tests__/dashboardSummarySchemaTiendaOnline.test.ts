import { describe, it, expect } from "vitest";
import { dashboardSummarySchema } from "@/schemas/reports/dashboardSummary";

/**
 * F-014 (contract § 6, ADR 0075 § 11.4a) — the other half of criterion 6's
 * cable: "el cable del criterio 6 no llegaba a ninguna pantalla" because
 * `DashboardKpiRow` reads `IDashboardSummary["ventas"]`, not `SalesSummary`
 * directly. This schema is what closes that gap — see
 * `salesSummaryTiendaOnline.test.ts` for the aggregator half.
 */
describe("dashboardSummarySchema.ventas — cantidadVentasTiendaOnline / totalTiendaOnline", () => {
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
    totalTiendaOnline: 250,
  };
  const validSummary = {
    ventas: validVentas,
    topProductos: [],
    topGanancias: [],
    productosMenosVendidos: [],
    productosMenosRentables: [],
  };

  it("accepts a well formed summary carrying both new fields", () => {
    expect(dashboardSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it("accepts cantidadVentasTiendaOnline: 0 and totalTiendaOnline: 0 — a business with no online sales in the range", () => {
    expect(
      dashboardSummarySchema.safeParse({
        ...validSummary,
        ventas: { ...validVentas, cantidadVentasTiendaOnline: 0, totalTiendaOnline: 0 },
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

  it("rejects a summary missing totalTiendaOnline — required, not optional", () => {
    const { totalTiendaOnline: _omitted, ...withoutTotal } = validVentas;

    expect(
      dashboardSummarySchema.safeParse({ ...validSummary, ventas: withoutTotal })
        .success,
    ).toBe(false);
  });
});
