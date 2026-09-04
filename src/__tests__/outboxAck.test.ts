import { describe, it, expect } from "vitest";
import {
  truncateOutboxError,
  groupOutboxEventsByNegocio,
  toQabCatalogBatch,
  planOutboxAck,
  emptyQabOutboxDrainReport,
  collectQabPermanentFailures,
  QabTenantMismatchError,
} from "@/lib/qab/outboxAck";
import { qabOutboxDrainReportSchema } from "@/schemas/qabSync";
import type { IOutboxEvento } from "@/schemas/qabOutbox";
import { QAB_OUTBOX_ERROR_MAX_LENGTH, QAB_OUTBOX_PERMANENT_ERROR_CODES } from "@/constants/qab";

/**
 * F-002 — `src/lib/qab/outboxAck.ts`, the "todo puro" module the contract calls out as
 * the bulk of what this suite can cover without a database. Two things this file exists
 * to protect, verbatim from the contract:
 *
 *  - The full truth table of `planOutboxAck` (ADR 0011): ok / failed / MISSING_IN_RESPONSE,
 *    and that an id in BOTH ok and failed counts as failed — "an event that failed is
 *    never a duplicate ack".
 *  - Multi-tenant isolation as an INVARIANT, not a convention: `toQabCatalogBatch` throws
 *    `QabTenantMismatchError` on a foreign row, and `planOutboxAck` silently ignores any id
 *    QAB reports back that this run never sent — a hostile or buggy 207 cannot ack a row
 *    belonging to another business.
 */

function row(overrides: Partial<IOutboxEvento> = {}): IOutboxEvento {
  return {
    id: "1",
    negocioId: "negocio-1",
    entidad: "PRODUCT",
    entidadId: "producto-1",
    operacion: "UPDATE",
    ocurridoAt: new Date("2026-09-01T10:00:00.000Z"),
    payload: { storeProductId: "pt-1" },
    intentos: 0,
    procesadoAt: null,
    ultimoError: null,
    ...overrides,
  };
}

describe("truncateOutboxError", () => {
  it("should return a short message untouched", () => {
    expect(truncateOutboxError("boom")).toBe("boom");
  });

  it(`should return a message of exactly ${QAB_OUTBOX_ERROR_MAX_LENGTH} chars untouched`, () => {
    const message = "x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH);
    expect(truncateOutboxError(message)).toBe(message);
  });

  it(`should truncate a message past ${QAB_OUTBOX_ERROR_MAX_LENGTH} chars to that length, ending in an ellipsis`, () => {
    const message = "x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH + 50);
    const truncated = truncateOutboxError(message);

    expect(truncated).toHaveLength(QAB_OUTBOX_ERROR_MAX_LENGTH);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated).toBe("x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH - 1) + "…");
  });

  it("should not blow up on an empty message", () => {
    expect(truncateOutboxError("")).toBe("");
  });
});

describe("groupOutboxEventsByNegocio", () => {
  it("should keep a single business's rows in their given order", () => {
    const rows = [row({ id: "1" }), row({ id: "2" }), row({ id: "3" })];
    expect(groupOutboxEventsByNegocio(rows)).toEqual([{ negocioId: "negocio-1", rows }]);
  });

  it("should partition rows of two businesses without mixing them", () => {
    const rowA1 = row({ id: "1", negocioId: "negocio-a" });
    const rowA3 = row({ id: "3", negocioId: "negocio-a" });
    const rowB2 = row({ id: "2", negocioId: "negocio-b" });

    const groups = groupOutboxEventsByNegocio([rowA1, rowB2, rowA3]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.negocioId === "negocio-a")?.rows).toEqual([rowA1, rowA3]);
    expect(groups.find((g) => g.negocioId === "negocio-b")?.rows).toEqual([rowB2]);
  });

  it("should order groups by the SMALLEST event id of each business, numerically, not lexicographically", () => {
    // "10" < "9" lexicographically but not numerically. A string-sorted implementation
    // would put negocio-a (smallest "10") before negocio-b (smallest "9").
    const rows = [
      row({ id: "10", negocioId: "negocio-a" }),
      row({ id: "11", negocioId: "negocio-a" }),
      row({ id: "9", negocioId: "negocio-b" }),
    ];

    expect(groupOutboxEventsByNegocio(rows).map((g) => g.negocioId)).toEqual([
      "negocio-b",
      "negocio-a",
    ]);
  });

  it("should compare ids as BigInt, not as Number, past 2^53", () => {
    // 9007199254740993 (2^53 + 1) is not exactly representable as a Number: it rounds down
    // to 9007199254740992, the same value as the other id below. A Number-based comparison
    // could tie or misorder these two businesses.
    const rows = [
      row({ id: "9007199254740993", negocioId: "negocio-a" }),
      row({ id: "9007199254740992", negocioId: "negocio-b" }),
    ];

    expect(groupOutboxEventsByNegocio(rows).map((g) => g.negocioId)).toEqual([
      "negocio-b",
      "negocio-a",
    ]);
  });

  it("should return an empty array for an empty input", () => {
    expect(groupOutboxEventsByNegocio([])).toEqual([]);
  });
});

