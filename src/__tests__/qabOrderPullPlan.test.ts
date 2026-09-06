import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  parseQabPulledOrder,
  partitionQabOrders,
  selectNewQabOrders,
  advanceQabOrderCursor,
  toPedidoEntranteCreateData,
  nextQabOrderPageSize,
} from "@/lib/qab/qabOrderPullPlan";
import { readQabOrderId } from "@/schemas/qabOrderPull";
import type { IQabPulledOrder, IQabOrderLine } from "@/schemas/qabOrderPull";
import {
  QAB_ORDER_MAX_LINES,
  QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES,
  QAB_ORDER_PULL_PAGE_SIZE_LADDER,
  QAB_ORDER_URL_REQUIRED_PREFIX,
} from "@/constants/qab";

/**
 * F-010 — `src/lib/qab/qabOrderPullPlan.ts` (contract § same name, ADR 0052/0053). The
 * "todo puro" module the contract itself calls the bulk of this suite: no database,
 * no network. Every test below is written against the contract's own truth table for
 * `parseQabPulledOrder` and its literal field mapping for `toPedidoEntranteCreateData`
 * — the "para que dev-tester no lo adivine" table — not against a guess.
 *
 * `toPedidoEntranteCreateData`'s "spreading the order is forbidden" rule is checked
 * with an EXACT key-set assertion (`Object.keys(result).sort()`), not a "does not
 * contain one guessed key" check — measuring what IS there is the only form robust
 * against a field the wire grows tomorrow leaking in by accident.
 */

function validLine(overrides: Partial<IQabOrderLine> = {}): IQabOrderLine {
  return {
    storeProductExternalId: "spe-1",
    name: "Producto de prueba",
    unitPrice: "10.00",
    currencyCode: "CUP",
    quantity: "1.000",
    lineTotal: "10.00",
    originalUnitPrice: null,
    originalCurrencyCode: null,
    originalLineTotal: null,
    ...overrides,
  };
}

