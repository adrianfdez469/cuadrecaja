import { describe, it, expect } from "vitest";
import {
  qabAvailabilityValueSchema,
  qabDivergentRowSchema,
  qabAvailabilityItemSchema,
  qabAvailabilityBatchSchema,
  qabAvailabilitySyncResponseSchema,
  qabAvailabilityWritePlanSchema,
  qabAvailabilityBusinessReportSchema,
  qabAvailabilityPhaseReportSchema,
} from "@/schemas/qabAvailability";
import { QAB_AVAILABILITY, QAB_AVAILABILITY_BATCH_SIZE } from "@/constants/qab";
import { QAB_BUSINESS_OUTCOMES } from "@/schemas/qabSync";

/**
 * F-007 — the wire and internal schemas of `src/schemas/qabAvailability.ts`, against the
 * interface contract fixed by arch-guardian in `.agents/specs/F-007.md`.
 *
 * Two things carry the most risk here:
 *
 *  - `qabDivergentRowSchema` and `qabAvailabilityItemSchema` must accept ONLY the enum of
 *    three values (`QAB_AVAILABILITY`) as `availability` — the spec is explicit that the
 *    integer of `existencia` never crosses the boundary, and a schema that widened this to
 *    `z.string()` would silently let it through.
 *  - `qabAvailabilityBatchSchema` enforces both `min(1)` (an empty batch is never sent: the
 *    other side answers 400) and `max(QAB_AVAILABILITY_BATCH_SIZE)` (criterion 10).
 */

describe("qabAvailabilityValueSchema", () => {
  it.each(QAB_AVAILABILITY)("should accept %s — one of the three contract values", (value) => {
    expect(qabAvailabilityValueSchema.safeParse(value).success).toBe(true);
  });

  it("should reject a value outside the three-value enum", () => {
    expect(qabAvailabilityValueSchema.safeParse("IN_STOCK").success).toBe(false);
  });

  it("should reject a raw integer masquerading as availability", () => {
    expect(qabAvailabilityValueSchema.safeParse(0).success).toBe(false);
  });

  it("should reject an empty string", () => {
    expect(qabAvailabilityValueSchema.safeParse("").success).toBe(false);
  });
});

function divergentRow(overrides: Record<string, unknown> = {}) {
  return {
    productoTiendaId: "pt-1",
    tiendaId: "tienda-1",
    negocioId: "negocio-1",
    availability: "OUT_OF_STOCK",
    ...overrides,
  };
}

describe("qabDivergentRowSchema", () => {
  it("should accept a well formed row", () => {
    const row = divergentRow();
    expect(qabDivergentRowSchema.parse(row)).toEqual(row);
  });

  it("should reject a row missing negocioId — the tenant of the row must always be present", () => {
    const { negocioId: _negocioId, ...withoutNegocioId } = divergentRow();
    expect(qabDivergentRowSchema.safeParse(withoutNegocioId).success).toBe(false);
  });

  it("should reject a row whose availability is outside the enum", () => {
    expect(qabDivergentRowSchema.safeParse(divergentRow({ availability: "AGOTADO" })).success).toBe(
      false
    );
  });

  it("should reject a blank productoTiendaId", () => {
    expect(qabDivergentRowSchema.safeParse(divergentRow({ productoTiendaId: "" })).success).toBe(
      false
    );
  });

  it("should reject a blank tiendaId", () => {
    expect(qabDivergentRowSchema.safeParse(divergentRow({ tiendaId: "" })).success).toBe(false);
  });

  it("should reject an existencia field smuggled onto the row — it never leaves the SQL projection", () => {
    // The schema itself does not forbid extra keys (z.object strips unknown keys by
    // default), but parsing must never produce a row that carries the integer forward.
    const parsed = qabDivergentRowSchema.parse(divergentRow({ existencia: 37, umbralBajo: 5 }));
    expect(parsed).not.toHaveProperty("existencia");
    expect(parsed).not.toHaveProperty("umbralBajo");
  });
});

function wireItem(overrides: Record<string, unknown> = {}) {
  return {
    storeProductId: "pt-1",
    storeId: "tienda-1",
    availability: "LOW_STOCK",
    ...overrides,
  };
}

describe("qabAvailabilityItemSchema", () => {
  it("should accept a well formed wire item", () => {
    const item = wireItem();
    expect(qabAvailabilityItemSchema.parse(item)).toEqual(item);
  });

  it("should reject a blank storeProductId", () => {
    expect(qabAvailabilityItemSchema.safeParse(wireItem({ storeProductId: "" })).success).toBe(
      false
    );
  });

  it("should reject a blank storeId", () => {
    expect(qabAvailabilityItemSchema.safeParse(wireItem({ storeId: "" })).success).toBe(false);
  });

  it("should reject an availability outside the three-value enum", () => {
    expect(qabAvailabilityItemSchema.safeParse(wireItem({ availability: "SOLD_OUT" })).success).toBe(
      false
    );
  });
});

