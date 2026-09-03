import { describe, it, expect, vi } from "vitest";
import {
  loadOnlineStoreEnabledBusinesses,
  partitionOutboxEventsByOnlineStore,
  enqueueOutboxEventsForEnabledBusinesses,
} from "@/lib/qab/outboxGuard";
import type { IOutboxEventoCreate } from "@/schemas/qabOutbox";
import type { PrismaClientLike } from "@/lib/prisma";

/**
 * F-003 — `src/lib/qab/outboxGuard.ts` (ADR 0021). This is the OutboxEvento half of
 * criterion 3: "un negocio con el interruptor apagado no genera eventos en OutboxEvento...
 * aunque tenga token." `enqueueOutboxEvent`/`enqueueOutboxEvents` are NOT touched by this
 * feature — this guard wraps them so F-006 can swap one import and get the opt-in for free.
 *
 * `partitionOutboxEventsByOnlineStore` is pure and is the piece the spec explicitly calls out
 * as what a unit test can cover today, since no production caller of the outbox exists yet
 * (F-006). Every fixture below mixes an ENABLED and a DISABLED business in the same call: with
 * only one business present, "filtered" and "unfiltered" would return the same thing and the
 * test would pass against broken code too (E-008).
 */

const ENABLED_NEGOCIO = "negocio-enabled";
const DISABLED_NEGOCIO = "negocio-disabled";

function event(negocioId: string, entidadId: string): IOutboxEventoCreate {
  return {
    negocioId,
    entidad: "PRODUCT",
    entidadId,
    operacion: "UPDATE",
    payload: { storeProductId: entidadId },
  };
}

describe("partitionOutboxEventsByOnlineStore", () => {
  it("should split events into allowed/skipped by membership in the enabled set", () => {
    const enabled = new Set([ENABLED_NEGOCIO]);
    const events = [event(ENABLED_NEGOCIO, "p1"), event(DISABLED_NEGOCIO, "p2")];

    const result = partitionOutboxEventsByOnlineStore(events, enabled);

    expect(result.allowed).toEqual([event(ENABLED_NEGOCIO, "p1")]);
    expect(result.skipped).toEqual([event(DISABLED_NEGOCIO, "p2")]);
  });

  it("should preserve input order within each side", () => {
    const enabled = new Set([ENABLED_NEGOCIO]);
    const events = [
      event(ENABLED_NEGOCIO, "p1"),
      event(DISABLED_NEGOCIO, "p2"),
      event(ENABLED_NEGOCIO, "p3"),
      event(DISABLED_NEGOCIO, "p4"),
    ];

    const result = partitionOutboxEventsByOnlineStore(events, enabled);

    expect(result.allowed.map((e) => e.entidadId)).toEqual(["p1", "p3"]);
    expect(result.skipped.map((e) => e.entidadId)).toEqual(["p2", "p4"]);
  });

  it("should return everything as skipped when the enabled set is empty", () => {
    const events = [event(ENABLED_NEGOCIO, "p1"), event(DISABLED_NEGOCIO, "p2")];

    const result = partitionOutboxEventsByOnlineStore(events, new Set());

    expect(result.allowed).toEqual([]);
    expect(result.skipped).toEqual(events);
  });

  it("should return everything as allowed when every business is enabled", () => {
    const enabled = new Set([ENABLED_NEGOCIO, DISABLED_NEGOCIO]);
    const events = [event(ENABLED_NEGOCIO, "p1"), event(DISABLED_NEGOCIO, "p2")];

    const result = partitionOutboxEventsByOnlineStore(events, enabled);

    expect(result.allowed).toEqual(events);
    expect(result.skipped).toEqual([]);
  });

  it("should return two empty arrays for an empty input, without inspecting the enabled set", () => {
    const result = partitionOutboxEventsByOnlineStore([], new Set());
    expect(result).toEqual({ allowed: [], skipped: [] });
  });
});

