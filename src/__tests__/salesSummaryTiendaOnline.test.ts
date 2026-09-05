import { describe, it, expect } from "vitest";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import type { AggregatorContext } from "@/lib/reports/aggregators/index";
import type { NormalizedSale } from "@/lib/reports/sales-stream";

// `finalize(context)` takes a context this aggregator never reads (it is pure
// over the sales it was `consume()`d with); a fake one satisfies the
// interface's signature without meaning anything to this file's assertions.
const FAKE_CONTEXT = {} as AggregatorContext;

/**
 * F-014 (contract § 6, ADR 0075) — criterion 6, half 1: "un pedido entregado
 * aparece en los reportes de ventas ... con su origen identificable". This is
 * the half that is verifiable WITHOUT a database: `createSummaryAggregator`
 * is a pure function over `NormalizedSale`, and `origen` is a real field of
 * that type — `normalizeSale` (Prisma-backed, out of this file's reach,
 * E-015) derives it, this file only has to fabricate it directly, per module
 * (§ 9.1 lists this aggregator as importable and pure).
 *
 * The other half — that the cable actually reaches `DashboardKpiRow` — is
 * `dashboardSummarySchemaTiendaOnline.test.ts` (ADR 0075 § 11.4a, "el cable
 * del criterio 6 no llegaba a ninguna pantalla").
 */

function makeSale(overrides: Partial<NormalizedSale> = {}): NormalizedSale {
  return {
    id: "sale-1",
    soldAt: new Date("2026-08-01T12:00:00Z"),
    closingPeriodId: "cierre-1",
    sellerId: "user-1",
    collectionCurrency: "CUP",
    rates: {},
    hasRates: true,
    payments: null,
    fallbackCash: 0,
    fallbackTransfer: 0,
    fallbackTransferDestinationId: null,
    grossAmount: 100,
    discountTotal: 0,
    netAmount: 100,
    netProfit: 40,
    lines: [],
    discountsByRule: new Map(),
    origen: "POS",
    ...overrides,
  };
}

describe("createSummaryAggregator — cantidadVentasTiendaOnline / totalTiendaOnline", () => {
  it("starts both new figures at zero", () => {
    const summary = createSummaryAggregator().finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentasTiendaOnline).toBe(0);
    expect(summary.totalTiendaOnline).toBe(0);
  });

  it("a POS sale (origen: POS) never touches either figure — E-008: the same consume() must discriminate by origen, not merely count everything", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(makeSale({ origen: "POS", netAmount: 100 }));

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentas).toBe(1); // it DID count as a sale
    expect(summary.cantidadVentasTiendaOnline).toBe(0);
    expect(summary.totalTiendaOnline).toBe(0);
  });

  it("counts and sums a TIENDA_ONLINE sale", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(makeSale({ origen: "TIENDA_ONLINE", netAmount: 250 }));

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentasTiendaOnline).toBe(1);
    expect(summary.totalTiendaOnline).toBe(250);
  });

  it("with a mix of origins, the two figures count/sum ONLY the online sales, and totalTiendaOnline is PART of totalPeriodo, never on top of it (ADR 0075)", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(makeSale({ origen: "POS", netAmount: 100 }));
    aggregator.consume(makeSale({ origen: "TIENDA_ONLINE", netAmount: 60 }));
    aggregator.consume(makeSale({ origen: "TIENDA_ONLINE", netAmount: 40 }));

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentas).toBe(3);
    expect(summary.cantidadVentasTiendaOnline).toBe(2);
    expect(summary.totalTiendaOnline).toBe(100);
    expect(summary.totalPeriodo).toBe(200);
    expect(summary.totalTiendaOnline).toBeLessThanOrEqual(summary.totalPeriodo);
  });
});
