import { describe, it, expect } from "vitest";
import { convertToBase } from "@/lib/currency";
import { SALE_TOTAL_TOLERANCE_BASE } from "@/constants/venta";

/**
 * F-024 criterion 2 — the discriminator the contract calls "the rule that
 * cannot be reinterpreted" (contract § 1, ADR 0089 § 1): the delivery figure
 * is READ from `PedidoEntrante.deliveryFee` via `convertToBase`, never
 * DEDUCED as `Venta.total − Σ líneas`.
 *
 * What this file can and cannot cover, and why:
 *
 * - `normalizeSale` (the function that actually performs this read inside
 *   `src/lib/reports/sales-stream.ts`) is Prisma-backed and NOT importable as
 *   a value from a test (contract § 9.1). Exercising it end to end — a real
 *   `PedidoEntrante` + a `Venta` that ALSO carries `tipTotal` (a combination
 *   no current flow produces, but nothing in the schema forbids — contract
 *   § 1, ADR 0089 § 1) — is the seeded-database scenario the spec's own
 *   criterion 2 describes, and it is QA's to execute, not this file's.
 * - What IS purely testable, without a database, is the arithmetic itself:
 *   `convertToBase` is the one function the contract names as the legitimate
 *   path (§ 2.3, ADR 0089 § 3), and it is on the pure-module allowlist
 *   (§ 9.2). This file uses the REAL `convertToBase` to show that reading
 *   the delivery fee through it is blind to a tip, while the forbidden
 *   shortcut — subtracting the merchandise from a total that happens to
 *   include one — is not.
 */
describe("Delivery figure: read via convertToBase, never deduced as total minus lines (criterion 2)", () => {
  it("convertToBase reads the same delivery figure regardless of anything a tip would have added to Venta.total", () => {
    const pedidoDeliveryFee = 15;
    const pedidoCurrency = "CUP";
    const baseCurrency = "CUP";
    const rates = {};

    // The read never takes `Venta.total` or `Venta.tipTotal` as a parameter —
    // it only ever needs the pedido's own column and the sale's rate snapshot.
    const readWithNoTip = convertToBase(
      pedidoDeliveryFee,
      pedidoCurrency,
      rates,
      baseCurrency,
    );
    const readAsIfSaleHadATip = convertToBase(
      pedidoDeliveryFee,
      pedidoCurrency,
      rates,
      baseCurrency,
    );

    expect(readWithNoTip).toBe(15);
    expect(readAsIfSaleHadATip).toBe(15);
    expect(readWithNoTip).toBe(readAsIfSaleHadATip);
  });

  it("deducing envío as (total minus merchandise) drifts away from the real figure the moment the sale carries a tip — exactly the shortcut the contract forbids", () => {
    const netAmount = 40; // mercancía: what the lines add up to
    const deliveryFee = 15; // the real, persisted PedidoEntrante.deliveryFee

    // `tiendaOnlineOrderLanding.ts` never assigns tipTotal today, but nothing
    // in the schema ties a Venta.pedidoEntranteId to Venta.tipTotal being 0
    // (ADR 0089 § 1) — this is the fixture the coordinator confirmed doesn't
    // arise from any current flow, fabricated here on purpose.
    const ventaTotalWithoutTip = netAmount + deliveryFee; // 55
    const ventaTotalWithTip = ventaTotalWithoutTip + 5; // 60

    const deducedWithoutTip = ventaTotalWithoutTip - netAmount;
    const deducedWithTip = ventaTotalWithTip - netAmount;

    // Without a tip the forbidden shortcut happens to coincide with the real
    // figure — which is exactly why it looks safe until the first tip lands.
    expect(deducedWithoutTip).toBe(deliveryFee);

    // With a tip, the shortcut silently drifts by the tip amount...
    expect(deducedWithTip).not.toBe(deliveryFee);
    expect(Math.abs(deducedWithTip - deliveryFee)).toBeGreaterThan(
      SALE_TOTAL_TOLERANCE_BASE,
    );

    // ...while the mandated read, using the real conversion function, stays
    // exactly 15 in both cases: it never looked at either total to begin with.
    const readDeliveryFee = convertToBase(deliveryFee, "CUP", {}, "CUP");
    expect(readDeliveryFee).toBe(deliveryFee);
    expect(readDeliveryFee).not.toBe(deducedWithTip);
  });
});