function validOrder(overrides: Partial<IQabPulledOrder> = {}): IQabPulledOrder {
  return {
    id: "1",
    code: "ABCDEFGHIJ",
    storeExternalId: "store-1",
    status: "PENDING",
    cancelledBy: null,
    contact: { name: "Cliente", phone: "+53555", email: null, address: "Calle 1" },
    currencyCode: "CUP",
    subtotal: "100.00",
    discountTotal: "0.00",
    deliveryFee: "0.00",
    total: "100.00",
    deliveryFeePending: false,
    rateSnapshot: { rate: "120.00" },
    notes: null,
    customerWhatsappUrl: null,
    proposal: null,
    createdAt: "2026-09-01T10:00:00.000Z" as unknown as Date,
    items: [validLine()],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* parseQabPulledOrder — the contract's own truth table                       */
/* -------------------------------------------------------------------------- */

describe("parseQabPulledOrder", () => {
  it("should accept a well formed order as kind: ok", () => {
    const result = parseQabPulledOrder(validOrder());
    expect(result.kind).toBe("ok");
  });

  it("rejected, INVALID_ORDER, with qabOrderId = readQabOrderId(raw) — a shape the schema does not validate", () => {
    const raw = { ...validOrder(), storeExternalId: undefined };
    const result = parseQabPulledOrder(raw);

    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reason).toBe("INVALID_ORDER");
      expect(result.qabOrderId).toBe(readQabOrderId(raw));
      expect(result.qabOrderId).toBe("1");
    }
  });

  it("INVALID_ORDER with qabOrderId: null when even the id cannot be read", () => {
    const raw = { ...validOrder(), id: "not-a-valid-id" };
    const result = parseQabPulledOrder(raw);

    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reason).toBe("INVALID_ORDER");
      expect(result.qabOrderId).toBeNull();
    }
  });

  it("AMOUNT_OUT_OF_RANGE when an order-level amount does not fit Decimal(14, 2)", () => {
    const result = parseQabPulledOrder(validOrder({ subtotal: "9999999999999.99" }));
    expect(result).toMatchObject({ kind: "rejected", reason: "AMOUNT_OUT_OF_RANGE", qabOrderId: "1" });
  });

  it("the exact ADR 0053 overflow literal (the NUMBER 1e20, not the string) rejects as AMOUNT_OUT_OF_RANGE — the discriminating form", () => {
    // qabAmountSchema's string pattern has no exponential notation: the STRING
    // "1e20" fails the schema outright (INVALID_ORDER), which does not exercise
    // fitsQabAmountColumn at all. Only the wire delivering a bare JSON NUMBER
    // 1e20 reaches the magnitude check — qabAmountSchema(1e20) normalizes it to
    // "100000000000000000000.00" first (ADR 0053's own documented case), and
    // THAT is what a broken fitsQabAmountColumn would fail to reject (E-008: the
    // string variant would pass this test for the wrong reason).
    const numberResult = parseQabPulledOrder(validOrder({ subtotal: 1e20 as unknown as string }));
    expect(numberResult).toMatchObject({ kind: "rejected", reason: "AMOUNT_OUT_OF_RANGE", qabOrderId: "1" });

    const stringResult = parseQabPulledOrder(validOrder({ subtotal: "1e20" }));
    expect(stringResult).toMatchObject({ kind: "rejected", reason: "INVALID_ORDER" });
  });

  it("AMOUNT_OUT_OF_RANGE when a LINE's amount does not fit Decimal(14, 2)", () => {
    const order = validOrder({ items: [validLine({ unitPrice: "9999999999999.99" })] });
    const result = parseQabPulledOrder(order);
    expect(result).toMatchObject({ kind: "rejected", reason: "AMOUNT_OUT_OF_RANGE", qabOrderId: "1" });
  });

  it("AMOUNT_OUT_OF_RANGE when a PROPOSAL amount does not fit Decimal(14, 2)", () => {
    const order = validOrder({
      status: "AWAITING_CUSTOMER",
      proposal: {
        proposedAt: "2026-09-01T10:00:00.000Z" as unknown as Date,
        expiresAt: null,
        previousTotal: null,
        subtotal: null,
        discountTotal: null,
        deliveryFee: null,
        total: "9999999999999.99",
        message: null,
      },
    });
    const result = parseQabPulledOrder(order);
    expect(result).toMatchObject({ kind: "rejected", reason: "AMOUNT_OUT_OF_RANGE", qabOrderId: "1" });
  });

  it("QUANTITY_OUT_OF_RANGE when a line's quantity does not fit Decimal(14, 3)", () => {
    const order = validOrder({ items: [validLine({ quantity: "999999999999.999" })] });
    const result = parseQabPulledOrder(order);
    expect(result).toMatchObject({ kind: "rejected", reason: "QUANTITY_OUT_OF_RANGE", qabOrderId: "1" });
  });

  it("TOO_MANY_LINES when items.length > QAB_ORDER_MAX_LINES", () => {
    const items = Array.from({ length: QAB_ORDER_MAX_LINES + 1 }, (_, i) =>
      validLine({ storeProductExternalId: `spe-${i}` }),
    );
    const result = parseQabPulledOrder(validOrder({ items }));
    expect(result).toMatchObject({ kind: "rejected", reason: "TOO_MANY_LINES", qabOrderId: "1" });
  });

  it("should accept exactly QAB_ORDER_MAX_LINES lines — the boundary is not a rejection", () => {
    const items = Array.from({ length: QAB_ORDER_MAX_LINES }, (_, i) =>
      validLine({ storeProductExternalId: `spe-${i}` }),
    );
    const result = parseQabPulledOrder(validOrder({ items }));
    expect(result.kind).toBe("ok");
  });

  it("RATE_SNAPSHOT_TOO_LARGE when JSON.stringify(rateSnapshot) exceeds QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES", () => {
    const rateSnapshot = { blob: "x".repeat(QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES) };
    const result = parseQabPulledOrder(validOrder({ rateSnapshot }));
    expect(result).toMatchObject({ kind: "rejected", reason: "RATE_SNAPSHOT_TOO_LARGE", qabOrderId: "1" });
  });

  it("should accept a rateSnapshot at or under the byte cap", () => {
    const rateSnapshot = { blob: "x".repeat(QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES - 20) };
    const result = parseQabPulledOrder(validOrder({ rateSnapshot }));
    expect(result.kind).toBe("ok");
  });

  it("kind: ok for a status the nine-value enum does not know — criterion 6, no switch anywhere", () => {
    const result = parseQabPulledOrder(validOrder({ status: "SOMETHING_NEW" }));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.order.status).toBe("SOMETHING_NEW");
  });

  it.each(["AWAITING_CUSTOMER", "IN_TRANSIT", "REJECTED_BY_STORE"] as const)(
    "kind: ok for the v5 status %s, without throwing",
    (status) => {
      expect(() => parseQabPulledOrder(validOrder({ status }))).not.toThrow();
      expect(parseQabPulledOrder(validOrder({ status })).kind).toBe("ok");
    },
  );

  it("kind: ok when the two totals identities do not hold — never a refusal (ADR 0053)", () => {
    const order = validOrder({
      deliveryFeePending: false,
      subtotal: "100.00",
      discountTotal: "0.00",
      deliveryFee: "0.00",
      total: "1.00", // does not equal subtotal - discountTotal + deliveryFee
    });
    const result = parseQabPulledOrder(order);
    expect(result.kind).toBe("ok");
  });

  it(`kind: ok with customerWhatsappUrl nulled out when it does not start with ${QAB_ORDER_URL_REQUIRED_PREFIX}`, () => {
    const result = parseQabPulledOrder(validOrder({ customerWhatsappUrl: "http://wa.me/123" }));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.order.customerWhatsappUrl).toBeNull();
  });

  it("kind: ok preserving a well formed https:// customerWhatsappUrl verbatim", () => {
    const url = "https://wa.me/5355551234";
    const result = parseQabPulledOrder(validOrder({ customerWhatsappUrl: url }));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.order.customerWhatsappUrl).toBe(url);
  });

  it("kind: ok for a negative amount whose magnitude fits — the sign is never bounded", () => {
    const result = parseQabPulledOrder(validOrder({ subtotal: "-50.00", total: "-50.00" }));
    expect(result.kind).toBe("ok");
  });

  it("should never throw, on any of the rejection paths above", () => {
    const badOrders: unknown[] = [
      { ...validOrder(), storeExternalId: undefined },
      validOrder({ subtotal: "9999999999999.99" }),
      validOrder({ items: [validLine({ quantity: "999999999999.999" })] }),
      "not even an object",
      null,
      undefined,
      42,
    ];
    for (const raw of badOrders) {
      expect(() => parseQabPulledOrder(raw)).not.toThrow();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* partitionQabOrders                                                          */
/* -------------------------------------------------------------------------- */

describe("partitionQabOrders", () => {
  it("should preserve the wire order in BOTH lists", () => {
    const good1 = validOrder({ id: "1" });
    const bad = { ...validOrder({ id: "2" }), storeExternalId: undefined };
    const good2 = validOrder({ id: "3" });

    const { orders, rejected } = partitionQabOrders([good1, bad, good2]);

    expect(orders.map((o) => o.id)).toEqual(["1", "3"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].qabOrderId).toBe("2");
  });

  it("should never let a page-level failure happen: every element lands in exactly one list", () => {
    const raws: unknown[] = [validOrder({ id: "1" }), "garbage", null, validOrder({ id: "2" })];
    const { orders, rejected } = partitionQabOrders(raws);
    expect(orders.length + rejected.length).toBe(raws.length);
  });

  it("should return [] for an empty page", () => {
    expect(partitionQabOrders([])).toEqual({ orders: [], rejected: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* selectNewQabOrders — criterion 4, pure level (ADR 0052)                     */
/* -------------------------------------------------------------------------- */

describe("selectNewQabOrders", () => {
  it("should return [] when the only candidate's id is already present — criterion 4, pure level", () => {
    const order42 = validOrder({ id: "42" });
    expect(selectNewQabOrders(new Set(["42"]), [order42])).toEqual([]);
  });

  it("should return the whole list when nothing is present yet", () => {
    const order5 = validOrder({ id: "5" });
    const order3 = validOrder({ id: "3" });
    expect(selectNewQabOrders(new Set(), [order5, order3])).toEqual([order5, order3]);
  });

  it("should preserve wire order, never sorting numerically", () => {
    const order100 = validOrder({ id: "100" });
    const order2 = validOrder({ id: "2" });
    const result = selectNewQabOrders(new Set(), [order100, order2]);
    expect(result.map((o) => o.id)).toEqual(["100", "2"]);
  });

  it("should deduplicate WITHIN the same page: the same id delivered twice yields ONE entry, the first", () => {
    const first = validOrder({ id: "7", notes: "first" });
    const second = validOrder({ id: "7", notes: "second" });
    const result = selectNewQabOrders(new Set(), [first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe("first");
  });

  it("should only exclude ids actually present, keeping the rest", () => {
    const order5 = validOrder({ id: "5" });
    const order3 = validOrder({ id: "3" });
    const result = selectNewQabOrders(new Set(["3"]), [order5, order3]);
    expect(result).toEqual([order5]);
  });
});

/* -------------------------------------------------------------------------- */
/* advanceQabOrderCursor — criterion 5 (gaps), ADR 0053 (jumped)               */
/* -------------------------------------------------------------------------- */

describe("advanceQabOrderCursor", () => {
  it("criterion 5: ids with gaps ('10', '42', '7000') advance the cursor to the max, with no alarm", () => {
    const result = advanceQabOrderCursor({ current: null, receivedIds: ["10", "42", "7000"], nextCursor: null });
    expect(result).toEqual({ cursor: "7000", jumped: false });
  });

  it("should never go backwards: a lower current cursor stays put against smaller received ids", () => {
    const result = advanceQabOrderCursor({ current: "500", receivedIds: ["10", "42"], nextCursor: null });
    expect(result.cursor).toBe("500");
  });

  /**
   * The contract's own binding truth table for `jumped` — "greater than every id
   * delivered" is not enough on its own, because it reads as vacuously true when
   * there are no ids at all, and the empty-page case is deliberately IN the
   * table, not an oversight. One phrase, two directions: `jumped` is true when
   * the cursor moved AND `nextCursor` alone is what moved it; if the cursor did
   * not move, `jumped` is always false.
   */
  it.each([
    ["40", ["41", "42"], "42", "42", false, "the ids themselves moved it"],
    ["40", ["41"], "7000", "7000", true, "strictly greater than everything delivered"],
    ["40", [], "7000", "7000", true, "the purest case: an EMPTY page, moved ONLY by nextCursor's word"],
    ["40", [], null, "40", false, "nothing moved"],
    ["40", ["41"], null, "41", false, "no nextCursor: never a jump"],
    ["40", [], "10", "40", false, "maxQabOrderId never regresses, so there was no advance at all"],
    [null, [], "7000", "7000", true, "a business's very first pull"],
    ["40", [null, null], "7000", "7000", true, "unreadable ids never count as delivered"],
  ] as const)(
    "current=%s received=%j nextCursor=%s -> cursor=%s jumped=%s (%s)",
    (current, receivedIds, nextCursor, expectedCursor, expectedJumped, _why) => {
      const result = advanceQabOrderCursor({ current, receivedIds, nextCursor });
      expect(result).toEqual({ cursor: expectedCursor, jumped: expectedJumped });
    },
  );

  it("should count a REJECTED order's id towards advancing the cursor (ADR 0053: rejected orders are never lost to the cursor)", () => {
    // Simulates a page where id "7" was rejected (still counted in receivedIds)
    // and "3" was accepted: the cursor must move past both.
    const result = advanceQabOrderCursor({ current: null, receivedIds: ["3", "7"], nextCursor: null });
    expect(result.cursor).toBe("7");
  });

  it("should be pure and deterministic", () => {
    const args = { current: "10", receivedIds: ["20", "30"], nextCursor: null } as const;
    expect(advanceQabOrderCursor({ ...args })).toEqual(advanceQabOrderCursor({ ...args }));
  });
});

/* -------------------------------------------------------------------------- */
/* nextQabOrderPageSize — the retry ladder (ADR 0055)                         */
/* -------------------------------------------------------------------------- */

describe("nextQabOrderPageSize", () => {
  it.each(QAB_ORDER_PULL_PAGE_SIZE_LADDER.map((size, i) => [i, size] as const))(
    "should return the ladder's step %i (%i) directly",
    (attempt, expected) => {
      expect(nextQabOrderPageSize(attempt)).toBe(expected);
    },
  );

  it("should stay on the ladder's LAST value once attempt goes past its length — it never comes back to 100", () => {
    const last = QAB_ORDER_PULL_PAGE_SIZE_LADDER[QAB_ORDER_PULL_PAGE_SIZE_LADDER.length - 1];
    expect(nextQabOrderPageSize(QAB_ORDER_PULL_PAGE_SIZE_LADDER.length)).toBe(last);
    expect(nextQabOrderPageSize(QAB_ORDER_PULL_PAGE_SIZE_LADDER.length + 10)).toBe(last);
  });
});

/* -------------------------------------------------------------------------- */
/* toPedidoEntranteCreateData — the literal field mapping                     */
/* -------------------------------------------------------------------------- */

describe("toPedidoEntranteCreateData", () => {
  const PULLED_AT = new Date("2026-09-01T12:00:00.000Z");

  function fullOrder(): IQabPulledOrder {
    return validOrder({
      id: "555",
      code: "ZZZZYYYYXX",
      storeExternalId: "store-9",
      status: "AWAITING_CUSTOMER",
      cancelledBy: "CUSTOMER",
      contact: { name: "Ana", phone: "+53500", email: "ana@x.com", address: "Calle 9" },
      currencyCode: "CUP",
      subtotal: "200.00",
      discountTotal: "10.00",
      deliveryFee: "5.00",
      total: "195.00",
      deliveryFeePending: true,
      rateSnapshot: { rate: "130.00", asOf: "2026-09-01" },
      notes: "Entregar por la tarde",
      customerWhatsappUrl: "https://wa.me/5355551234",
      proposal: {
        proposedAt: "2026-09-01T09:00:00.000Z" as unknown as Date,
        expiresAt: "2026-09-02T09:00:00.000Z" as unknown as Date,
        previousTotal: "210.00",
        subtotal: "200.00",
        discountTotal: "10.00",
        deliveryFee: "5.00",
        total: "195.00",
        message: "Ajustamos el envío",
      },
      createdAt: "2026-09-01T08:00:00.000Z" as unknown as Date,
      items: [validLine({ storeProductExternalId: "spe-9", name: "Producto único" })],
    });
  }

  function build(order: IQabPulledOrder, tiendaId: string | null = "tienda-77") {
    return toPedidoEntranteCreateData({ negocioId: "negocio-1", tiendaId, order, pulledAt: PULLED_AT });
  }

  it("should map every field literally, per the contract's own table", () => {
    const order = fullOrder();
    const result = build(order) as Record<string, unknown>;

    expect(result.negocioId).toBe("negocio-1");
    expect(result.tiendaId).toBe("tienda-77");
    expect(result.qabOrderId).toBe("555");
    expect(result.code).toBe("ZZZZYYYYXX");
    expect(result.storeExternalId).toBe("store-9");
    expect(result.status).toBe("AWAITING_CUSTOMER");
    expect(result.cancelledBy).toBe("CUSTOMER");
    expect(result.contactName).toBe("Ana");
    expect(result.contactPhone).toBe("+53500");
    expect(result.contactEmail).toBe("ana@x.com");
    expect(result.contactAddress).toBe("Calle 9");
    expect(result.currencyCode).toBe("CUP");
    expect(result.subtotal).toBe("200.00");
    expect(result.discountTotal).toBe("10.00");
    expect(result.deliveryFee).toBe("5.00");
    expect(result.total).toBe("195.00");
    expect(result.deliveryFeePending).toBe(true);
    expect(result.rateSnapshot).toEqual({ rate: "130.00", asOf: "2026-09-01" });
    expect(result.notes).toBe("Entregar por la tarde");
    expect(result.customerWhatsappUrl).toBe("https://wa.me/5355551234");
    expect(result.proposalProposedAt).toEqual(order.proposal?.proposedAt);
    expect(result.proposalExpiresAt).toEqual(order.proposal?.expiresAt);
    expect(result.proposalPreviousTotal).toBe("210.00");
    expect(result.proposalSubtotal).toBe("200.00");
    expect(result.proposalDiscountTotal).toBe("10.00");
    expect(result.proposalDeliveryFee).toBe("5.00");
    expect(result.proposalTotal).toBe("195.00");
    expect(result.proposalMessage).toBe("Ajustamos el envío");
    expect(result.qabCreatedAt).toEqual(order.createdAt);
    expect(result.pulledAt).toBe(PULLED_AT);
  });

  it("should copy deliveryFeePending VERBATIM, never derived — criterion 2, the trap of the contract", () => {
    const zeroFeeQuoted = build(validOrder({ deliveryFeePending: false, deliveryFee: "0.00" })) as Record<
      string,
      unknown
    >;
    const zeroFeeGivenAway = build(validOrder({ deliveryFeePending: true, deliveryFee: "0.00" })) as Record<
      string,
      unknown
    >;

    // Same deliveryFee ("0.00") on both — deliveryFeePending is the ONLY thing
    // that distinguishes them in the row, and it must survive verbatim.
    expect(zeroFeeQuoted.deliveryFee).toBe(zeroFeeGivenAway.deliveryFee);
    expect(zeroFeeQuoted.deliveryFeePending).toBe(false);
    expect(zeroFeeGivenAway.deliveryFeePending).toBe(true);
  });

  it("should null out all four contact* fields when contact is absent", () => {
    const { contact: _c, ...rest } = fullOrder();
    const result = build(rest as IQabPulledOrder) as Record<string, unknown>;
    expect(result.contactName).toBeNull();
    expect(result.contactPhone).toBeNull();
    expect(result.contactEmail).toBeNull();
    expect(result.contactAddress).toBeNull();
  });

  it("should null out all EIGHT proposal fields when proposal is absent — no branching on status", () => {
    const order = validOrder({ status: "PENDING", proposal: null });
    const result = build(order) as Record<string, unknown>;
    for (const key of [
      "proposalProposedAt",
      "proposalExpiresAt",
      "proposalPreviousTotal",
      "proposalSubtotal",
      "proposalDiscountTotal",
      "proposalDeliveryFee",
      "proposalTotal",
      "proposalMessage",
    ]) {
      expect(result[key]).toBeNull();
    }
  });

  it("should populate the proposal fields even when status is NOT AWAITING_CUSTOMER — never branches on status", () => {
    const order = fullOrder();
    const nonAwaiting = { ...order, status: "CONFIRMED" };
    const result = build(nonAwaiting) as Record<string, unknown>;
    expect(result.proposalTotal).toBe("195.00");
    expect(result.proposalMessage).toBe("Ajustamos el envío");
  });

  it("should write Prisma.DbNull, never a bare null, for a JSON-null rateSnapshot", () => {
    const order = validOrder({ rateSnapshot: null });
    const result = build(order) as Record<string, unknown>;
    expect(result.rateSnapshot).toBe(Prisma.DbNull);
    expect(result.rateSnapshot).not.toBeNull(); // a bare null is ambiguous on a Json column
  });

  it("should ALSO write Prisma.DbNull for a rateSnapshot key that is entirely ABSENT — same as JSON null", () => {
    const { rateSnapshot: _r, ...withoutRateSnapshot } = validOrder();
    const result = build(withoutRateSnapshot as unknown as IQabPulledOrder) as Record<string, unknown>;
    expect(result.rateSnapshot).toBe(Prisma.DbNull);
  });

  it("should use the tiendaId given by the caller VERBATIM, never re-deriving it from storeExternalId", () => {
    const order = validOrder({ storeExternalId: "store-not-checked-here" });
    expect((build(order, "tienda-forced") as Record<string, unknown>).tiendaId).toBe("tienda-forced");
    expect((build(order, null) as Record<string, unknown>).tiendaId).toBeNull();
  });

  it("should use the pulledAt Date given by the caller VERBATIM, fixed once per business", () => {
    const result = build(fullOrder()) as Record<string, unknown>;
    expect(result.pulledAt).toBe(PULLED_AT);
  });

  it("should map createdAt: null to qabCreatedAt: null", () => {
    const result = build(validOrder({ createdAt: null })) as Record<string, unknown>;
    expect(result.qabCreatedAt).toBeNull();
  });

  it("should nest the lines under `lineas`, without pedidoId or negocioId on any line — Prisma fills the composite FK", () => {
    const order = fullOrder();
    const result = build(order) as { lineas?: { create: Array<Record<string, unknown>> } };

    expect(result.lineas?.create).toHaveLength(1);
    const line = result.lineas!.create[0];
    expect(line).not.toHaveProperty("pedidoId");
    expect(line).not.toHaveProperty("negocioId");
    expect(line.name).toBe("Producto único");
  });

  it("should NEVER spread the parsed order: the result's key set is EXACTLY the contract's mapping, nothing more", () => {
    const order = { ...fullOrder(), someFutureWireField: "must-not-leak" } as unknown as IQabPulledOrder;
    const result = build(order) as Record<string, unknown>;

    const expectedKeys = [
      "negocioId",
      "tiendaId",
      "qabOrderId",
      "code",
      "storeExternalId",
      "status",
      "cancelledBy",
      "contactName",
      "contactPhone",
      "contactEmail",
      "contactAddress",
      "currencyCode",
      "subtotal",
      "discountTotal",
      "deliveryFee",
      "total",
      "deliveryFeePending",
      "rateSnapshot",
      "notes",
      "customerWhatsappUrl",
      "proposalProposedAt",
      "proposalExpiresAt",
      "proposalPreviousTotal",
      "proposalSubtotal",
      "proposalDiscountTotal",
      "proposalDeliveryFee",
      "proposalTotal",
      "proposalMessage",
      "qabCreatedAt",
      "pulledAt",
      "lineas",
    ].sort();

    expect(Object.keys(result).sort()).toEqual(expectedKeys);
    expect(result.someFutureWireField).toBeUndefined();
  });
});
