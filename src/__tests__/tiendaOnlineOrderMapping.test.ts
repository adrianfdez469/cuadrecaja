import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toAmountString,
  toQuantityString,
  isUnattendedOrderStatus,
  unattendedOrdersWhere,
  toTiendaOnlineOrderAmounts,
  toTiendaOnlineOrderLine,
  toTiendaOnlineOrderListItem,
  toTiendaOnlineOrder,
  type ITiendaOnlineOrderListRow,
  type ITiendaOnlineOrderDetailRow,
  type ITiendaOnlineOrderLineRow,
} from "@/lib/tiendaOnline/tiendaOnlineOrderMapping";
import { TIENDA_ONLINE_UNATTENDED_STATUS } from "@/constants/tiendaOnline";
import { QAB_ORDER_STATUSES } from "@/constants/qab";
import type { IQabRateSnapshot } from "@/schemas/qabRateSnapshot";

/**
 * F-011 — `src/lib/tiendaOnline/tiendaOnlineOrderMapping.ts` (contract § 4.1). This
 * module is PURE (types only from `@prisma/client`), which is the whole reason it can
 * be covered here (E-015). It is the heart of acceptance criteria 4, 6, 7, 9, 10 and 12.
 *
 * Criteria 4/10 are the centre of gravity: a pending-quote order and a free-shipping
 * order carry the SAME `deliveryFee: "0.00"` (and, in the fixture below, even the SAME
 * `total`) — only `deliveryFeePending` differs. If a test only compared VALUES the two
 * branches would look identical and prove nothing (E-008); these tests assert the
 * DISCRIMINATING fact instead: which KEYS the resulting object has.
 */

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("toAmountString", () => {
  it("should format Decimal(14,2) as a fixed two-decimal string", () => {
    expect(toAmountString(decimal("100"))).toBe("100.00");
    expect(toAmountString(decimal("100.5"))).toBe("100.50");
    expect(toAmountString(decimal("0"))).toBe("0.00");
  });

  it("should keep the sign of a negative amount", () => {
    expect(toAmountString(decimal("-25.4"))).toBe("-25.40");
  });

  it("should never introduce a thousands grouping separator", () => {
    expect(toAmountString(decimal("1250.00"))).toBe("1250.00");
  });
});

describe("toQuantityString", () => {
  it("should format Decimal(14,3) as a fixed three-decimal string", () => {
    expect(toQuantityString(decimal("2"))).toBe("2.000");
    expect(toQuantityString(decimal("1.5"))).toBe("1.500");
    expect(toQuantityString(decimal("0.125"))).toBe("0.125");
  });

  it("should keep the sign of a negative quantity", () => {
    expect(toQuantityString(decimal("-3"))).toBe("-3.000");
  });
});

describe("isUnattendedOrderStatus", () => {
  it('should be true for "PULLED", and for the constant that names it', () => {
    expect(isUnattendedOrderStatus("PULLED")).toBe(true);
    expect(isUnattendedOrderStatus(TIENDA_ONLINE_UNATTENDED_STATUS)).toBe(
      true,
    );
  });

  it.each(QAB_ORDER_STATUSES.filter((status) => status !== "PULLED"))(
    "should be false for the other known status %s",
    (status) => {
      expect(isUnattendedOrderStatus(status)).toBe(false);
    },
  );

  it("should be false, not throw, for a status value this app has never seen (free text, ADR 0004)", () => {
    expect(isUnattendedOrderStatus("SOME_STATUS_QAB_ADDS_IN_2027")).toBe(
      false,
    );
    expect(isUnattendedOrderStatus("")).toBe(false);
  });
});

describe("unattendedOrdersWhere", () => {
  it("should combine negocioId, the tienda scope and the status constant, and nothing else", () => {
    const where = unattendedOrdersWhere({
      negocioId: "biz-1",
      tiendaIds: ["t1", "t2"],
    });

    expect(where).toEqual({
      negocioId: "biz-1",
      tiendaId: { in: ["t1", "t2"] },
      status: TIENDA_ONLINE_UNATTENDED_STATUS,
    });
  });

  it("should still carry negocioId with an empty tienda scope — this builder does not skip the DB call itself, that is `countUnattendedTiendaOnlineOrders`'s job (§4.2, not covered here: it touches Prisma)", () => {
    const where = unattendedOrdersWhere({ negocioId: "biz-1", tiendaIds: [] });

    expect(where).toEqual({
      negocioId: "biz-1",
      tiendaId: { in: [] },
      status: TIENDA_ONLINE_UNATTENDED_STATUS,
    });
  });
});

