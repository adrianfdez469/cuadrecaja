import { describe, it, expect } from "vitest";
import {
  QAB_STORE_ENTITY,
  qabPublishedPayloadFilter,
  qabAppliedPublishWhere,
  collectQabAppliedStorePublishes,
} from "@/lib/qab/qabStoreOutboxFilters";
import type { IOutboxEvento } from "@/schemas/qabOutbox";

/**
 * F-020 — `src/lib/qab/qabStoreOutboxFilters.ts` (contract §4, ADR 0036b), the SINGLE
 * definition of "a publish of this local was already applied" (E-014). Everything here is
 * pure: no `prisma`, no `qabPrisma`.
 *
 * `qabAppliedPublishWhere`'s shape is asserted literally, key by key, per contract §4 — this
 * is the where clause `readQabSlugLearningTargets` sends to the database, so a wrong shape
 * here would either miss real candidates or (worse) widen the eligible set across tenants.
 */

const NEGOCIO_A = "negocio-a";
const NEGOCIO_B = "negocio-b";
const TIENDA_1 = "tienda-1";
const TIENDA_2 = "tienda-2";

function outboxRow(overrides: Partial<IOutboxEvento> = {}): IOutboxEvento {
  return {
    id: "1",
    negocioId: NEGOCIO_A,
    entidad: "STORE",
    entidadId: TIENDA_1,
    operacion: "UPDATE",
    ocurridoAt: new Date("2026-09-01T10:00:00.000Z"),
    payload: { publishToStore: true },
    intentos: 0,
    procesadoAt: new Date("2026-09-01T10:00:05.000Z"),
    ultimoError: null,
    ...overrides,
  };
}

describe("QAB_STORE_ENTITY", () => {
  it('should be the literal "STORE" — the one place this string is written (E-014)', () => {
    expect(QAB_STORE_ENTITY).toBe("STORE");
  });
});

describe("qabPublishedPayloadFilter", () => {
  it("should be the Prisma JSON filter for payload.publishToStore === true", () => {
    expect(qabPublishedPayloadFilter).toEqual({ path: ["publishToStore"], equals: true });
  });
});

describe("qabAppliedPublishWhere", () => {
  it("should return the exact five-key shape of contract §4", () => {
    const where = qabAppliedPublishWhere({
      negocioIds: [NEGOCIO_A, NEGOCIO_B],
      tiendaIds: [TIENDA_1, TIENDA_2],
    });

    expect(where).toEqual({
      negocioId: { in: [NEGOCIO_A, NEGOCIO_B] },
      entidad: "STORE",
      entidadId: { in: [TIENDA_1, TIENDA_2] },
      payload: qabPublishedPayloadFilter,
      procesadoAt: { not: null },
    });
  });

  it("should always include negocioId, even for a single business — multi-tenant isolation is structural (§15)", () => {
    const where = qabAppliedPublishWhere({ negocioIds: [NEGOCIO_A], tiendaIds: [TIENDA_1] });

    expect(where).toHaveProperty("negocioId", { in: [NEGOCIO_A] });
  });

  it("should return exactly the five documented keys — no more, no less", () => {
    const where = qabAppliedPublishWhere({ negocioIds: [NEGOCIO_A], tiendaIds: [TIENDA_1] });

    expect(Object.keys(where).sort()).toEqual(
      ["entidad", "entidadId", "negocioId", "payload", "procesadoAt"].sort()
    );
  });

  it("should reuse the SAME qabPublishedPayloadFilter reference for payload, not a re-derived copy", () => {
    const where = qabAppliedPublishWhere({ negocioIds: [NEGOCIO_A], tiendaIds: [TIENDA_1] });

    expect(where.payload).toBe(qabPublishedPayloadFilter);
  });
});