describe("loadOnlineStoreEnabledBusinesses", () => {
  it("should return a Set of the ids Prisma reports as enabled", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadOnlineStoreEnabledBusinesses(tx, ["a", "b", "c"]);

    expect(result).toBeInstanceOf(Set);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("should query by tiendaOnlineHabilitada: true", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    await loadOnlineStoreEnabledBusinesses(tx, ["a"]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tiendaOnlineHabilitada: true }),
      })
    );
  });

  it("should return an empty Set, not throw, when none of the given ids are enabled", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadOnlineStoreEnabledBusinesses(tx, ["a", "b"]);

    expect(result).toEqual(new Set());
  });

  it("should treat an EMPTY negocioIds array as 'none' -> an empty Set, WITHOUT touching the database", async () => {
    // Same convention as `loadNegocioIdsWithQabToken`, deliberately kept symmetric so two
    // neighboring functions don't force a caller to guess which one treats `[]` how. Here the
    // argument is mandatory (no "todos" case exists for a guard: enqueuing is always for a
    // known set of businesses), so `[]` unconditionally means "none", with an early return.
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadOnlineStoreEnabledBusinesses(tx, []);

    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("enqueueOutboxEventsForEnabledBusinesses", () => {
  /** Throws the moment any tx method is CALLED — proves no write was attempted. */
  function explodingTx(): PrismaClientLike {
    const explode = () => {
      throw new Error("must not touch the database for this input");
    };
    return {
      negocio: new Proxy({}, { get: () => explode }),
      outboxEvento: new Proxy({}, { get: () => explode }),
    } as unknown as PrismaClientLike;
  }

  it("inputs: [] should return { ids: [], skipped: 0 } without touching the database", async () => {
    await expect(enqueueOutboxEventsForEnabledBusinesses(explodingTx(), [])).resolves.toEqual({
      ids: [],
      skipped: 0,
    });
  });

  it("should discard every event and never write when no business in the input is enabled", async () => {
    const negocioFindMany = vi.fn().mockResolvedValue([]); // nobody is enabled
    const outboxCalls: Array<{ method: string; args: unknown[] }> = [];
    const tx = {
      negocio: { findMany: negocioFindMany },
      outboxEvento: new Proxy(
        {},
        {
          get(_t, prop: string) {
            return (...args: unknown[]) => {
              outboxCalls.push({ method: prop, args });
              return Promise.resolve([]);
            };
          },
        }
      ),
    } as unknown as PrismaClientLike;

    const inputs = [event(DISABLED_NEGOCIO, "p1"), event(DISABLED_NEGOCIO, "p2")];
    const result = await enqueueOutboxEventsForEnabledBusinesses(tx, inputs);

    expect(result).toEqual({ ids: [], skipped: 2 });
    expect(outboxCalls).toHaveLength(0);
  });

  it("should write only the events of the enabled business, never the disabled one's data, in a mixed batch", async () => {
    const negocioFindMany = vi.fn().mockResolvedValue([{ id: ENABLED_NEGOCIO }]);
    const outboxCalls: Array<{ method: string; args: unknown[] }> = [];
    const tx = {
      negocio: { findMany: negocioFindMany },
      outboxEvento: new Proxy(
        {},
        {
          get(_t, prop: string) {
            return (...args: unknown[]) => {
              outboxCalls.push({ method: prop, args });
              return Promise.resolve([{ id: BigInt(1) }]);
            };
          },
        }
      ),
    } as unknown as PrismaClientLike;

    const inputs = [event(ENABLED_NEGOCIO, "allowed-product"), event(DISABLED_NEGOCIO, "skipped-product")];
    const result = await enqueueOutboxEventsForEnabledBusinesses(tx, inputs);

    expect(result.skipped).toBe(1);

    // Content-based check, independent of whether the implementation writes with `create`,
    // `createMany` or `createManyAndReturn`: the disabled business's row must never reach
    // any Prisma write call, and the enabled one's must.
    const writtenArgs = JSON.stringify(outboxCalls);
    expect(writtenArgs).toContain("allowed-product");
    expect(writtenArgs).not.toContain("skipped-product");
    expect(writtenArgs).not.toContain(DISABLED_NEGOCIO);
  });
});
