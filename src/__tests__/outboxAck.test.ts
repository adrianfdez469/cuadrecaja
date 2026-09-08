import { describe, it, expect } from "vitest";
import {
  truncateOutboxError,
  groupOutboxEventsByNegocio,
  toQabCatalogBatch,
  planOutboxAck,
  matchQabOutboxDeferralCode,
  emptyQabOutboxDrainReport,
  emptyQabSlugLearnPhaseReport,
  collectQabPermanentFailures,
  QabTenantMismatchError,
} from "@/lib/qab/outboxAck";
import { qabOutboxDrainReportSchema, qabSlugLearnPhaseReportSchema } from "@/schemas/qabSync";
import type { IOutboxEvento } from "@/schemas/qabOutbox";
import {
  QAB_OUTBOX_ERROR_MAX_LENGTH,
  QAB_OUTBOX_PERMANENT_ERROR_CODES,
  QAB_OUTBOX_DEFERRED_ERROR_CODES,
} from "@/constants/qab";

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
    // F-028 (part B), contract § 11.3: `deferrals` is a new required key of the OUTPUT type
    // (the schema's `.default([])` only affects parsing) — dev-tester owns this update, named
    // by the contract so it does not get discovered by accident.
    const outcome = { kind: "error" as const, ultimoError: "TRANSPORT:unreachable" };
    expect(planOutboxAck([], outcome)).toEqual({ processedIds: [], failedAcks: [], deferrals: [] });
  });

  it("should return the three empty lists for an empty row list under a normal (kind: ok) outcome too", () => {
    // Ids appearing in the response mean nothing when `rows` is empty: nothing was sent, so
    // nothing can be acked or deferred. Reinforces the "IGNORE ids this run never sent" property
    // for the specific case of an empty batch.
    const outcome = {
      kind: "ok" as const,
      response: { ok: ["1"], failed: [{ id: "2", error: "whatever" }], results: [] },
    };
    expect(planOutboxAck([], outcome)).toEqual({ processedIds: [], failedAcks: [], deferrals: [] });
  });
});

/**
 * F-028 (part B), contract § 5.1 — the pure classification acceptance criterion 10 asks for
 * directly: is a `failed[]` entry's `error` a "not yet" (never gasta intento) or a "wrong" (gasta
 * intento as always)? ADR 0103 § 1 fixes EXACT equality against a closed, own list — never
 * `includes`, never case/whitespace normalisation — because here a false positive RETIRES the
 * six-attempt guard of ADR 0011, not just adds a log line (the asymmetry `collectQabPermanentFailures`
 * does not have, which is why that function's `includes` match is not a template to copy — E-032).
 */
describe("matchQabOutboxDeferralCode", () => {
  it("should return the matching member of QAB_OUTBOX_DEFERRED_ERROR_CODES for an EXACT match", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    expect(matchQabOutboxDeferralCode(code)).toBe(code);
  });

  it("should return the CONSTANT member itself even when the received string is a freshly built value with the same content — nothing QAB sends travels further than this comparison", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    // Built at runtime rather than reusing the same reference, so this cannot pass by accident
    // through object identity of a shared literal.
    const receivedFromWire = String(code).slice(0);
    expect(matchQabOutboxDeferralCode(receivedFromWire)).toBe(code);
  });

  it("should return undefined when the case differs — case sensitive, no normalisation", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    expect(matchQabOutboxDeferralCode(code.toLowerCase())).toBeUndefined();
  });

  it("should return undefined when the string carries surrounding whitespace — no trim", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    expect(matchQabOutboxDeferralCode(` ${code} `)).toBeUndefined();
  });

  it("should return undefined when the code appears only as a PREFIXED substring — no includes/startsWith search", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    expect(matchQabOutboxDeferralCode(`EVENT:${code}`)).toBeUndefined();
  });

  it("should return undefined when the code appears only as a SUFFIXED substring, with trailing free text", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    expect(matchQabOutboxDeferralCode(`${code} y algo más`)).toBeUndefined();
  });

  it("should return undefined for an empty string", () => {
    expect(matchQabOutboxDeferralCode("")).toBeUndefined();
  });

  it("should return undefined for unrelated free-form QAB error text", () => {
    expect(matchQabOutboxDeferralCode("STORE_OPENING_HOURS_INVALID")).toBeUndefined();
  });

  it("should never throw: === between two strings has no failure mode (E-031)", () => {
    expect(() => matchQabOutboxDeferralCode("anything at all \n\t ")).not.toThrow();
    expect(() => matchQabOutboxDeferralCode("")).not.toThrow();
  });
});

/**
 * F-028 (part B), contract § 5.2 — `planOutboxAck`'s partition grows from two lists to three,
 * and stays TOTAL: every row of `rows` lands in EXACTLY one of `processedIds` / `failedAcks` /
 * `deferrals`. `deferrals` is the disposition the caller writes NOTHING for (ADR 0102): no
 * `procesadoAt`, no `intentos`, no `ultimoError` — verified here by the row's id being absent from
 * both of the other two lists, which is the entire write surface this pure function offers.
 */