describe("toTiendaOnlineOrderAmounts — criteria 4 & 10 (ADR 0059)", () => {
  // Same negocio/tienda, same "0.00" deliveryFee, same "100.00" total: the ONLY
  // difference between these two rows is `deliveryFeePending`. If the mapper's output
  // shape did not discriminate on that flag alone, this pair would not catch it.
  const shared = {
    subtotal: decimal("100.00"),
    discountTotal: decimal("0.00"),
    deliveryFee: decimal("0.00"),
  };

  it("PENDING_QUOTE: no `deliveryFee` key, no `total` key — has `partialTotal` instead", () => {
    const amounts = toTiendaOnlineOrderAmounts({
      ...shared,
      total: decimal("100.00"), // subtotal - discountTotal, the PARTIAL invariant
      deliveryFeePending: true,
    });

    expect(amounts.kind).toBe("PENDING_QUOTE");
    expect("deliveryFee" in amounts).toBe(false);
    expect("total" in amounts).toBe(false);
    expect((amounts as { partialTotal: string }).partialTotal).toBe("100.00");
  });

  it("QUOTED: has `deliveryFee` and `total` — no `partialTotal` key", () => {
    const amounts = toTiendaOnlineOrderAmounts({
      ...shared,
      total: decimal("100.00"), // subtotal - discountTotal + deliveryFee, the COMPLETE invariant
      deliveryFeePending: false,
    });

    expect(amounts.kind).toBe("QUOTED");
    expect("partialTotal" in amounts).toBe(false);
    expect((amounts as { deliveryFee: string }).deliveryFee).toBe("0.00");
    expect((amounts as { total: string }).total).toBe("100.00");
  });

  it("QUOTED with an actual delivery charge: `deliveryFee` is not zero and `kind` still comes from the flag alone", () => {
    const amounts = toTiendaOnlineOrderAmounts({
      subtotal: decimal("50.00"),
      discountTotal: decimal("5.00"),
      deliveryFee: decimal("3.00"),
      total: decimal("48.00"), // 50 - 5 + 3
      deliveryFeePending: false,
    });

    expect(amounts.kind).toBe("QUOTED");
    expect((amounts as { deliveryFee: string }).deliveryFee).toBe("3.00");
    expect((amounts as { total: string }).total).toBe("48.00");
  });

  it("PENDING_QUOTE with a NON-zero stored deliveryFee: the branch still discards it — never exposed under any key", () => {
    // A row where `deliveryFeePending: true` but `deliveryFee` is not "0.00" (a QAB
    // anomaly, or simply stale data from before the order was re-opened for quoting):
    // the PENDING_QUOTE branch must drop it all the same. Exposing it here would be
    // the inverse of criteria 4/10's trap — this time hiding a real number under the
    // "not decided yet" branch instead of exposing a filler zero.
    const amounts = toTiendaOnlineOrderAmounts({
      subtotal: decimal("50.00"),
      discountTotal: decimal("0.00"),
      deliveryFee: decimal("7.50"),
      total: decimal("50.00"), // subtotal - discountTotal, the PARTIAL invariant
      deliveryFeePending: true,
    });

    expect(amounts.kind).toBe("PENDING_QUOTE");
    expect("deliveryFee" in amounts).toBe(false);
    expect("total" in amounts).toBe(false);
    expect(Object.keys(amounts).sort()).toEqual(
      ["discountTotal", "kind", "partialTotal", "subtotal"].sort(),
    );
  });

  /**
   * ADR 0062, closing the ambiguity this file used to leave as an `it.todo`: the five
   * amounts of a `PedidoEntrante` are reprojected VERBATIM, never recomputed.
   * `partialTotal` is `total` reprojected to a fixed-scale string — the SAME thing
   * `total` is in the QUOTED branch — never `subtotal - discountTotal`.
   *
   * This case is not a hypothetical fixture: F-010's `orderPoll.ts` evaluates
   * `qabOrderTotalsAreConsistent` on every pulled order and, when it fails, WRITES THE
   * ROW ANYWAY — it only increments the run's `inconsistentTotals` counter (ADR 0053).
   * A `total` that disagrees with `subtotal - discountTotal` is therefore a real,
   * persisted state of `PedidoEntrante`, not a fixture invented to force a branch.
   *
   * It is also the same rule ADR 0060 already fixed for `unitPrice`: the stored value
   * is what the buyer agreed to, and the recomputed one is a verification signal that
   * never replaces it. Recomputing the total while forwarding the unit price verbatim
   * would be two rules for the same question forty lines apart (E-014) — this test is
   * what keeps that single rule honest.
   */
  it("PENDING_QUOTE forwards the stored `total` verbatim as `partialTotal`, even when it disagrees with subtotal - discountTotal (ADR 0062)", () => {
    const amounts = toTiendaOnlineOrderAmounts({
      subtotal: decimal("100.00"),
      discountTotal: decimal("10.00"), // subtotal - discountTotal would be "90.00"
      deliveryFee: decimal("0.00"),
      total: decimal("999.99"), // deliberately inconsistent — an F-010 `inconsistentTotals` row
      deliveryFeePending: true,
    });

    expect(amounts.kind).toBe("PENDING_QUOTE");
    expect((amounts as { partialTotal: string }).partialTotal).toBe("999.99");
    expect((amounts as { partialTotal: string }).partialTotal).not.toBe("90.00");
  });
});

