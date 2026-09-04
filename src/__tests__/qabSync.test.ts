import { describe, it, expect } from "vitest";
import {
  qabCatalogEventSchema,
  qabCatalogBatchSchema,
  qabCatalogSyncResponseSchema,
  qabOutboxAckPlanSchema,
  qabOutboxDrainReportSchema,
  qabOrderPollPhaseReportSchema,
  qabSyncRunReportSchema,
  qabPermanentFailureSchema,
  QAB_BUSINESS_OUTCOMES,
} from "@/schemas/qabSync";
import { QAB_OUTBOX_BATCH_SIZE, QAB_OUTBOX_PERMANENT_ERROR_CODES } from "@/constants/qab";

/**
 * F-002 — the wire schemas of `src/schemas/qabSync.ts`, against the interface contract
 * fixed by arch-guardian in `.agents/specs/F-002.md`. These fence what travels over
 * `POST /api/internal/sync/catalog` (§①) and what the drain/poll reports carry.
 */

const baseEvent = {
  eventId: "1",
  entity: "PRODUCT",
  operation: "UPDATE",
  occurredAt: "2026-09-01T10:00:00.000Z",
  payload: { storeProductId: "pt-1" },
};

describe("qabCatalogEventSchema", () => {
  it("should accept a well formed wire event", () => {
    expect(qabCatalogEventSchema.parse(baseEvent)).toMatchObject(baseEvent);
  });

  it("should reject an empty eventId", () => {
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, eventId: "" }).success).toBe(false);
  });

  it("should reject an entity outside the wire vocabulary", () => {
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, entity: "PRODUCTO" }).success).toBe(false);
  });

  it("should reject an operation outside the wire vocabulary", () => {
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, operation: "UPSERT" }).success).toBe(false);
  });

  it("should reject a blank occurredAt", () => {
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, occurredAt: "" }).success).toBe(false);
  });

  it("should accept any payload shape: it is z.unknown() by design, validated elsewhere per entity", () => {
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, payload: "a string" }).success).toBe(true);
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, payload: [1, 2, 3] }).success).toBe(true);
    expect(qabCatalogEventSchema.safeParse({ ...baseEvent, payload: null }).success).toBe(true);
  });
});

describe("qabCatalogBatchSchema", () => {
  it("should accept a batch with a single event", () => {
    const parsed = qabCatalogBatchSchema.parse({ businessId: "negocio-1", events: [baseEvent] });
    expect(parsed.businessId).toBe("negocio-1");
    expect(parsed.events).toHaveLength(1);
  });

  it("should reject an empty businessId", () => {
    expect(
      qabCatalogBatchSchema.safeParse({ businessId: "", events: [baseEvent] }).success
    ).toBe(false);
  });

  it("should reject a batch with zero events", () => {
    expect(qabCatalogBatchSchema.safeParse({ businessId: "negocio-1", events: [] }).success).toBe(
      false
    );
  });

  it(`should accept exactly the contract's cap of ${QAB_OUTBOX_BATCH_SIZE} events`, () => {
    const events = Array.from({ length: QAB_OUTBOX_BATCH_SIZE }, (_, i) => ({
      ...baseEvent,
      eventId: String(i + 1),
    }));
    expect(qabCatalogBatchSchema.safeParse({ businessId: "negocio-1", events }).success).toBe(true);
  });

  it(`should reject ${QAB_OUTBOX_BATCH_SIZE + 1} events, one past the contract's cap`, () => {
    const events = Array.from({ length: QAB_OUTBOX_BATCH_SIZE + 1 }, (_, i) => ({
      ...baseEvent,
      eventId: String(i + 1),
    }));
    expect(qabCatalogBatchSchema.safeParse({ businessId: "negocio-1", events }).success).toBe(false);
  });
});