describe("planOutboxAck — deferrals (F-028 part B)", () => {
  it("should place a failed[] entry whose error matches the deferral code EXACTLY into `deferrals`, built from the LOCAL row — not from the response", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const rows = [row({ id: "1", negocioId: "negocio-1", entidad: "PRODUCT", entidadId: "producto-1" })];
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: code }], results: [] },
    };

    const plan = planOutboxAck(rows, outcome);

    expect(plan.deferrals).toEqual([
      { eventId: "1", negocioId: "negocio-1", entidad: "PRODUCT", entidadId: "producto-1", code },
    ]);
    expect(plan.processedIds).toEqual([]);
    expect(plan.failedAcks).toEqual([]);
  });

  it("should place every row of a mixed batch — its own failure, a deferral, and an ok — in EXACTLY one of the three lists, none in two and none in zero", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const rows = [
      row({ id: "1", entidad: "CATEGORY", entidadId: "cat-1" }),
      row({ id: "2", entidad: "PRODUCT", entidadId: "prod-1" }),
      row({ id: "3", entidad: "PRODUCT", entidadId: "prod-2" }),
    ];
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: ["3"],
        failed: [
          { id: "1", error: "CATEGORY_INVALID_SOMETHING" },
          { id: "2", error: code },
        ],
        results: [],
      },
    };

    const plan = planOutboxAck(rows, outcome);

    expect(plan.processedIds).toEqual(["3"]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: "EVENT:CATEGORY_INVALID_SOMETHING" }]);
    expect(plan.deferrals).toEqual([
      { eventId: "2", negocioId: "negocio-1", entidad: "PRODUCT", entidadId: "prod-1", code },
    ]);

    const allIds = [
      ...plan.processedIds,
      ...plan.failedAcks.map((f) => f.id),
      ...plan.deferrals.map((d) => d.eventId),
    ];
    expect(allIds.sort()).toEqual(["1", "2", "3"]);
    expect(new Set(allIds).size).toBe(allIds.length); // no id counted twice across lists
  });

  it("should list multiple deferred rows in the ORDER THEY APPEAR IN `rows`, not in the order the response mentions them", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const rows = [row({ id: "1" }), row({ id: "2" }), row({ id: "3" })];
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: [],
        // "3" listed before "1" in the wire response; "2" is absent (MISSING_IN_RESPONSE).
        failed: [
          { id: "3", error: code },
          { id: "1", error: code },
        ],
        results: [],
      },
    };

    const plan = planOutboxAck(rows, outcome);

    expect(plan.deferrals.map((d) => d.eventId)).toEqual(["1", "3"]);
    expect(plan.failedAcks).toEqual([{ id: "2", ultimoError: "MISSING_IN_RESPONSE" }]);
  });

  it("should classify by ERROR CODE ALONE, never by entity type — a CURRENCY/EXCHANGE_RATE pair defers exactly like a CATEGORY/PRODUCT pair", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const rows = [
      row({ id: "1", entidad: "CURRENCY", entidadId: "USD" }),
      row({ id: "2", entidad: "EXCHANGE_RATE", entidadId: "USD-rate" }),
    ];
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: [],
        failed: [
          { id: "1", error: "CURRENCY_INVALID" },
          { id: "2", error: code },
        ],
        results: [],
      },
    };

    const plan = planOutboxAck(rows, outcome);

    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: "EVENT:CURRENCY_INVALID" }]);
    expect(plan.deferrals).toEqual([
      { eventId: "2", negocioId: "negocio-1", entidad: "EXCHANGE_RATE", entidadId: "USD-rate", code },
    ]);
  });

  it("should defer when an id is in BOTH ok and failed with the deferral code — failed still wins over ok, and here that is also the safe outcome (the contract says a deferred event never applied)", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const outcome = {
      kind: "ok" as const,
      response: { ok: ["1"], failed: [{ id: "1", error: code }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals.map((d) => d.eventId)).toEqual(["1"]);
    expect(plan.processedIds).toEqual([]);
    expect(plan.failedAcks).toEqual([]);
  });

  it("should defer when an id has TWO failed[] entries and the LAST one carries the deferral code — last entry wins, same rule as today's Map construction", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: [],
        failed: [
          { id: "1", error: "own transient error" },
          { id: "1", error: code },
        ],
        results: [],
      },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals.map((d) => d.eventId)).toEqual(["1"]);
    expect(plan.failedAcks).toEqual([]);
  });

  it("should NOT defer when an id has two failed[] entries and the LAST one is a normal error — last wins, so a non-deferral final entry still spends an attempt", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const outcome = {
      kind: "ok" as const,
      response: {
        ok: [],
        failed: [
          { id: "1", error: code },
          { id: "1", error: "final own error" },
        ],
        results: [],
      },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: "EVENT:final own error" }]);
  });

  it("should IGNORE a failed[] entry with the deferral code whose id does not belong to the given rows — QAB cannot exempt a row it was not given", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "999", error: code }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    // "1" was sent but got no response of its own: MISSING_IN_RESPONSE, same as today.
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: "MISSING_IN_RESPONSE" }]);
    expect(plan.processedIds).toEqual([]);
  });

  it("should return an empty `deferrals` when the whole request failed (kind: error) — a transport/HTTP failure is not attributable to any single event, so nothing is known to be deferred", () => {
    const outcome = { kind: "error" as const, ultimoError: "TRANSPORT:socket hang up" };
    const rows = [row({ id: "1" }), row({ id: "2" })];

    const plan = planOutboxAck(rows, outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([
      { id: "1", ultimoError: "TRANSPORT:socket hang up" },
      { id: "2", ultimoError: "TRANSPORT:socket hang up" },
    ]);
  });

  it("should leave `deferrals` empty when nothing failed — a fully successful run moves nothing to the new list (criterion 9's positive control, at the pure level)", () => {
    const rows = [row({ id: "1" }), row({ id: "2" })];
    const outcome = { kind: "ok" as const, response: { ok: ["1", "2"], failed: [], results: [] } };

    const plan = planOutboxAck(rows, outcome);

    expect(plan.processedIds).toEqual(["1", "2"]);
    expect(plan.failedAcks).toEqual([]);
    expect(plan.deferrals).toEqual([]);
  });

  it("should SPEND an attempt (never defer) when `error` merely CONTAINS the deferral code as a prefixed substring — the false positive that matters most: it would retire the six-attempt guard", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    // Deliberately NOT the "EVENT:" prefix planOutboxAck itself adds to a stored ultimoError —
    // this is a value QAB is imagined to have SENT, prefixed with detail of its own.
    const nearMiss = `BATCH_CONTEXT:${code}`;
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: nearMiss }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: `EVENT:${nearMiss}` }]);
  });

  it("should SPEND an attempt (never defer) when `error` merely CONTAINS the deferral code as a suffixed substring with trailing free text", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const nearMiss = `${code} y algo más`;
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: nearMiss }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: `EVENT:${nearMiss}` }]);
  });

  it("should SPEND an attempt (never defer) when `error` differs only in CASE from the deferral code", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const nearMiss = code.toLowerCase();
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: nearMiss }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: `EVENT:${nearMiss}` }]);
  });

  it("should SPEND an attempt (never defer) when `error` has the deferral code surrounded by whitespace", () => {
    const code = QAB_OUTBOX_DEFERRED_ERROR_CODES[0];
    const nearMiss = ` ${code} `;
    const outcome = {
      kind: "ok" as const,
      response: { ok: [], failed: [{ id: "1", error: nearMiss }], results: [] },
    };

    const plan = planOutboxAck([row({ id: "1" })], outcome);

    expect(plan.deferrals).toEqual([]);
    expect(plan.failedAcks).toEqual([{ id: "1", ultimoError: `EVENT:${nearMiss}` }]);
  });
});