describe("toTiendaOnlineOrderLine — criterion 6 (ADR 0060)", () => {
  const SNAPSHOT: IQabRateSnapshot = {
    base: "CUP",
    capturedAt: "2026-08-26T02:00:00.000Z",
    rates: { USD: "440.000000" },
  };

  function line(overrides: Partial<ITiendaOnlineOrderLineRow> = {}): ITiendaOnlineOrderLineRow {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Producto de prueba",
      quantity: decimal("1.000"),
      currencyCode: "CUP",
      unitPrice: decimal("4400.00"),
      lineTotal: decimal("4400.00"),
      originalCurrencyCode: null,
      originalUnitPrice: null,
      originalLineTotal: null,
      ...overrides,
    } as ITiendaOnlineOrderLineRow;
  }

  it("`original` is null when there is nothing to show (no original price at all)", () => {
    const result = toTiendaOnlineOrderLine(line(), SNAPSHOT);

    expect(result.original).toBeNull();
    expect(result.conversion).toBeNull();
  });

  it("`original` (and, with it, `conversion`) stays null when only ONE of currencyCode/unitPrice is present", () => {
    const onlyCurrency = toTiendaOnlineOrderLine(
      line({ originalCurrencyCode: "USD", originalUnitPrice: null }),
      SNAPSHOT,
    );
    const onlyPrice = toTiendaOnlineOrderLine(
      line({ originalCurrencyCode: null, originalUnitPrice: decimal("10.00") }),
      SNAPSHOT,
    );

    expect(onlyCurrency.original).toBeNull();
    expect(onlyCurrency.conversion).toBeNull();
    expect(onlyPrice.original).toBeNull();
    expect(onlyPrice.conversion).toBeNull();
  });

  it("`original` is present when BOTH fields are present, even if originalLineTotal is null", () => {
    const result = toTiendaOnlineOrderLine(
      line({
        originalCurrencyCode: "USD",
        originalUnitPrice: decimal("10.00"),
        originalLineTotal: null,
      }),
      SNAPSHOT,
    );

    expect(result.original).toEqual({
      currencyCode: "USD",
      unitPrice: "10.00",
      lineTotal: null,
    });
  });

  it("`conversion` is null when there is no snapshot", () => {
    const result = toTiendaOnlineOrderLine(
      line({ originalCurrencyCode: "USD", originalUnitPrice: decimal("10.00") }),
      null,
    );

    expect(result.original).not.toBeNull();
    expect(result.conversion).toBeNull();
  });

  it("`conversion` is null when the original currency's rate is unreadable", () => {
    const result = toTiendaOnlineOrderLine(
      line({ originalCurrencyCode: "EUR", originalUnitPrice: decimal("10.00") }),
      SNAPSHOT, // no EUR entry in `rates`
    );

    expect(result.conversion).toBeNull();
  });

  it("`conversion` is null when the LINE currency's rate is unreadable", () => {
    const result = toTiendaOnlineOrderLine(
      line({
        currencyCode: "EUR", // target has no rate
        originalCurrencyCode: "USD",
        originalUnitPrice: decimal("10.00"),
      }),
      SNAPSHOT,
    );

    expect(result.conversion).toBeNull();
  });

  it("recomputes against the LINE's currencyCode, not any order-level currency", () => {
    const result = toTiendaOnlineOrderLine(
      line({
        currencyCode: "CUP",
        unitPrice: decimal("4400.00"),
        originalCurrencyCode: "USD",
        originalUnitPrice: decimal("10.00"),
      }),
      SNAPSHOT,
    );

    expect(result.conversion).toEqual({
      recomputedUnitPrice: "4400.00",
      matchesStored: true,
    });
  });

  it("matchesStored is false, without throwing or replacing the stored unitPrice, when they disagree", () => {
    const result = toTiendaOnlineOrderLine(
      line({
        currencyCode: "CUP",
        unitPrice: decimal("4399.00"), // deliberately NOT what convert(10 USD) gives
        originalCurrencyCode: "USD",
        originalUnitPrice: decimal("10.00"),
      }),
      SNAPSHOT,
    );

    expect(result.unitPrice).toBe("4399.00"); // stored value, never overwritten
    expect(result.conversion).toEqual({
      recomputedUnitPrice: "4400.00",
      matchesStored: false,
    });
  });
});

