import { describe, it, expect } from "vitest";
import { createPaymentMixAggregator } from "@/lib/reports/aggregators/payment-mix";
import { PAYMENT_MIX_CREDIT_TYPE } from "@/constants/reportes";
import type { AggregatorContext } from "@/lib/reports/aggregators/index";
import type { NormalizedSale } from "@/lib/reports/sales-stream";
import type { IPagoLinea } from "@/schemas/pago";

/**
 * F-039 (spec criteria 1, 2, 3, 4, 7; contract § 2, § 8.3.A; ADR 0138).
 *
 * `createPaymentMixAggregator` stays pure over `NormalizedSale` (§ 8.1), so
 * every one of these is verified WITHOUT a database.
 *
 * The scenarios below are the ones the contract's own testability list names
 * as the ones that discriminate a broken implementation from a correct one:
 * a coincidental fixture (Escenario A alone, netAmount - payments == creditAmount)
 * would pass against a deduced implementation too — that is exactly why
 * criterion 3 needs its own scenario (E-008).
 */

const BASE_CURRENCY = "CUP";
const FAKE_CONTEXT = {} as AggregatorContext;

function makePayment(overrides: Partial<IPagoLinea> = {}): IPagoLinea {
  return {
    tipo: "cash",
    moneda: BASE_CURRENCY,
    monto: 0,
    equivalenteBase: 0,
    ...overrides,
  };
}

function makeSale(overrides: Partial<NormalizedSale> = {}): NormalizedSale {
  return {
    id: "sale-1",
    origen: "POS",
    soldAt: new Date("2026-09-01T12:00:00Z"),
    closingPeriodId: "cierre-1",
    sellerId: "user-1",
    collectionCurrency: BASE_CURRENCY,
    rates: {},
    hasRates: true,
    payments: null,
    fallbackCash: 0,
    fallbackTransfer: 0,
    fallbackTransferDestinationId: null,
    grossAmount: 0,
    discountTotal: 0,
    netAmount: 0,
    netProfit: 0,
    deliveryFeeBase: 0,
    creditAmount: 0,
    lines: [],
    discountsByRule: new Map(),
    ...overrides,
  };
}

function findRow(
  rows: { tipo: string }[],
  tipo: string,
): { tipo: string; [k: string]: unknown } | undefined {
  return rows.find((r) => r.tipo === tipo) as
    | { tipo: string; [k: string]: unknown }
    | undefined;
}