describe("collectQabAppliedStorePublishes — the (negocioId, tiendaId) pairs of applied STORE publishes", () => {
  it("should include a STORE event that published (publishToStore: true) and was acknowledged", () => {
    const row = outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1 });

    const result = collectQabAppliedStorePublishes([row], ["1"]);

    expect(result).toEqual([{ negocioId: NEGOCIO_A, tiendaId: TIENDA_1 }]);
  });

  it("should EXCLUDE a STORE event whose payload has publishToStore: false, even when acknowledged — the E-013 control", () => {
    const row = outboxRow({
      id: "1",
      negocioId: NEGOCIO_A,
      entidadId: TIENDA_1,
      payload: { publishToStore: false },
    });

    const result = collectQabAppliedStorePublishes([row], ["1"]);

    expect(result).toEqual([]);
  });

  it("should EXCLUDE a STORE event that published but is NOT in processedIds — emitted, never acknowledged", () => {
    const row = outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1 });

    const result = collectQabAppliedStorePublishes([row], []);

    expect(result).toEqual([]);
  });

  it("should EXCLUDE an entity that is not STORE, even with publishToStore: true and an acknowledged id", () => {
    const row = outboxRow({
      id: "1",
      negocioId: NEGOCIO_A,
      entidad: "PRODUCT",
      entidadId: TIENDA_1,
    });

    const result = collectQabAppliedStorePublishes([row], ["1"]);

    expect(result).toEqual([]);
  });

  it("should ignore an id in processedIds that does not belong to `rows` — same discipline as planOutboxAck", () => {
    const row = outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1 });

    const result = collectQabAppliedStorePublishes([row], ["1", "some-other-run-id"]);

    expect(result).toEqual([{ negocioId: NEGOCIO_A, tiendaId: TIENDA_1 }]);
  });

  it("should read the payload defensively: a non-object payload never crashes, and never counts as published", () => {
    const rows = [
      outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1, payload: "not-an-object" }),
      outboxRow({ id: "2", negocioId: NEGOCIO_A, entidadId: TIENDA_2, payload: null }),
    ];

    expect(() => collectQabAppliedStorePublishes(rows, ["1", "2"])).not.toThrow();
    expect(collectQabAppliedStorePublishes(rows, ["1", "2"])).toEqual([]);
  });

  it("should deduplicate the same (negocioId, tiendaId) pair reported by two different applied events", () => {
    const rows = [
      outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1 }),
      outboxRow({ id: "2", negocioId: NEGOCIO_A, entidadId: TIENDA_1 }),
    ];

    const result = collectQabAppliedStorePublishes(rows, ["1", "2"]);

    expect(result).toEqual([{ negocioId: NEGOCIO_A, tiendaId: TIENDA_1 }]);
  });

  it("should return pairs in the order the rows come, not sorted", () => {
    const rows = [
      outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_2 }),
      outboxRow({ id: "2", negocioId: NEGOCIO_A, entidadId: TIENDA_1 }),
    ];

    const result = collectQabAppliedStorePublishes(rows, ["1", "2"]);

    expect(result).toEqual([
      { negocioId: NEGOCIO_A, tiendaId: TIENDA_2 },
      { negocioId: NEGOCIO_A, tiendaId: TIENDA_1 },
    ]);
  });

  it("should never mix two businesses' tiendaId into the wrong pair — multi-tenant isolation", () => {
    const rows = [
      outboxRow({ id: "1", negocioId: NEGOCIO_A, entidadId: TIENDA_1 }),
      outboxRow({ id: "2", negocioId: NEGOCIO_B, entidadId: TIENDA_1 }),
    ];

    const result = collectQabAppliedStorePublishes(rows, ["1", "2"]);

    expect(result).toEqual([
      { negocioId: NEGOCIO_A, tiendaId: TIENDA_1 },
      { negocioId: NEGOCIO_B, tiendaId: TIENDA_1 },
    ]);
  });

  it("should return [] for an empty rows array", () => {
    expect(collectQabAppliedStorePublishes([], ["1"])).toEqual([]);
  });
});