describe("toTiendaOnlineOrderListItem", () => {
  function row(overrides: Partial<ITiendaOnlineOrderListRow> = {}): ITiendaOnlineOrderListRow {
    return {
      id: "22222222-2222-2222-2222-222222222222",
      code: "ORD-0001",
      qabOrderId: "9007199254740993",
      tiendaId: "33333333-3333-3333-3333-333333333333",
      tienda: { nombre: "Local Centro" },
      status: "PULLED",
      cancelledBy: null,
      contactName: "Juana Pérez",
      currencyCode: "CUP",
      subtotal: decimal("100.00"),
      discountTotal: decimal("0.00"),
      deliveryFee: decimal("0.00"),
      total: decimal("100.00"),
      deliveryFeePending: false,
      qabCreatedAt: new Date("2026-08-20T10:00:00.000Z"),
      createdAt: new Date("2026-08-20T10:05:00.000Z"),
      _count: { lineas: 3 },
      ...overrides,
    } as ITiendaOnlineOrderListRow;
  }

  it("should map the plain fields through, dates as ISO strings", () => {
    const result = toTiendaOnlineOrderListItem(row(), { canManage: true });

    expect(result.id).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.code).toBe("ORD-0001");
    expect(result.tiendaNombre).toBe("Local Centro");
    expect(result.qabCreatedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(result.createdAt).toBe("2026-08-20T10:05:00.000Z");
    expect(result.lineCount).toBe(3);
  });

  it("should pass `canManage` through as given", () => {
    expect(toTiendaOnlineOrderListItem(row(), { canManage: true }).canManage).toBe(true);
    expect(toTiendaOnlineOrderListItem(row(), { canManage: false }).canManage).toBe(false);
  });

  it("should derive `unattended` from isUnattendedOrderStatus, not a second copy of the rule", () => {
    expect(toTiendaOnlineOrderListItem(row({ status: "PULLED" }), { canManage: true }).unattended).toBe(true);
    expect(toTiendaOnlineOrderListItem(row({ status: "CONFIRMED" }), { canManage: true }).unattended).toBe(false);
  });

  it("should map a null qabCreatedAt through as null (only that column is genuinely nullable)", () => {
    const result = toTiendaOnlineOrderListItem(row({ qabCreatedAt: null }), {
      canManage: true,
    });

    expect(result.qabCreatedAt).toBeNull();
  });

  it("should treat a null tiendaId as an empty string, per § 4.1's documented fallback", () => {
    const result = toTiendaOnlineOrderListItem(row({ tiendaId: null }), {
      canManage: true,
    });

    expect(result.tiendaId).toBe("");
  });
});