describe("qabAvailabilityBatchSchema", () => {
  it("should accept a batch of one item", () => {
    const batch = { businessId: "negocio-1", items: [wireItem()] };
    expect(qabAvailabilityBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("should reject an EMPTY items array — the other side answers 400 to it", () => {
    const batch = { businessId: "negocio-1", items: [] };
    expect(qabAvailabilityBatchSchema.safeParse(batch).success).toBe(false);
  });

  it(`should accept exactly QAB_AVAILABILITY_BATCH_SIZE (${QAB_AVAILABILITY_BATCH_SIZE}) items`, () => {
    const items = Array.from({ length: QAB_AVAILABILITY_BATCH_SIZE }, (_, i) =>
      wireItem({ storeProductId: `pt-${i}` })
    );
    expect(qabAvailabilityBatchSchema.safeParse({ businessId: "negocio-1", items }).success).toBe(
      true
    );
  });

  it("should reject one item MORE than QAB_AVAILABILITY_BATCH_SIZE", () => {
    const items = Array.from({ length: QAB_AVAILABILITY_BATCH_SIZE + 1 }, (_, i) =>
      wireItem({ storeProductId: `pt-${i}` })
    );
    expect(qabAvailabilityBatchSchema.safeParse({ businessId: "negocio-1", items }).success).toBe(
      false
    );
  });

  it("should reject a blank businessId", () => {
    expect(
      qabAvailabilityBatchSchema.safeParse({ businessId: "", items: [wireItem()] }).success
    ).toBe(false);
  });
});

describe("qabAvailabilitySyncResponseSchema", () => {
  it("should accept the documented 200 shape, confirmed as pairs", () => {
    const response = { applied: 1, confirmed: [["pt-1", "tienda-1"]] };
    expect(qabAvailabilitySyncResponseSchema.parse(response)).toEqual(response);
  });

  it("should default confirmed to [] when absent", () => {
    expect(qabAvailabilitySyncResponseSchema.parse({ applied: 0 })).toEqual({
      applied: 0,
      confirmed: [],
    });
  });

  it("should accept applied: 0 with everything confirmed — the normal reenvío-idéntico result (ADR 0050)", () => {
    const response = { applied: 0, confirmed: [["pt-1", "tienda-1"], ["pt-2", "tienda-2"]] };
    expect(qabAvailabilitySyncResponseSchema.safeParse(response).success).toBe(true);
  });

  it("should reject a negative applied", () => {
    expect(qabAvailabilitySyncResponseSchema.safeParse({ applied: -1, confirmed: [] }).success).toBe(
      false
    );
  });

  it("should reject a non-integer applied", () => {
    expect(qabAvailabilitySyncResponseSchema.safeParse({ applied: 1.5, confirmed: [] }).success).toBe(
      false
    );
  });

  it("should reject a confirmed entry that is not a 2-tuple", () => {
    expect(
      qabAvailabilitySyncResponseSchema.safeParse({ applied: 1, confirmed: [["only-one"]] }).success
    ).toBe(false);
  });

  it("should reject a confirmed entry carrying an enum value — the response never carries availability", () => {
    expect(
      qabAvailabilitySyncResponseSchema.safeParse({
        applied: 1,
        confirmed: [["pt-1", "tienda-1", "AVAILABLE"]],
      }).success
    ).toBe(false);
  });

  it("should reject a missing applied", () => {
    expect(qabAvailabilitySyncResponseSchema.safeParse({ confirmed: [] }).success).toBe(false);
  });

  /**
   * ADR 0051, point 5: a well-formed response can never confirm more items than the page
   * carried — the other side pushes at most one pair per item it received. The bound is
   * declared on the schema itself, not left implicit in `readBoundedBody`'s byte cap, so an
   * out-of-range `confirmed` fails validation (and that business simply retries) instead of
   * silently being accepted. This is the same "every BATCH_SIZE-shaped symbol exercised at
   * real scale" rule applied to this schema: a boundary test with 3 items would never catch
   * a `.max()` that was forgotten or set to the wrong constant.
   */
  it("should accept confirmed with EXACTLY QAB_AVAILABILITY_BATCH_SIZE entries — the boundary a real full page sits at", () => {
    const confirmed: Array<[string, string]> = Array.from({ length: QAB_AVAILABILITY_BATCH_SIZE }, (_, i) => [
      `pt-${i}`,
      `tienda-${i}`,
    ]);

    expect(qabAvailabilitySyncResponseSchema.safeParse({ applied: 0, confirmed }).success).toBe(true);
  });

  it("should reject confirmed with QAB_AVAILABILITY_BATCH_SIZE + 1 entries — a well-formed response can never confirm more pairs than the page it answers carried (ADR 0051)", () => {
    const confirmed: Array<[string, string]> = Array.from(
      { length: QAB_AVAILABILITY_BATCH_SIZE + 1 },
      (_, i) => [`pt-${i}`, `tienda-${i}`]
    );

    expect(qabAvailabilitySyncResponseSchema.safeParse({ applied: 0, confirmed }).success).toBe(false);
  });
});

describe("qabAvailabilityWritePlanSchema", () => {
  it("should accept a plan with groups in QAB_AVAILABILITY order", () => {
    const plan = {
      groups: [
        { availability: "OUT_OF_STOCK", productoTiendaIds: ["pt-1"] },
        { availability: "AVAILABLE", productoTiendaIds: ["pt-2", "pt-3"] },
      ],
      confirmed: 3,
    };
    expect(qabAvailabilityWritePlanSchema.parse(plan)).toEqual(plan);
  });

  it("should default groups to [] when absent", () => {
    expect(qabAvailabilityWritePlanSchema.parse({ confirmed: 0 })).toEqual({
      groups: [],
      confirmed: 0,
    });
  });

  it("should reject a group with an EMPTY productoTiendaIds — never an empty group", () => {
    const plan = { groups: [{ availability: "AVAILABLE", productoTiendaIds: [] }], confirmed: 0 };
    expect(qabAvailabilityWritePlanSchema.safeParse(plan).success).toBe(false);
  });

  it("should reject a negative confirmed", () => {
    expect(qabAvailabilityWritePlanSchema.safeParse({ groups: [], confirmed: -1 }).success).toBe(
      false
    );
  });
});

describe("qabAvailabilityBusinessReportSchema", () => {
  it("should accept a well formed business report with a valid outcome", () => {
    const report = {
      negocioId: "negocio-1",
      items: 3,
      requests: 1,
      confirmed: 2,
      written: 2,
      outcome: "ok",
    };
    expect(qabAvailabilityBusinessReportSchema.parse(report)).toEqual(report);
  });

  it.each(QAB_BUSINESS_OUTCOMES)("should accept outcome %s — reused verbatim from qabSync", (outcome) => {
    const report = {
      negocioId: "negocio-1",
      items: 0,
      requests: 0,
      confirmed: 0,
      written: 0,
      outcome,
    };
    expect(qabAvailabilityBusinessReportSchema.safeParse(report).success).toBe(true);
  });

  it("should reject an outcome outside QAB_BUSINESS_OUTCOMES", () => {
    const report = {
      negocioId: "negocio-1",
      items: 0,
      requests: 0,
      confirmed: 0,
      written: 0,
      outcome: "skipped_disabled",
    };
    expect(qabAvailabilityBusinessReportSchema.safeParse(report).success).toBe(false);
  });

  it("should reject a negative counter", () => {
    const report = {
      negocioId: "negocio-1",
      items: -1,
      requests: 0,
      confirmed: 0,
      written: 0,
      outcome: "ok",
    };
    expect(qabAvailabilityBusinessReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("qabAvailabilityPhaseReportSchema", () => {
  it("should accept a well formed phase report", () => {
    const report = {
      rows: 3,
      capped: false,
      businesses: 1,
      requests: 1,
      confirmed: 3,
      written: 3,
      byBusiness: [
        { negocioId: "negocio-1", items: 3, requests: 1, confirmed: 3, written: 3, outcome: "ok" },
      ],
    };
    expect(qabAvailabilityPhaseReportSchema.parse(report)).toEqual(report);
  });

  it("should default byBusiness to [] when absent", () => {
    const report = { rows: 0, capped: false, businesses: 0, requests: 0, confirmed: 0, written: 0 };
    expect(qabAvailabilityPhaseReportSchema.parse(report)).toEqual({ ...report, byBusiness: [] });
  });

  it("should reject a non-boolean capped", () => {
    const report = {
      rows: 0,
      capped: "false",
      businesses: 0,
      requests: 0,
      confirmed: 0,
      written: 0,
    };
    expect(qabAvailabilityPhaseReportSchema.safeParse(report).success).toBe(false);
  });
});
