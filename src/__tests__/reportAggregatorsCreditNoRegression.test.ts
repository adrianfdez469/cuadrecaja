import { describe, it, expect } from "vitest";
import { createSummaryAggregator } from "@/lib/reports/aggregators/summary";
import { createSellerPerformanceAggregator } from "@/lib/reports/aggregators/seller-performance";
import { createTimeSeriesAggregator } from "@/lib/reports/aggregators/time-series";
import { createCategoryMarginAggregator } from "@/lib/reports/aggregators/category-margin";
import { createProductSalesAggregator } from "@/lib/reports/aggregators/product-sales";
import { createDiscountRulesAggregator } from "@/lib/reports/aggregators/discount-rules";
import { createHourWeekdayAggregator } from "@/lib/reports/aggregators/hour-weekday";
import type { AggregatorContext, SalesAggregator } from "@/lib/reports/aggregators/index";
import type {
  NormalizedSale,
  NormalizedSaleLine,
  ProductDimension,
} from "@/lib/reports/sales-stream";
import type { DiscountRuleTotals } from "@/lib/reports/discount-proration";

/**
 * F-037 spec criterion 7, behavioral half (contract § 8.3.D, § 9.2).
 *
 * "The seven aggregators that work over lines and margins — summary,
 * seller-performance, time-series, category-margin, product-sales,
 * discount-rules, hour-weekday — give exactly the same as before." None of
 * them gains a reference to `creditAmount` (the structural half, § 9.1, is
 * QA's `grep`, executed alongside this file, not duplicated here).
 *
 * The proof is comparing FULL numeric output, never "it doesn't throw"
 * (E-008): a batch with partial credit and one with full credit
 * (`payments: []`) must produce output `toEqual` the SAME batch with
 * `creditAmount: 0` on every sale. The batch has at least two distinct
 * sellers/categories/products/rules/buckets/hours so every internal `sort`
 * actually invokes its comparator (E-008 adenda F-033: `sort` never calls the
 * comparator with 0 or 1 elements).
 */

const FAKE_CONTEXT = {} as AggregatorContext;

function makeDimension(
  overrides: Partial<ProductDimension> = {},
): ProductDimension {
  return {
    storeProductId: "sp-1",
    productId: "prod-1",
    productName: "Producto 1",
    displayName: "Producto 1",
    supplierId: null,
    supplierName: null,
    categoryId: "cat-1",
    categoryName: "Categoría 1",
    categoryColor: null,
    currentStock: 10,
    currentCost: 5,
    currentCostCurrency: "CUP",
    expiresAt: null,
    isConsignment: false,
    isDeleted: false,
    ...overrides,
  };
}

function makeLine(overrides: Partial<NormalizedSaleLine> = {}): NormalizedSaleLine {
  return {
    storeProductId: "sp-1",
    quantity: 1,
    grossAmount: 100,
    costAmount: 40,
    discountAmount: 0,
    netAmount: 100,
    grossProfit: 60,
    netProfit: 60,
    dimension: makeDimension(),
    ...overrides,
  };
}

function makeSale(overrides: Partial<NormalizedSale> = {}): NormalizedSale {
  return {
    id: "sale-1",
    origen: "POS",
    soldAt: new Date("2026-09-01T10:00:00Z"),
    closingPeriodId: "cierre-1",
    sellerId: "user-1",
    collectionCurrency: "CUP",
    rates: {},
    hasRates: true,
    payments: [
      { tipo: "cash", moneda: "CUP", monto: 100, equivalenteBase: 100 },
    ],
    fallbackCash: 0,
    fallbackTransfer: 0,
    fallbackTransferDestinationId: null,
    grossAmount: 100,
    discountTotal: 0,
    netAmount: 100,
    netProfit: 60,
    deliveryFeeBase: 0,
    creditAmount: 0,
    lines: [makeLine()],
    discountsByRule: new Map(),
    ...overrides,
  };
}

/**
 * A batch with enough variety to exercise every grouping and every sort in
 * the seven aggregators: two sellers, two categories/products, two discount
 * rules, two days (time-series buckets) and two hour/weekday cells.
 */