describe("toTiendaOnlineOrder", () => {
  const SNAPSHOT_JSON = {
    base: "CUP",
    capturedAt: "2026-08-26T02:00:00.000Z",
    rates: { USD: "440.000000" },
  };

  function detailRow(
    overrides: Partial<ITiendaOnlineOrderDetailRow> = {},
  ): ITiendaOnlineOrderDetailRow {
    return {
      id: "22222222-2222-2222-2222-222222222222",
      code: "ORD-0001",
      qabOrderId: "9007199254740993",
      tiendaId: "33333333-3333-3333-3333-333333333333",
      tienda: { nombre: "Local Centro" },
      status: "PULLED",
      cancelledBy: null,
      contactName: "Juana Pérez",
      contactPhone: "+53 5555 5555",
      contactEmail: "juana@example.com",
      contactAddress: "Calle 1, La Habana",
      notes: "Entregar por la tarde",
      currencyCode: "CUP",
      subtotal: decimal("4400.00"),
      discountTotal: decimal("0.00"),
      deliveryFee: decimal("0.00"),
      total: decimal("4400.00"),
      deliveryFeePending: false,
      rateSnapshot: SNAPSHOT_JSON,
      qabCreatedAt: new Date("2026-08-20T10:00:00.000Z"),
      createdAt: new Date("2026-08-20T10:05:00.000Z"),
      lineas: [
        {
          id: "44444444-4444-4444-4444-444444444444",
          name: "Línea 1",
          quantity: decimal("1.000"),
          currencyCode: "CUP",
          unitPrice: decimal("4400.00"),
          lineTotal: decimal("4400.00"),
          originalCurrencyCode: "USD",
          originalUnitPrice: decimal("10.00"),
          originalLineTotal: decimal("10.00"),
        },
      ] as ITiendaOnlineOrderLineRow[],
      ...overrides,
    } as ITiendaOnlineOrderDetailRow;
  }

  it("should NOT expose a `lineCount` key (it would drift from lines.length)", () => {
    const result = toTiendaOnlineOrder(detailRow(), { canManage: true });

    expect("lineCount" in result).toBe(false);
    expect(result.lines).toHaveLength(1);
  });

  it("should expose only { base, capturedAt } of the rate snapshot, never the rates map", () => {
    const result = toTiendaOnlineOrder(detailRow(), { canManage: true });

    expect(result.rateSnapshot).toEqual({
      base: "CUP",
      capturedAt: "2026-08-26T02:00:00.000Z",
    });
    expect(result.rateSnapshot).not.toHaveProperty("rates");
  });

  it("should map rateSnapshot to null when the column is null", () => {
    const result = toTiendaOnlineOrder(detailRow({ rateSnapshot: null }), {
      canManage: true,
    });

    expect(result.rateSnapshot).toBeNull();
  });

  it("should map rateSnapshot to null when the column is corrupt, without throwing", () => {
    expect(() =>
      toTiendaOnlineOrder(detailRow({ rateSnapshot: "not-an-object" }), {
        canManage: true,
      }),
    ).not.toThrow();

    const result = toTiendaOnlineOrder(
      detailRow({ rateSnapshot: "not-an-object" }),
      { canManage: true },
    );
    expect(result.rateSnapshot).toBeNull();
    // A corrupt snapshot degrades the LINE's conversion too, it does not fail the order.
    expect(result.lines[0].conversion).toBeNull();
    expect(result.lines[0].original).not.toBeNull();
  });

  it("should pass the same parsed snapshot to every line", () => {
    const result = toTiendaOnlineOrder(
      detailRow({
        lineas: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            name: "Línea A",
            quantity: decimal("1.000"),
            currencyCode: "CUP",
            unitPrice: decimal("4400.00"),
            lineTotal: decimal("4400.00"),
            originalCurrencyCode: "USD",
            originalUnitPrice: decimal("10.00"),
            originalLineTotal: decimal("10.00"),
          },
          {
            id: "66666666-6666-6666-6666-666666666666",
            name: "Línea B",
            quantity: decimal("2.000"),
            currencyCode: "USD",
            unitPrice: decimal("20.00"),
            lineTotal: decimal("40.00"),
            originalCurrencyCode: "USD",
            originalUnitPrice: decimal("20.00"),
            originalLineTotal: decimal("40.00"),
          },
        ] as ITiendaOnlineOrderLineRow[],
      }),
      { canManage: true },
    );

    expect(result.lines[0].conversion).toEqual({
      recomputedUnitPrice: "4400.00",
      matchesStored: true,
    });
    // Same currency on both sides of line B: the shortcut applies, still using the
    // very same snapshot instance (no per-line re-parse could change this answer).
    expect(result.lines[1].conversion).toEqual({
      recomputedUnitPrice: "20.00",
      matchesStored: true,
    });
  });

  it("should pass contact fields and notes through, nullable", () => {
    const withNulls = toTiendaOnlineOrder(
      detailRow({
        contactPhone: null,
        contactEmail: null,
        contactAddress: null,
        notes: null,
      }),
      { canManage: false },
    );

    expect(withNulls.contactPhone).toBeNull();
    expect(withNulls.contactEmail).toBeNull();
    expect(withNulls.contactAddress).toBeNull();
    expect(withNulls.notes).toBeNull();
    expect(withNulls.canManage).toBe(false);
  });
});
