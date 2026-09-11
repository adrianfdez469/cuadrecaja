import { describe, it, expect } from "vitest";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import type { AggregatorContext } from "@/lib/reports/aggregators/index";
import type {
  NormalizedSale,
  NormalizedSaleLine,
} from "@/lib/reports/sales-stream";

/**
 * F-024 (spec criteria 1, 3, 4, 6, 7; contract § 3 and § 9.4; ADR 0089/0090).
 *
 * `createSummaryAggregator` stays pure over `NormalizedSale`
 * (`deliveryFeeBase` already lives there, ADR 0089), so every one of these is
 * verified WITHOUT a database — that is the entire point of criterion 7.
 *
 * The fixtures below are the ones the contract's own testability list (§ 9.4)
 * names as the ones that actually discriminate a broken implementation from a
 * correct one — a zero-value fixture where a non-zero one is needed would
 * pass against broken code too (E-008).
 */

const FAKE_CONTEXT = {} as AggregatorContext;

function makeLine(overrides: Partial<NormalizedSaleLine> = {}): NormalizedSaleLine {
  return {
    storeProductId: "product-1",
    quantity: 1,
    grossAmount: 0,
    costAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    grossProfit: 0,
    netProfit: 0,
    dimension: null,
    ...overrides,
  };
}

function makeSale(overrides: Partial<NormalizedSale> = {}): NormalizedSale {
  return {
    id: "sale-1",
    soldAt: new Date("2026-09-06T12:00:00Z"),
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
    deliveryFeeBase: 0,
    // F-037, ADR 0131: REQUIRED on NormalizedSale, read from Venta.creditoBase.
    // 0 for every counter sale — not this file's concern (see
    // paymentMixCredito.test.ts), but every NormalizedSale needs a value or
    // the object stops compiling (contract § 1, the cheapest no-regression
    // signal for spec criterion 7).
    creditAmount: 0,
    lines: [],
    discountsByRule: new Map(),
    origen: "POS",
    ...overrides,
  };
}

describe("createSummaryAggregator — totalEnvioTiendaOnline / cantidadVentasTiendaOnlineConEnvio", () => {
  it("starts both delivery figures at zero", () => {
    const summary = createSummaryAggregator().finalize(FAKE_CONTEXT);

    expect(summary.totalEnvioTiendaOnline).toBe(0);
    expect(summary.cantidadVentasTiendaOnlineConEnvio).toBe(0);
  });

  it("a POS sale never contributes to either tienda-online figure, even carrying a non-zero deliveryFeeBase (criterion 3 — a zero fixture here would not discriminate, E-008)", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(
      makeSale({ origen: "POS", netAmount: 100, deliveryFeeBase: 15 }),
    );

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentas).toBe(1); // still counted as a sale
    expect(summary.cantidadVentasTiendaOnline).toBe(0);
    expect(summary.totalMercanciaTiendaOnline).toBe(0);
    expect(summary.totalEnvioTiendaOnline).toBe(0);
    expect(summary.cantidadVentasTiendaOnlineConEnvio).toBe(0);
  });

  it("an online sale with delivery splits into merchandise and delivery, and their sum reconstructs Venta.total (criterion 1: 40 + 15 = 55)", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(
      makeSale({
        origen: "TIENDA_ONLINE",
        netAmount: 40,
        grossAmount: 40,
        deliveryFeeBase: 15,
      }),
    );

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentasTiendaOnline).toBe(1);
    expect(summary.totalMercanciaTiendaOnline).toBe(40);
    expect(summary.totalEnvioTiendaOnline).toBe(15);
    expect(summary.totalMercanciaTiendaOnline + summary.totalEnvioTiendaOnline).toBe(55);
    expect(summary.cantidadVentasTiendaOnlineConEnvio).toBe(1);
  });

  it("an online order that charged nothing for delivery does not count as 'con envío', and its merchandise figure is untouched (criterion 4)", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(
      makeSale({
        origen: "TIENDA_ONLINE",
        netAmount: 40,
        grossAmount: 40,
        deliveryFeeBase: 0,
      }),
    );

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentasTiendaOnline).toBe(1);
    expect(summary.totalMercanciaTiendaOnline).toBe(40);
    expect(summary.totalEnvioTiendaOnline).toBe(0);
    expect(summary.cantidadVentasTiendaOnlineConEnvio).toBe(0);
  });

  it("cantidadVentasTiendaOnlineConEnvio counts per sale, not all-or-nothing: a mix of online sales with and without delivery only counts the ones that actually charged it", () => {
    const aggregator = createSummaryAggregator();
    aggregator.consume(
      makeSale({ origen: "TIENDA_ONLINE", netAmount: 40, deliveryFeeBase: 15 }),
    );
    aggregator.consume(
      makeSale({ origen: "TIENDA_ONLINE", netAmount: 25, deliveryFeeBase: 0 }),
    );
    aggregator.consume(
      makeSale({ origen: "TIENDA_ONLINE", netAmount: 10, deliveryFeeBase: 5 }),
    );

    const summary = aggregator.finalize(FAKE_CONTEXT);

    expect(summary.cantidadVentasTiendaOnline).toBe(3);
    expect(summary.cantidadVentasTiendaOnlineConEnvio).toBe(2);
    expect(summary.totalEnvioTiendaOnline).toBe(20);
    expect(summary.totalMercanciaTiendaOnline).toBe(75);
  });

  it("totalPeriodo, totalBruto and gananciaTotal are IDENTICAL whether or not the online sale charged delivery — the read never enters the closing totals (criterion 6)", () => {
    const posSale = makeSale({
      origen: "POS",
      netAmount: 100,
      grossAmount: 100,
      lines: [makeLine({ quantity: 2, netProfit: 30 })],
    });

    const buildOnlineSale = (deliveryFeeBase: number) =>
      makeSale({
        origen: "TIENDA_ONLINE",
        netAmount: 40,
        grossAmount: 40,
        deliveryFeeBase,
        lines: [makeLine({ quantity: 1, netProfit: 12 })],
      });

    const withoutDelivery = createSummaryAggregator();
    withoutDelivery.consume(posSale);
    withoutDelivery.consume(buildOnlineSale(0));
    const summaryWithoutDelivery = withoutDelivery.finalize(FAKE_CONTEXT);

    const withDelivery = createSummaryAggregator();
    withDelivery.consume(posSale);
    withDelivery.consume(buildOnlineSale(15));
    const summaryWithDelivery = withDelivery.finalize(FAKE_CONTEXT);

    expect(summaryWithoutDelivery.totalPeriodo).toBe(summaryWithDelivery.totalPeriodo);
    expect(summaryWithoutDelivery.totalBruto).toBe(summaryWithDelivery.totalBruto);
    expect(summaryWithoutDelivery.gananciaTotal).toBe(summaryWithDelivery.gananciaTotal);
    expect(summaryWithoutDelivery.totalMercanciaTiendaOnline).toBe(
      summaryWithDelivery.totalMercanciaTiendaOnline,
    );

    // The only figure that DOES move is the delivery one itself — proof it
    // travels on a separate axis from totalPeriodo, never added to it.
    expect(summaryWithoutDelivery.totalEnvioTiendaOnline).toBe(0);
    expect(summaryWithDelivery.totalEnvioTiendaOnline).toBe(15);
  });
});