describe("createPaymentMixAggregator — the credit row (F-039)", () => {
  it("criterion 1: a 1000-cash sale plus a 1000-credit sale sum to 2000 across two rows, the credit row included, never deduced into cash", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 1000, equivalenteBase: 1000 })],
        netAmount: 1000,
      }),
    );
    aggregator.consume(
      makeSale({ creditAmount: 1000, payments: [], netAmount: 1000 }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    expect(result.rows).toHaveLength(2);
    expect(result.totalBase).toBe(2000);
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);
    expect(creditRow?.montoBase).toBe(1000);
  });

  it("criterion 2: with contado 1000 + crédito 1000, both shares are 50 and add up to 100 — over a base that includes credit, not the old (broken) base of only cash", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 1000, equivalenteBase: 1000 })],
        netAmount: 1000,
      }),
    );
    aggregator.consume(
      makeSale({ creditAmount: 1000, payments: [], netAmount: 1000 }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    const cashRow = findRow(result.rows, "cash");
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);
    expect(cashRow?.participacionPorcentaje).toBe(50);
    expect(creditRow?.participacionPorcentaje).toBe(50);
    expect(
      (cashRow?.participacionPorcentaje as number) +
        (creditRow?.participacionPorcentaje as number),
    ).toBe(100);
  });

  it("criterion 3, the discriminant (E-008): with creditAmount 1050 but netAmount 1000 and payments [] (Escenario B, envío a crédito), the credit row is 1050 — reading the field, never deducing netAmount minus payments (which would give 1000)", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({ creditAmount: 1050, netAmount: 1000, payments: [] }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);

    expect(creditRow?.montoBase).toBe(1050);
    expect(creditRow?.montoBase).not.toBe(1000);
  });

  it("criterion 4: a counter sale paid fully in cash (creditAmount: 0) contributes nothing to the credit row — no row of that type exists at all", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 1000, equivalenteBase: 1000 })],
        netAmount: 1000,
        creditAmount: 0,
      }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    expect(findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE)).toBeUndefined();
  });

  it("criterion 4 (transacciones): the credit row of the Escenario A case counts exactly 1 transaction, never 2 — only the credit sale, not the cash one too", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 1000, equivalenteBase: 1000 })],
        netAmount: 1000,
      }),
    );
    aggregator.consume(
      makeSale({ creditAmount: 1000, payments: [], netAmount: 1000 }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);

    expect(creditRow?.transacciones).toBe(1);
    expect(creditRow?.montoBase).toBe(1000);
  });

  it("a fully-credit sale (payments: [], no fallback columns) does NOT count as an estimated/legacy sale — its breakdown is complete, just entirely on credit", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        creditAmount: 1000,
        payments: [],
        fallbackCash: 0,
        fallbackTransfer: 0,
      }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    expect(result.ventasEstimadas).toBe(0);
  });

  it("no-regression: a real legacy sale (no payments, no credit, fallback columns set) is still counted as estimated, and its row is still flagged estimado: true", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: null,
        creditAmount: 0,
        fallbackCash: 700,
        fallbackTransfer: 0,
      }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);
    const cashRow = findRow(result.rows, "cash");

    expect(result.ventasEstimadas).toBe(1);
    expect(cashRow?.estimado).toBe(true);
  });

  it("partial credit: 400 in cash plus 600 on credit produces a 400 cash row AND a 600 credit row, and does NOT count as estimated — the lost-in-silence case the spec calls out", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 400, equivalenteBase: 400 })],
        creditAmount: 600,
        netAmount: 1000,
      }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);
    const cashRow = findRow(result.rows, "cash");
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);

    expect(cashRow?.montoBase).toBe(400);
    expect(creditRow?.montoBase).toBe(600);
    expect(result.ventasEstimadas).toBe(0);
  });

  it("totalCobradoBase excludes credit while totalBase includes it — Escenario A: totalCobradoBase 1000, totalBase 2000", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 1000, equivalenteBase: 1000 })],
        netAmount: 1000,
      }),
    );
    aggregator.consume(
      makeSale({ creditAmount: 1000, payments: [], netAmount: 1000 }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    expect(result.totalCobradoBase).toBe(1000);
    expect(result.totalBase).toBe(2000);
  });

  it("totalCobradoBase excludes credit — partial-credit case: totalCobradoBase 400, totalBase 1000", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: [makePayment({ monto: 400, equivalenteBase: 400 })],
        creditAmount: 600,
        netAmount: 1000,
      }),
    );

    const result = aggregator.finalize(FAKE_CONTEXT);

    expect(result.totalCobradoBase).toBe(400);
    expect(result.totalBase).toBe(1000);
  });

  it("the credit row is denominated in the base currency passed to the factory, and montoOriginal equals montoBase — credit has no physical currency, only a unit", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(makeSale({ creditAmount: 1000, payments: [] }));

    const result = aggregator.finalize(FAKE_CONTEXT);
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);

    expect(creditRow?.moneda).toBe(BASE_CURRENCY);
    expect(creditRow?.montoOriginal).toBe(creditRow?.montoBase);
    expect(creditRow?.montoOriginal).toBe(1000);
  });

  it("the credit row is never flagged estimado: true, even when the same report also has a legacy cash row that IS estimated", () => {
    const aggregator = createPaymentMixAggregator(BASE_CURRENCY);
    aggregator.consume(
      makeSale({
        payments: null,
        creditAmount: 0,
        fallbackCash: 500,
        fallbackTransfer: 0,
      }),
    );
    aggregator.consume(makeSale({ creditAmount: 1000, payments: [] }));

    const result = aggregator.finalize(FAKE_CONTEXT);
    const creditRow = findRow(result.rows, PAYMENT_MIX_CREDIT_TYPE);
    const cashRow = findRow(result.rows, "cash");

    expect(creditRow?.estimado).toBe(false);
    expect(cashRow?.estimado).toBe(true);
  });
});