describe("emptyQabOutboxDrainReport", () => {
  // F-027 (contract v12.1, § 7.3): `withheld: []` was added here — what the day
  // the switch is turned on looks like. Updated in place rather than left red,
  // since the contract fixes this exact shape and dev-tester owns this file.
  it("should return every counter at zero, both arrays empty, NO permanent failures (F-005), NO applied STORE events (F-020), NO withheld backlog (F-027) and NO deferrals (F-028 part B)", () => {
    // F-028 (part B), contract § 11.3: `deferrals: []` is the third named preexisting assertion
    // this contract invalidates — updated in place, dev-tester's job per that section.
    expect(emptyQabOutboxDrainReport()).toEqual({
      claimed: 0,
      eventIds: [],
      businesses: 0,
      processed: 0,
      failed: 0,
      byBusiness: [],
      permanentFailures: [],
      appliedStoreEvents: [],
      withheld: [],
      deferrals: [],
    });
  });

  it("should itself satisfy qabOutboxDrainReportSchema", () => {
    expect(qabOutboxDrainReportSchema.safeParse(emptyQabOutboxDrainReport()).success).toBe(true);
  });
});

/**
 * F-020 — contract §3: `emptyQabSlugLearnPhaseReport`, the empty value of the slug-learning
 * phase's report, used by `syncTiendaCron.ts`'s early return when `QAB_API_BASE_URL` is unset
 * and by `learnQabAssignedSlugs` itself when `negocioIds` is empty.
 */
describe("emptyQabSlugLearnPhaseReport", () => {
  it("should return every counter at zero and an empty results array", () => {
    expect(emptyQabSlugLearnPhaseReport()).toEqual({
      targets: 0,
      attempted: 0,
      learned: 0,
      results: [],
    });
  });

  it("should itself satisfy qabSlugLearnPhaseReportSchema", () => {
    expect(qabSlugLearnPhaseReportSchema.safeParse(emptyQabSlugLearnPhaseReport()).success).toBe(true);
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