describe("toQabCatalogBatch", () => {
  it("should map a row's fields verbatim onto the wire shape", () => {
    const r = row({
      id: "42",
      negocioId: "negocio-1",
      entidad: "PRODUCT",
      operacion: "UPDATE",
      ocurridoAt: new Date("2026-09-01T10:00:00.000Z"),
      payload: { storeProductId: "pt-1" },
    });

    expect(toQabCatalogBatch("negocio-1", [r])).toEqual({
      businessId: "negocio-1",
      events: [
        {
          eventId: "42",
          entity: "PRODUCT",
          operation: "UPDATE",
          occurredAt: "2026-09-01T10:00:00.000Z",
          payload: { storeProductId: "pt-1" },
        },
      ],
    });
  });

  it("should serialize ocurridoAt with toISOString, including milliseconds", () => {
    const r = row({ ocurridoAt: new Date("2026-09-01T10:00:00.123Z") });
    const batch = toQabCatalogBatch("negocio-1", [r]);
    expect(batch.events[0].occurredAt).toBe("2026-09-01T10:00:00.123Z");
  });

  it("should throw QabTenantMismatchError when a row does not belong to the given negocioId", () => {
    const foreign = row({ id: "1", negocioId: "negocio-ajeno" });
    expect(() => toQabCatalogBatch("negocio-1", [foreign])).toThrow(QabTenantMismatchError);
  });

  it("should throw QabTenantMismatchError even when only ONE row among many belongs to another business", () => {
    const rows = [row({ id: "1", negocioId: "negocio-1" }), row({ id: "2", negocioId: "negocio-2" })];
    expect(() => toQabCatalogBatch("negocio-1", rows)).toThrow(QabTenantMismatchError);
  });

  it("should not silently accept an empty target negocioId as matching an empty row negocioId", () => {
    const r = row({ negocioId: "" });
    expect(() => toQabCatalogBatch("negocio-1", [r])).toThrow(QabTenantMismatchError);
  });
});

describe("planOutboxAck", () => {
  const rows = [row({ id: "1" }), row({ id: "2" }), row({ id: "3" })];

  it("should ack every row as failed with the transport error when the whole request failed", () => {
    const outcome = { kind: "error" as const, ultimoError: "TRANSPORT:socket hang up" };
    const plan = planOutboxAck(rows, outcome);

    expect(plan.processedIds).toEqual([]);
    expect(plan.failedAcks).toEqual([
      { id: "1", ultimoError: "TRANSPORT:socket hang up" },
      { id: "2", ultimoError: "TRANSPORT:socket hang up" },
      { id: "3", ultimoError: "TRANSPORT:socket hang up" },
    ]);
  });

  it("should split ok / failed / missing per the contract's truth table", () => {
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: ["1"],
        failed: [{ id: "2", error: "invalid product" }],
        results: [],
      },
    };
    // "3" appears in neither list: MISSING_IN_RESPONSE.
    const plan = planOutboxAck(rows, outcome);

    expect(plan.processedIds).toEqual(["1"]);
    expect(plan.failedAcks).toEqual([
      { id: "2", ultimoError: "EVENT:invalid product" },
      { id: "3", ultimoError: "MISSING_IN_RESPONSE" },
    ]);
  });

  it("should treat an id present in BOTH ok and failed as failed: a failed event is never a duplicate ack", () => {
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: ["1"],
        failed: [{ id: "1", error: "duplicate key" }],
        results: [],
      },
    };
    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.processedIds).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: "EVENT:duplicate key" }]);
  });

  it("should IGNORE ids in ok/failed that this run never sent: QAB cannot ack a row it wasn't given", () => {
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: ["1", "999"],
        failed: [{ id: "888", error: "not mine" }],
        results: [],
      },
    };
    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.processedIds).toEqual(["1"]);
    expect(plan.failedAcks).toEqual([]);
  });

  it("should place every row in EXACTLY one list, in the given order, for a mixed batch", () => {
    const many = [row({ id: "1" }), row({ id: "2" }), row({ id: "3" }), row({ id: "4" })];
    const outcome = {
      kind: "ok" as const,
      response: { ok: ["1", "4"], failed: [{ id: "2", error: "bad" }], results: [] },
    };
    const plan = planOutboxAck(many, outcome);

    expect(plan.processedIds).toEqual(["1", "4"]);
    expect(plan.failedAcks.map((f) => f.id)).toEqual(["2", "3"]);

    const everyIdAckedOnce = [...plan.processedIds, ...plan.failedAcks.map((f) => f.id)].sort();
    expect(everyIdAckedOnce).toEqual(["1", "2", "3", "4"]);
  });

  it("should truncate a long failed error to QAB_OUTBOX_ERROR_MAX_LENGTH, prefixed with EVENT:", () => {
    const longError = "x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH + 100);
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: longError }], results: [] },
    };
    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.failedAcks[0].ultimoError.length).toBeLessThanOrEqual(QAB_OUTBOX_ERROR_MAX_LENGTH);
    expect(plan.failedAcks[0].ultimoError.startsWith("EVENT:")).toBe(true);
  });

  it("should return an empty plan for an empty row list, regardless of the outcome", () => {
    const outcome = { kind: "error" as const, ultimoError: "TRANSPORT:unreachable" };
    expect(planOutboxAck([], outcome)).toEqual({ processedIds: [], failedAcks: [] });
  });
});

