import { describe, it, expect } from "vitest";
import {
  qabNullableOrderIdSchema,
  qabOrderTimestampSchema,
  qabDeliveryFeePendingSchema,
  qabOrderContactSchema,
  qabOrderLineSchema,
  qabOrderProposalSchema,
  qabPulledOrderSchema,
  qabOrdersPageSchema,
  readQabOrderId,
  qabOrderTotalsAreConsistent,
} from "@/schemas/qabOrderPull";
import type { IQabPulledOrder, IQabOrderLine } from "@/schemas/qabOrderPull";
import {
  QAB_ORDER_CONTACT_MAX_LENGTH,
  QAB_ORDER_LINE_NAME_MAX_LENGTH,
} from "@/constants/qab";

/**
 * F-010 — `src/schemas/qabOrderPull.ts` (contract § same name). The wire parser of
 * the incremental order pull.
 *
 * The two things this file exists to pin down, against the contract literally:
 *
 *  1. `deliveryFeePending` must be read VERBATIM and never derived. The contract's
 *     own example order carries `deliveryFee: "0.00"` on BOTH a quoted order and one
 *     with the delivery given away — a fixture that does not discriminate the flag
 *     from any of `deliveryFee`, `total` or `contact.address` (E-008). The discriminating
 *     case here always uses a NON-ZERO deliveryFee.
 *  2. `qabOrderTotalsAreConsistent` has TWO identities, not one, and the contract's own
 *     `deliveryFeePending: true` example (`deliveryFee: "0.00"`) makes both formulas
 *     agree — it is explicitly called out as non-discriminating (criterion 9, E-008).
 *     The synthetic case with a non-zero `deliveryFee` is what actually exercises the
 *     "PARTIAL total" branch.
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
    // `IQabPulledOrder` is the PARSED (output) shape — createdAt: Date | null —
    // but this fixture also feeds `qabPulledOrderSchema.safeParse`, which needs
    // the WIRE (input) shape, an ISO string. `qabOrderTotalsAreConsistent` never
    // reads createdAt, so the cast has no effect on what it actually tests.
    createdAt: "2026-09-01T10:00:00.000Z" as unknown as Date,
    items: [validLine()],
    ...overrides,
  };
}

describe("qabNullableOrderIdSchema", () => {
  it("should accept a valid order id and return it unchanged", () => {
    expect(qabNullableOrderIdSchema.parse("42")).toBe("42");
  });

  it("should treat null as 'up to date'", () => {
    expect(qabNullableOrderIdSchema.parse(null)).toBeNull();
  });

  it("should treat an absent value as null", () => {
    expect(qabNullableOrderIdSchema.parse(undefined)).toBeNull();
  });

  it("should reject a non-null value that is not a valid order id", () => {
    expect(qabNullableOrderIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(qabNullableOrderIdSchema.safeParse(-1).success).toBe(false);
  });
});

describe("qabOrderTimestampSchema", () => {
  it("should parse a well formed ISO-8601 instant to a Date with the same instant", () => {
    const parsed = qabOrderTimestampSchema.parse("2026-09-01T10:00:00.000Z");
    expect(parsed).toBeInstanceOf(Date);
    expect((parsed as Date).toISOString()).toBe("2026-09-01T10:00:00.000Z");
  });

  it("should NEVER reject: an unparseable string yields null instead of failing validation", () => {
    const result = qabOrderTimestampSchema.safeParse("not-a-date");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeNull();
  });

  it("should yield null for an absent or null value, never throwing", () => {
    expect(qabOrderTimestampSchema.parse(undefined)).toBeNull();
    expect(qabOrderTimestampSchema.parse(null)).toBeNull();
  });

  it("should never reject any input shape at all (garbage in, null out)", () => {
    for (const garbage of [123, {}, [], true, "", "   "]) {
      const result = qabOrderTimestampSchema.safeParse(garbage);
      expect(result.success).toBe(true);
    }
  });
});

describe("qabDeliveryFeePendingSchema — the trap of the contract", () => {
  it("should read true ONLY for the literal boolean true", () => {
    expect(qabDeliveryFeePendingSchema.parse(true)).toBe(true);
  });

  it("should yield false when the value is absent (pre-v6 meaning)", () => {
    expect(qabDeliveryFeePendingSchema.parse(undefined)).toBe(false);
  });

  it("should yield false when the value is null", () => {
    expect(qabDeliveryFeePendingSchema.parse(null)).toBe(false);
  });

  it("should yield false for the string 'true', never coercing a truthy value", () => {
    expect(qabDeliveryFeePendingSchema.parse("true")).toBe(false);
  });

  it("should yield false for the literal boolean false", () => {
    expect(qabDeliveryFeePendingSchema.parse(false)).toBe(false);
  });

  it("should yield false for any other truthy, non-boolean value (1, 'yes', {})", () => {
    for (const value of [1, "yes", {}, []]) {
      expect(qabDeliveryFeePendingSchema.parse(value)).toBe(false);
    }
  });
});

describe("qabOrderContactSchema", () => {
  it("should accept an empty object: every field is optional", () => {
    expect(qabOrderContactSchema.safeParse({}).success).toBe(true);
  });

  it("should accept a fully populated contact", () => {
    const contact = { name: "N", phone: "P", email: "e@x.com", address: "A" };
    expect(qabOrderContactSchema.parse(contact)).toEqual(contact);
  });

  it.each(["name", "phone", "email", "address"] as const)(
    "should reject %s longer than QAB_ORDER_CONTACT_MAX_LENGTH",
    (field) => {
      const contact = { [field]: "x".repeat(QAB_ORDER_CONTACT_MAX_LENGTH + 1) };
      expect(qabOrderContactSchema.safeParse(contact).success).toBe(false);
    },
  );

  it("should accept exactly QAB_ORDER_CONTACT_MAX_LENGTH characters", () => {
    const contact = { name: "x".repeat(QAB_ORDER_CONTACT_MAX_LENGTH) };
    expect(qabOrderContactSchema.safeParse(contact).success).toBe(true);
  });
});

describe("qabOrderLineSchema", () => {
  it("should accept a well formed line", () => {
    expect(qabOrderLineSchema.safeParse(validLine()).success).toBe(true);
  });

  it("should reject a blank name", () => {
    expect(qabOrderLineSchema.safeParse(validLine({ name: "" })).success).toBe(false);
  });

  it("should reject a name longer than QAB_ORDER_LINE_NAME_MAX_LENGTH", () => {
    const line = validLine({ name: "x".repeat(QAB_ORDER_LINE_NAME_MAX_LENGTH + 1) });
    expect(qabOrderLineSchema.safeParse(line).success).toBe(false);
  });

  it("should accept originalUnitPrice/originalCurrencyCode/originalLineTotal absent", () => {
    const { originalUnitPrice: _u, originalCurrencyCode: _c, originalLineTotal: _l, ...rest } =
      validLine();
    expect(qabOrderLineSchema.safeParse(rest).success).toBe(true);
  });

  it("should reject a missing storeProductExternalId only when it is present but empty", () => {
    expect(qabOrderLineSchema.safeParse(validLine({ storeProductExternalId: "" })).success).toBe(
      false,
    );
  });

  it("should accept storeProductExternalId absent (nullish)", () => {
    const { storeProductExternalId: _s, ...rest } = validLine();
    expect(qabOrderLineSchema.safeParse(rest).success).toBe(true);
  });
});

describe("qabOrderProposalSchema", () => {
  it("should accept a proposal with every amount nullish", () => {
    const proposal = {
      proposedAt: "2026-09-01T10:00:00.000Z",
      expiresAt: null,
      previousTotal: null,
      subtotal: null,
      discountTotal: null,
      deliveryFee: null,
      total: null,
      message: null,
    };
    expect(qabOrderProposalSchema.safeParse(proposal).success).toBe(true);
  });

  it("should accept a fully quoted proposal", () => {
    const proposal = {
      proposedAt: "2026-09-01T10:00:00.000Z",
      expiresAt: "2026-09-02T10:00:00.000Z",
      previousTotal: "100.00",
      subtotal: "90.00",
      discountTotal: "0.00",
      deliveryFee: "10.00",
      total: "100.00",
      message: "Cotización enviada",
    };
    expect(qabOrderProposalSchema.safeParse(proposal).success).toBe(true);
  });
});

describe("qabPulledOrderSchema", () => {
  it("should accept a well formed order", () => {
    expect(qabPulledOrderSchema.safeParse(validOrder()).success).toBe(true);
  });

  it("should default items to [] when absent", () => {
    const { items: _items, ...rest } = validOrder();
    const parsed = qabPulledOrderSchema.parse(rest);
    expect(parsed.items).toEqual([]);
  });

  it.each([
    "id",
    "code",
    "storeExternalId",
    "status",
    "currencyCode",
    "subtotal",
    "discountTotal",
    "deliveryFee",
    "total",
  ] as const)("should reject an order missing %s", (field) => {
    const order = { ...validOrder() } as Record<string, unknown>;
    delete order[field];
    expect(qabPulledOrderSchema.safeParse(order).success).toBe(false);
  });

  it("should accept contact, notes, customerWhatsappUrl and proposal absent (nullish)", () => {
    const { contact: _c, notes: _n, customerWhatsappUrl: _w, proposal: _p, ...rest } =
      validOrder();
    expect(qabPulledOrderSchema.safeParse(rest).success).toBe(true);
  });

  it("should NOT reject an order carrying an unexpected extra field (never .strict())", () => {
    // The contract's own future-proofing: nextAfter never travels on this route
    // today, and a schema that rejected an unknown field would break the day it
    // does. Any other unforeseen field must be tolerated the same way.
    const order = { ...validOrder(), nextAfter: "999" };
    expect(qabPulledOrderSchema.safeParse(order).success).toBe(true);
  });

  it("should accept a status the nine-value enum does not know, without rejecting (criterion 6)", () => {
    expect(qabPulledOrderSchema.safeParse(validOrder({ status: "SOMETHING_NEW" })).success).toBe(
      true,
    );
  });

  it.each(["AWAITING_CUSTOMER", "IN_TRANSIT", "REJECTED_BY_STORE"] as const)(
    "should accept the v5 status %s",
    (status) => {
      expect(qabPulledOrderSchema.safeParse(validOrder({ status })).success).toBe(true);
    },
  );

  it("should not validate code against the Crockford alphabet: any non-empty string up to the cap is accepted", () => {
    expect(qabPulledOrderSchema.safeParse(validOrder({ code: "not-crockford!!" })).success).toBe(
      true,
    );
  });
});

describe("qabOrdersPageSchema", () => {
  it("should accept a well formed page", () => {
    const page = { orders: [validOrder()], nextCursor: "42" };
    expect(qabOrdersPageSchema.safeParse(page).success).toBe(true);
  });

  it("should accept nextCursor: null as 'up to date'", () => {
    expect(qabOrdersPageSchema.safeParse({ orders: [], nextCursor: null }).success).toBe(true);
  });

  it("should default orders to [] when absent", () => {
    const parsed = qabOrdersPageSchema.parse({ nextCursor: null });
    expect(parsed.orders).toEqual([]);
  });

  it("should NOT reject an unexpected extra top-level field such as nextAfter (never .strict())", () => {
    const page = { orders: [], nextCursor: null, nextAfter: "999" };
    expect(qabOrdersPageSchema.safeParse(page).success).toBe(true);
  });

  it("should accept a garbage entry inside orders: each order is parsed on its own, downstream", () => {
    const page = { orders: [{ not: "an order" }, "a string", 42, null], nextCursor: null };
    expect(qabOrdersPageSchema.safeParse(page).success).toBe(true);
  });
});

describe("readQabOrderId", () => {
  it("should read the id of a well formed raw order", () => {
    expect(readQabOrderId(validOrder())).toBe("1");
  });

  it("should return null when the raw value has no readable id", () => {
    expect(readQabOrderId({ code: "ABCDEFGHIJ" })).toBeNull();
  });

  it("should return null when the id is not a valid order id", () => {
    expect(readQabOrderId({ id: "not-an-id" })).toBeNull();
  });

  it.each([null, undefined, "a string", 42, [], true])(
    "should return null without throwing for the non-object raw value %s",
    (raw) => {
      expect(() => readQabOrderId(raw)).not.toThrow();
      expect(readQabOrderId(raw)).toBeNull();
    },
  );
});

describe("qabOrderTotalsAreConsistent — criterion 9, the two identities", () => {
  it("should be true with deliveryFeePending: false and total = subtotal - discountTotal + deliveryFee", () => {
    const order = validOrder({
      deliveryFeePending: false,
      subtotal: "100.00",
      discountTotal: "10.00",
      deliveryFee: "5.00",
      total: "95.00",
    });
    expect(qabOrderTotalsAreConsistent(order)).toBe(true);
  });

  it("should be false with deliveryFeePending: false when total ignores deliveryFee", () => {
    const order = validOrder({
      deliveryFeePending: false,
      subtotal: "100.00",
      discountTotal: "10.00",
      deliveryFee: "5.00",
      total: "90.00",
    });
    expect(qabOrderTotalsAreConsistent(order)).toBe(false);
  });

  it("the contract's own example (deliveryFeePending: true, deliveryFee: '0.00') does not discriminate anything: both identities give the same result with a zero fee (E-008 warning, kept for documentation, not as the real check)", () => {
    const order = validOrder({
      deliveryFeePending: true,
      subtotal: "100.00",
      discountTotal: "10.00",
      deliveryFee: "0.00",
      total: "90.00",
    });
    expect(qabOrderTotalsAreConsistent(order)).toBe(true);
  });

  it("SYNTHETIC discriminating case: deliveryFeePending: true with a NON-ZERO deliveryFee must be true when total is PARTIAL (subtotal - discountTotal), ignoring deliveryFee", () => {
    const order = validOrder({
      deliveryFeePending: true,
      subtotal: "100.00",
      discountTotal: "10.00",
      deliveryFee: "5.00",
      total: "90.00",
    });
    expect(qabOrderTotalsAreConsistent(order)).toBe(true);
  });

  it("the exact same numbers with deliveryFeePending: false must be false: total does not include deliveryFee, and the false branch expects it to", () => {
    const order = validOrder({
      deliveryFeePending: false,
      subtotal: "100.00",
      discountTotal: "10.00",
      deliveryFee: "5.00",
      total: "90.00",
    });
    expect(qabOrderTotalsAreConsistent(order)).toBe(false);
  });

  it("should be pure: calling it twice with the same order gives the same result", () => {
    const order = validOrder();
    expect(qabOrderTotalsAreConsistent(order)).toBe(qabOrderTotalsAreConsistent(order));
  });
});