describe("qabCatalogSyncResponseSchema", () => {
  it("should default ok, failed and results to empty arrays", () => {
    const parsed = qabCatalogSyncResponseSchema.parse({});
    expect(parsed).toEqual({ ok: [], failed: [], results: [] });
  });

  it("should accept a full 207 body", () => {
    const parsed = qabCatalogSyncResponseSchema.parse({
      ok: ["1", "2"],
      failed: [{ id: "3", error: "boom" }],
      results: [{ eventId: "1", status: "processed" }],
    });
    expect(parsed.ok).toEqual(["1", "2"]);
    expect(parsed.failed).toEqual([{ id: "3", error: "boom" }]);
  });

  it("should accept an unrecognized results[].status: it is logging detail, deliberately NOT an enum", () => {
    // The contract is explicit: an enum here would let QAB inventing a new status tumble the
    // whole drain on the next deploy. `status` is only ever compared for logs.
    const parsed = qabCatalogSyncResponseSchema.parse({
      results: [{ eventId: "1", status: "a_status_qab_has_not_invented_yet" }],
    });
    expect(parsed.results[0].status).toBe("a_status_qab_has_not_invented_yet");
  });

  it("should reject a failed entry missing its error message", () => {
    expect(qabCatalogSyncResponseSchema.safeParse({ failed: [{ id: "3" }] }).success).toBe(false);
  });

  it("should reject an ok entry that is not a string", () => {
    expect(qabCatalogSyncResponseSchema.safeParse({ ok: [42] }).success).toBe(false);
  });
});

