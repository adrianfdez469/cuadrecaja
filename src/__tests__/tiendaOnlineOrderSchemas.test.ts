import { describe, it, expect } from "vitest";
import {
  tiendaOnlineOrderAmountsSchema,
  tiendaOnlineOrderLineOriginalSchema,
  tiendaOnlineOrderLineConversionSchema,
  tiendaOnlineOrderLineSchema,
  tiendaOnlineRateSnapshotInfoSchema,
  tiendaOnlineOrderListItemSchema,
  tiendaOnlineOrderSchema,
  tiendaOnlineOrdersPageSchema,
  tiendaOnlineOrderDetailSchema,
  tiendaOnlineOrdersQuerySchema,
} from "@/schemas/tiendaOnline";
import {
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX,
} from "@/constants/tiendaOnline";

/**
 * F-011 — the new Zod schemas of `src/schemas/tiendaOnline.ts` (contract § 2.2).
 *
 * The discriminated-union tests below are the executable form of ADR 0059: the whole
 * point is what the PENDING_QUOTE branch does NOT have — no `deliveryFee`, no `total` —
 * so a schema-level test that only checked VALID values would not catch a schema that
 * accidentally allowed both keys on both branches (E-008: the two branches must be
 * proven distinguishable, not merely individually valid).
 */

const UUID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const VALID_QUOTED = {
  kind: TIENDA_ONLINE_ORDER_AMOUNT_KIND.quoted,
  subtotal: "100.00",
  discountTotal: "0.00",
  deliveryFee: "5.00",
  total: "105.00",
};
const VALID_PENDING = {
  kind: TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote,
  subtotal: "100.00",
  discountTotal: "0.00",
  partialTotal: "100.00",
};