describe("emptyQabOutboxDrainReport", () => {
  it("should return every counter at zero, both arrays empty, and NO permanent failures (F-005)", () => {
    expect(emptyQabOutboxDrainReport()).toEqual({
      claimed: 0,
      eventIds: [],
      businesses: 0,
      processed: 0,
      failed: 0,
      byBusiness: [],
      permanentFailures: [],
    });
  });

  it("should itself satisfy qabOutboxDrainReportSchema", () => {
    expect(qabOutboxDrainReportSchema.safeParse(emptyQabOutboxDrainReport()).success).toBe(true);
  });
});

/**
 * F-005 — acceptance criterion 12: a permanent QAB rejection (e.g. STORE_OPENING_HOURS_INVALID)
 * must not be left to exhaust the outbox's 6 silent retries. `collectQabPermanentFailures` is
 * the pure function that spots those entries in a 207's `failed[]` so the caller can log them.
 */
describe("collectQabPermanentFailures", () => {
  const storeRow = row({ id: "1", negocioId: "negocio-1", entidad: "STORE", entidadId: "tienda-1" });

  it("should return [] when the whole request failed (kind: error) — there is no failed[] to read", () => {
    const outcome = { kind: "error" as const, ultimoError: "TRANSPORT:socket hang up" };
    expect(collectQabPermanentFailures([storeRow], outcome)).toEqual([]);
  });

  it("should return [] when failed[] is empty", () => {
    const outcome = { kind: "ok" as const, response: { ok: ["1"], failed: [], results: [] } };
    expect(collectQabPermanentFailures([storeRow], outcome)).toEqual([]);
  });

  it.each([...QAB_OUTBOX_PERMANENT_ERROR_CODES])(
    "should collect a failed[] entry whose error is the permanent code %s",
    (code) => {
      const outcome = {
        kind: "ok" as const,
        response: { ok: [], failed: [{ id: "1", error: code }], results: [] },
      };

      const failures = collectQabPermanentFailures([storeRow], outcome);

      expect(failures).toEqual([
        { eventId: "1", negocioId: "negocio-1", entidad: "STORE", entidadId: "tienda-1", code },
      ]);
    }
  );

  it("should NOT collect a failed[] entry whose error is not one of the permanent codes — the discriminating control", () => {
    // E-008 guard: without a non-permanent case, a function that treats EVERY failure as
    // permanent would pass every test above and still be wrong.
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: "invalid product" }], results: [] },
    };

    expect(collectQabPermanentFailures([storeRow], outcome)).toEqual([]);
  });

  it("should IGNORE a failed[] entry whose id does not belong to the given rows, exactly like planOutboxAck", () => {
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "not-mine", error: "STORE_OPENING_HOURS_INVALID" }], results: [] },
    };

    expect(collectQabPermanentFailures([storeRow], outcome)).toEqual([]);
  });

  it("should collect only the permanent entries out of a mixed failed[], leaving the transient one out", () => {
    const otherRow = row({ id: "2", negocioId: "negocio-1", entidad: "STORE", entidadId: "tienda-2" });
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: [],
        failed: [
          { id: "1", error: "STORE_OPENING_HOURS_INVALID" },
          { id: "2", error: "invalid product" },
        ],
        results: [],
      },
    };

    const failures = collectQabPermanentFailures([storeRow, otherRow], outcome);

    expect(failures).toEqual([
      { eventId: "1", negocioId: "negocio-1", entidad: "STORE", entidadId: "tienda-1", code: "STORE_OPENING_HOURS_INVALID" },
    ]);
  });
});