describe("qabOutboxAckPlanSchema", () => {
  it("should accept an empty plan", () => {
    expect(qabOutboxAckPlanSchema.parse({ processedIds: [], failedAcks: [] })).toEqual({
      processedIds: [],
      failedAcks: [],
    });
  });

  it("should accept a mixed plan", () => {
    const plan = {
      processedIds: ["1", "2"],
      failedAcks: [{ id: "3", ultimoError: "MISSING_IN_RESPONSE" }],
    };
    expect(qabOutboxAckPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("should reject a failedAcks entry without ultimoError", () => {
    expect(
      qabOutboxAckPlanSchema.safeParse({ processedIds: [], failedAcks: [{ id: "1" }] }).success
    ).toBe(false);
  });
});

describe("QAB_BUSINESS_OUTCOMES", () => {
  it("should hold exactly the four outcomes a per-business drain result can carry", () => {
    expect([...QAB_BUSINESS_OUTCOMES]).toEqual(["ok", "error", "skipped_no_token", "skipped_deadline"]);
  });
});

describe("qabOutboxDrainReportSchema", () => {
  const validReport = {
    claimed: 1,
    eventIds: ["1"],
    businesses: 1,
    processed: 1,
    failed: 0,
    byBusiness: [{ negocioId: "negocio-1", events: 1, processed: 1, failed: 0, outcome: "ok" }],
  };

  it("should accept a well formed report", () => {
    expect(qabOutboxDrainReportSchema.safeParse(validReport).success).toBe(true);
  });

  it.each(QAB_BUSINESS_OUTCOMES.map((outcome) => [outcome] as const))(
    "should accept the per-business outcome %s",
    (outcome) => {
      const report = {
        ...validReport,
        byBusiness: [{ ...validReport.byBusiness[0], outcome }],
      };
      expect(qabOutboxDrainReportSchema.safeParse(report).success).toBe(true);
    }
  );

  it("should reject a per-business outcome outside the four the contract defines", () => {
    const report = {
      ...validReport,
      byBusiness: [{ ...validReport.byBusiness[0], outcome: "retrying" }],
    };
    expect(qabOutboxDrainReportSchema.safeParse(report).success).toBe(false);
  });

  it("should reject a negative counter", () => {
    expect(qabOutboxDrainReportSchema.safeParse({ ...validReport, claimed: -1 }).success).toBe(
      false
    );
  });

  it("should default permanentFailures to [] when absent (F-005)", () => {
    const parsed = qabOutboxDrainReportSchema.parse(validReport);
    expect(parsed.permanentFailures).toEqual([]);
  });

  it("should accept an explicit permanentFailures entry", () => {
    const report = {
      ...validReport,
      permanentFailures: [
        {
          eventId: "1",
          negocioId: "negocio-1",
          entidad: "STORE",
          entidadId: "tienda-1",
          code: "STORE_OPENING_HOURS_INVALID",
        },
      ],
    };
    expect(qabOutboxDrainReportSchema.safeParse(report).success).toBe(true);
  });
});

describe("qabPermanentFailureSchema", () => {
  const baseFailure = {
    eventId: "1",
    negocioId: "negocio-1",
    entidad: "STORE",
    entidadId: "tienda-1",
    code: "STORE_OPENING_HOURS_INVALID",
  };

  it("should accept a well formed permanent failure", () => {
    expect(qabPermanentFailureSchema.safeParse(baseFailure).success).toBe(true);
  });

  it.each([...QAB_OUTBOX_PERMANENT_ERROR_CODES])("should accept the permanent code %s", (code) => {
    expect(qabPermanentFailureSchema.safeParse({ ...baseFailure, code }).success).toBe(true);
  });

  it("should reject a code outside QAB_OUTBOX_PERMANENT_ERROR_CODES — this is the closed vocabulary of criterion 12, not every possible QAB error", () => {
    expect(
      qabPermanentFailureSchema.safeParse({ ...baseFailure, code: "BUSINESS_MISMATCH" }).success
    ).toBe(false);
  });

  it("should reject an empty eventId", () => {
    expect(qabPermanentFailureSchema.safeParse({ ...baseFailure, eventId: "" }).success).toBe(false);
  });

  it("should reject an empty entidadId", () => {
    expect(qabPermanentFailureSchema.safeParse({ ...baseFailure, entidadId: "" }).success).toBe(false);
  });
});

describe("qabOrderPollPhaseReportSchema", () => {
  const validPhase = {
    attempted: 1,
    acquired: 1,
    skippedLocked: 0,
    businesses: [{ negocioId: "negocio-1", lock: "acquired", pulled: 0 }],
  };

  it("should accept the two known lock outcomes", () => {
    expect(qabOrderPollPhaseReportSchema.safeParse(validPhase).success).toBe(true);
    const skipped = {
      ...validPhase,
      businesses: [{ ...validPhase.businesses[0], lock: "skipped_locked" }],
    };
    expect(qabOrderPollPhaseReportSchema.safeParse(skipped).success).toBe(true);
  });

  it("should reject a lock outcome outside acquired|skipped_locked", () => {
    const bad = { ...validPhase, businesses: [{ ...validPhase.businesses[0], lock: "pending" }] };
    expect(qabOrderPollPhaseReportSchema.safeParse(bad).success).toBe(false);
  });
});

describe("qabSyncRunReportSchema", () => {
  const baseReport = {
    startedAt: "2026-09-02T00:00:00.000Z",
    durationMs: 10,
    skipped: null,
    outbox: {
      claimed: 0,
      eventIds: [],
      businesses: 0,
      processed: 0,
      failed: 0,
      byBusiness: [],
    },
    poll: { attempted: 0, acquired: 0, skippedLocked: 0, businesses: [] },
  };

  it("should accept skipped: null (a normal run)", () => {
    expect(qabSyncRunReportSchema.safeParse(baseReport).success).toBe(true);
  });

  it("should accept skipped with the exact literal the contract defines", () => {
    expect(
      qabSyncRunReportSchema.safeParse({ ...baseReport, skipped: "QAB_API_BASE_URL_NOT_SET" }).success
    ).toBe(true);
  });

  it("should reject any other value of skipped: it is a fixed literal, not a free string", () => {
    expect(
      qabSyncRunReportSchema.safeParse({ ...baseReport, skipped: "SOME_OTHER_REASON" }).success
    ).toBe(false);
  });

  it("should reject a negative durationMs", () => {
    expect(qabSyncRunReportSchema.safeParse({ ...baseReport, durationMs: -1 }).success).toBe(false);
  });
});