function buildBatch(): NormalizedSale[] {
  const rule1: Map<string, DiscountRuleTotals> = new Map([
    ["rule-1", { amount: 10, affectedGross: 100 }],
  ]);
  const rule2: Map<string, DiscountRuleTotals> = new Map([
    ["rule-2", { amount: 50, affectedGross: 200 }],
  ]);

  return [
    // Cash sale, seller 1, category/product 1, discount rule 1, day 1.
    makeSale({
      id: "sale-cash",
      sellerId: "user-1",
      soldAt: new Date("2026-09-01T09:00:00Z"),
      payments: [
        { tipo: "cash", moneda: "CUP", monto: 100, equivalenteBase: 100 },
      ],
      creditAmount: 0,
      netAmount: 100,
      grossAmount: 100,
      discountTotal: 10,
      lines: [
        makeLine({
          storeProductId: "sp-1",
          dimension: makeDimension({ storeProductId: "sp-1", categoryId: "cat-1" }),
          netAmount: 100,
          grossAmount: 100,
          discountAmount: 10,
          netProfit: 60,
        }),
      ],
      discountsByRule: rule1,
    }),
    // Partially-credit sale, seller 2, category/product 2, discount rule 2, day 2.
    makeSale({
      id: "sale-partial-credit",
      sellerId: "user-2",
      soldAt: new Date("2026-09-02T14:00:00Z"),
      payments: [
        { tipo: "cash", moneda: "CUP", monto: 400, equivalenteBase: 400 },
      ],
      creditAmount: 600,
      netAmount: 1000,
      grossAmount: 1000,
      discountTotal: 50,
      lines: [
        makeLine({
          storeProductId: "sp-2",
          dimension: makeDimension({ storeProductId: "sp-2", categoryId: "cat-2", categoryName: "Categoría 2" }),
          quantity: 3,
          netAmount: 1000,
          grossAmount: 1000,
          discountAmount: 50,
          costAmount: 200,
          netProfit: 750,
        }),
      ],
      discountsByRule: rule2,
    }),
    // Fully-credit sale (payments: []), origin TIENDA_ONLINE with delivery,
    // seller 1 again, day 2, different hour — exercises the online branch of
    // `summary` alongside credit, and adds a second transaction to seller 1.
    makeSale({
      id: "sale-full-credit",
      origen: "TIENDA_ONLINE",
      sellerId: "user-1",
      soldAt: new Date("2026-09-02T20:00:00Z"),
      payments: [],
      creditAmount: 1050,
      deliveryFeeBase: 50,
      netAmount: 1000,
      grossAmount: 1000,
      discountTotal: 0,
      lines: [
        makeLine({
          storeProductId: "sp-1",
          dimension: makeDimension({ storeProductId: "sp-1", categoryId: "cat-1" }),
          quantity: 2,
          netAmount: 1000,
          grossAmount: 1000,
          costAmount: 300,
          netProfit: 700,
        }),
      ],
      discountsByRule: new Map(),
    }),
  ];
}

/** Same batch, but with creditAmount forced to 0 on every sale. */
function withoutCredit(batch: NormalizedSale[]): NormalizedSale[] {
  return batch.map((sale) => ({ ...sale, creditAmount: 0 }));
}

function runAggregator<T>(
  factory: () => SalesAggregator<T>,
  batch: NormalizedSale[],
): T {
  const aggregator = factory();
  for (const sale of batch) aggregator.consume(sale);
  return aggregator.finalize(FAKE_CONTEXT);
}

describe("The seven line/margin aggregators are unaffected by credit (F-037 criterion 7, behavioral half)", () => {
  it("createSummaryAggregator: identical output with real credit values and with creditAmount forced to 0", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createSummaryAggregator, batch);
    const zeroed = runAggregator(createSummaryAggregator, withoutCredit(batch));

    expect(withCredit).toEqual(zeroed);
  });

  it("createSellerPerformanceAggregator: identical output, sellers sorted the same way, credit included or not", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createSellerPerformanceAggregator, batch);
    const zeroed = runAggregator(
      createSellerPerformanceAggregator,
      withoutCredit(batch),
    );

    expect(withCredit).toEqual(zeroed);
    expect(withCredit.length).toBeGreaterThanOrEqual(2);
  });

  it("createTimeSeriesAggregator: identical bucketed output across two days", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(
      () => createTimeSeriesAggregator("day"),
      batch,
    );
    const zeroed = runAggregator(
      () => createTimeSeriesAggregator("day"),
      withoutCredit(batch),
    );

    expect(withCredit).toEqual(zeroed);
    expect(withCredit.length).toBeGreaterThanOrEqual(2);
  });

  it("createCategoryMarginAggregator: identical output across two categories", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createCategoryMarginAggregator, batch);
    const zeroed = runAggregator(
      createCategoryMarginAggregator,
      withoutCredit(batch),
    );

    expect(withCredit).toEqual(zeroed);
    expect(withCredit.length).toBeGreaterThanOrEqual(2);
  });

  it("createProductSalesAggregator: identical output across two products", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createProductSalesAggregator, batch);
    const zeroed = runAggregator(
      createProductSalesAggregator,
      withoutCredit(batch),
    );

    expect(withCredit.rows).toEqual(zeroed.rows);
    expect(withCredit.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("createDiscountRulesAggregator: identical output across two discount rules", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createDiscountRulesAggregator, batch);
    const zeroed = runAggregator(
      createDiscountRulesAggregator,
      withoutCredit(batch),
    );

    expect(withCredit).toEqual(zeroed);
    expect(withCredit.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("createHourWeekdayAggregator: identical output across two hour/weekday cells", () => {
    const batch = buildBatch();
    const withCredit = runAggregator(createHourWeekdayAggregator, batch);
    const zeroed = runAggregator(
      createHourWeekdayAggregator,
      withoutCredit(batch),
    );

    expect(withCredit).toEqual(zeroed);
    expect(withCredit.pico).not.toBeNull();
  });
});