describe("tiendaOnlineOrderAmountsSchema (ADR 0059)", () => {
  it("accepts a well-formed QUOTED branch", () => {
    expect(tiendaOnlineOrderAmountsSchema.safeParse(VALID_QUOTED).success).toBe(
      true,
    );
  });

  it("accepts a well-formed PENDING_QUOTE branch", () => {
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse(VALID_PENDING).success,
    ).toBe(true);
  });

  it("rejects a PENDING_QUOTE object that carries `deliveryFee` (the shortcut the union exists to break)", () => {
    const result = tiendaOnlineOrderAmountsSchema.safeParse({
      ...VALID_PENDING,
      deliveryFee: "0.00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a PENDING_QUOTE object that carries `total`", () => {
    const result = tiendaOnlineOrderAmountsSchema.safeParse({
      ...VALID_PENDING,
      total: "100.00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a QUOTED object missing `deliveryFee` or `total`", () => {
    const { deliveryFee: _drop, ...withoutFee } = VALID_QUOTED;
    const { total: _drop2, ...withoutTotal } = VALID_QUOTED;

    expect(tiendaOnlineOrderAmountsSchema.safeParse(withoutFee).success).toBe(
      false,
    );
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse(withoutTotal).success,
    ).toBe(false);
  });

  it("rejects a `partialTotal` key placed on the QUOTED branch (each branch is .strict())", () => {
    const result = tiendaOnlineOrderAmountsSchema.safeParse({
      ...VALID_QUOTED,
      partialTotal: "100.00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an amount that is not a fixed-scale 2-decimal string", () => {
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse({
        ...VALID_QUOTED,
        subtotal: "100.0",
      }).success,
    ).toBe(false);
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse({
        ...VALID_QUOTED,
        subtotal: "100",
      }).success,
    ).toBe(false);
  });

  it("accepts a negative amount (a discount can exceed the subtotal in absolute terms is out of scope; the pattern itself allows a leading -)", () => {
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse({
        ...VALID_QUOTED,
        discountTotal: "-1.00",
      }).success,
    ).toBe(true);
  });

  it("rejects an unrecognised `kind`", () => {
    expect(
      tiendaOnlineOrderAmountsSchema.safeParse({
        ...VALID_QUOTED,
        kind: "SOMETHING_ELSE",
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderLineOriginalSchema", () => {
  it("accepts a non-null lineTotal", () => {
    expect(
      tiendaOnlineOrderLineOriginalSchema.safeParse({
        currencyCode: "USD",
        unitPrice: "10.00",
        lineTotal: "10.00",
      }).success,
    ).toBe(true);
  });

  it("accepts a null lineTotal (may still be null inside a non-null original block)", () => {
    expect(
      tiendaOnlineOrderLineOriginalSchema.safeParse({
        currencyCode: "USD",
        unitPrice: "10.00",
        lineTotal: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a missing currencyCode or a malformed unitPrice", () => {
    expect(
      tiendaOnlineOrderLineOriginalSchema.safeParse({
        unitPrice: "10.00",
        lineTotal: null,
      }).success,
    ).toBe(false);
    expect(
      tiendaOnlineOrderLineOriginalSchema.safeParse({
        currencyCode: "USD",
        unitPrice: "10",
        lineTotal: null,
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderLineConversionSchema", () => {
  it("accepts recomputedUnitPrice + matchesStored, and nothing else", () => {
    expect(
      tiendaOnlineOrderLineConversionSchema.safeParse({
        recomputedUnitPrice: "10.00",
        matchesStored: false,
      }).success,
    ).toBe(true);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      tiendaOnlineOrderLineConversionSchema.safeParse({
        recomputedUnitPrice: "10.00",
        matchesStored: false,
        effectiveRate: "440.00", // forbidden by ADR 0060: no effective rate is published
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderLineSchema", () => {
  const validLine = {
    id: UUID,
    name: "Producto de prueba",
    quantity: "1.000",
    currencyCode: "CUP",
    unitPrice: "10.00",
    lineTotal: "10.00",
    original: null,
    conversion: null,
  };

  it("accepts a line with no original/conversion (pre-distinction order)", () => {
    expect(tiendaOnlineOrderLineSchema.safeParse(validLine).success).toBe(
      true,
    );
  });

  it("accepts a line with a full original + conversion block", () => {
    expect(
      tiendaOnlineOrderLineSchema.safeParse({
        ...validLine,
        original: { currencyCode: "USD", unitPrice: "10.00", lineTotal: "10.00" },
        conversion: { recomputedUnitPrice: "10.00", matchesStored: true },
      }).success,
    ).toBe(true);
  });

  it("rejects a quantity without exactly 3 decimals", () => {
    expect(
      tiendaOnlineOrderLineSchema.safeParse({ ...validLine, quantity: "1" })
        .success,
    ).toBe(false);
    expect(
      tiendaOnlineOrderLineSchema.safeParse({ ...validLine, quantity: "1.00" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(
      tiendaOnlineOrderLineSchema.safeParse({ ...validLine, id: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("tiendaOnlineRateSnapshotInfoSchema", () => {
  it("accepts base + a nullable capturedAt", () => {
    expect(
      tiendaOnlineRateSnapshotInfoSchema.safeParse({
        base: "CUP",
        capturedAt: "2026-08-26T02:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      tiendaOnlineRateSnapshotInfoSchema.safeParse({
        base: "CUP",
        capturedAt: null,
      }).success,
    ).toBe(true);
  });

  it("does NOT validate capturedAt as an ISO instant — a third-party string kept verbatim", () => {
    expect(
      tiendaOnlineRateSnapshotInfoSchema.safeParse({
        base: "CUP",
        capturedAt: "not-a-real-date",
      }).success,
    ).toBe(true);
  });

  it("does not expose a `rates` key (.strict())", () => {
    expect(
      tiendaOnlineRateSnapshotInfoSchema.safeParse({
        base: "CUP",
        capturedAt: null,
        rates: { USD: "440.000000" },
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderListItemSchema", () => {
  const validItem = {
    id: UUID,
    code: "ORD-0001",
    qabOrderId: "9007199254740993",
    tiendaId: UUID,
    tiendaNombre: "Local Centro",
    status: "PULLED",
    cancelledBy: null,
    unattended: true,
    contactName: "Juana Pérez",
    currencyCode: "CUP",
    amounts: VALID_QUOTED,
    lineCount: 3,
    qabCreatedAt: "2026-08-20T10:00:00.000Z",
    createdAt: "2026-08-20T10:05:00.000Z",
    canManage: false,
  };

  it("accepts a well-formed row", () => {
    expect(tiendaOnlineOrderListItemSchema.safeParse(validItem).success).toBe(
      true,
    );
  });

  it("accepts a null qabCreatedAt (the only genuinely-nullable date here)", () => {
    expect(
      tiendaOnlineOrderListItemSchema.safeParse({
        ...validItem,
        qabCreatedAt: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a null tiendaId — never null on a listed row per contract § 2.2", () => {
    expect(
      tiendaOnlineOrderListItemSchema.safeParse({ ...validItem, tiendaId: null })
        .success,
    ).toBe(false);
  });

  it("accepts an unrecognised free-text `status` (ADR 0004: not a closed enum)", () => {
    expect(
      tiendaOnlineOrderListItemSchema.safeParse({
        ...validItem,
        status: "SOME_STATUS_QAB_ADDS_IN_2027",
      }).success,
    ).toBe(true);
  });

  it("rejects an extra, undeclared key (.strict()) — customerWhatsappUrl and proposal* are OUT of this contract", () => {
    expect(
      tiendaOnlineOrderListItemSchema.safeParse({
        ...validItem,
        customerWhatsappUrl: "https://wa.me/123",
      }).success,
    ).toBe(false);
  });

  it("accepts the PENDING_QUOTE amounts branch too", () => {
    expect(
      tiendaOnlineOrderListItemSchema.safeParse({
        ...validItem,
        amounts: VALID_PENDING,
      }).success,
    ).toBe(true);
  });
});

describe("tiendaOnlineOrderSchema", () => {
  const validOrder = {
    id: UUID,
    code: "ORD-0001",
    qabOrderId: "9007199254740993",
    tiendaId: UUID,
    tiendaNombre: "Local Centro",
    status: "PULLED",
    cancelledBy: null,
    unattended: true,
    contactName: "Juana Pérez",
    currencyCode: "CUP",
    amounts: VALID_QUOTED,
    qabCreatedAt: "2026-08-20T10:00:00.000Z",
    createdAt: "2026-08-20T10:05:00.000Z",
    canManage: false,
    contactPhone: null,
    contactEmail: null,
    contactAddress: null,
    notes: null,
    rateSnapshot: null,
    lines: [],
  };

  it("accepts a well-formed order with no lines", () => {
    expect(tiendaOnlineOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects a `lineCount` key — it was omitted on purpose, it does not merely default", () => {
    expect(
      tiendaOnlineOrderSchema.safeParse({ ...validOrder, lineCount: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects a `customerWhatsappUrl` or a `proposal*`-shaped key (out of this contract, F-012's)", () => {
    expect(
      tiendaOnlineOrderSchema.safeParse({
        ...validOrder,
        customerWhatsappUrl: "https://wa.me/123",
      }).success,
    ).toBe(false);
    expect(
      tiendaOnlineOrderSchema.safeParse({
        ...validOrder,
        proposalStatus: "PENDING",
      }).success,
    ).toBe(false);
  });

  it("accepts a non-null rateSnapshot info block and a populated lines array", () => {
    const result = tiendaOnlineOrderSchema.safeParse({
      ...validOrder,
      rateSnapshot: { base: "CUP", capturedAt: "2026-08-26T02:00:00.000Z" },
      lines: [
        {
          id: UUID,
          name: "Línea 1",
          quantity: "1.000",
          currencyCode: "CUP",
          unitPrice: "10.00",
          lineTotal: "10.00",
          original: null,
          conversion: null,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("tiendaOnlineOrdersPageSchema (ADR 0057/0058)", () => {
  const validPage = {
    negocioId: UUID,
    tiendaOnlineHabilitada: true,
    orders: [],
    nextCursor: null,
    unattendedCount: 0,
    unassignedCount: 0,
  };

  it("accepts a well-formed empty page", () => {
    expect(tiendaOnlineOrdersPageSchema.safeParse(validPage).success).toBe(
      true,
    );
  });

  it("accepts a non-null nextCursor uuid", () => {
    expect(
      tiendaOnlineOrdersPageSchema.safeParse({ ...validPage, nextCursor: UUID })
        .success,
    ).toBe(true);
  });

  it("rejects a negative counter", () => {
    expect(
      tiendaOnlineOrdersPageSchema.safeParse({
        ...validPage,
        unattendedCount: -1,
      }).success,
    ).toBe(false);
  });

  it("still requires the F-004 scaffold's `tiendaOnlineHabilitada: true` literal", () => {
    expect(
      tiendaOnlineOrdersPageSchema.safeParse({
        ...validPage,
        tiendaOnlineHabilitada: false,
      }).success,
    ).toBe(false);
  });
});

describe("tiendaOnlineOrderDetailSchema", () => {
  it("wraps a single `order` alongside the scaffold", () => {
    expect(
      tiendaOnlineOrderDetailSchema.safeParse({
        negocioId: UUID,
        tiendaOnlineHabilitada: true,
        order: {
          id: UUID,
          code: "ORD-0001",
          qabOrderId: "9007199254740993",
          tiendaId: UUID,
          tiendaNombre: "Local Centro",
          status: "PULLED",
          cancelledBy: null,
          unattended: true,
          contactName: null,
          currencyCode: "CUP",
          amounts: VALID_PENDING,
          qabCreatedAt: null,
          createdAt: "2026-08-20T10:05:00.000Z",
          canManage: true,
          contactPhone: null,
          contactEmail: null,
          contactAddress: null,
          notes: null,
          rateSnapshot: null,
          lines: [],
        },
      }).success,
    ).toBe(true);
  });
});

describe("tiendaOnlineOrdersQuerySchema", () => {
  it("accepts an empty query (no filters beyond cursor/limit)", () => {
    expect(tiendaOnlineOrdersQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces a string limit (as it arrives from a URL's searchParams) into a number", () => {
    const result = tiendaOnlineOrdersQuerySchema.safeParse({ limit: "50" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it(`rejects a limit above ${TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX}`, () => {
    expect(
      tiendaOnlineOrdersQuerySchema.safeParse({
        limit: String(TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects a limit of 0 or below", () => {
    expect(tiendaOnlineOrdersQuerySchema.safeParse({ limit: "0" }).success).toBe(
      false,
    );
  });

  it("rejects a non-uuid cursor", () => {
    expect(
      tiendaOnlineOrdersQuerySchema.safeParse({ cursor: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("rejects a status or date filter — this listing has none beyond cursor/limit (spec § Alcance)", () => {
    expect(
      tiendaOnlineOrdersQuerySchema.safeParse({ status: "PULLED" }).success,
    ).toBe(false);
  });
});
