import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ITiendaOnlineLocalUpdate } from "@/schemas/tiendaOnline";
import type { PrismaClientLike } from "@/lib/prisma";

/**
 * F-005, ciclo 2 — `src/lib/tiendaOnline/tiendaOnlineStore.ts` (contract §0.1,
 * §4, §5.1) and [ADR 0035](../../docs/adr/0035-la-senal-del-primer-publish-se-filtra-por-el-payload.md).
 *
 * `.agents/__tests__/tiendaOnlineStore.test.ts` already covers the rest of this
 * module (multi-tenant isolation of the read/write, ALMACEN rejection, criterion
 * 5/E-008, the return shape). This file is additive: it covers ONLY what the
 * ciclo-1 defect exposed — the first-publish signal has to be derived from the
 * event's `payload`, not from its mere existence, and `operacion` no longer
 * shares that signal.
 *
 * The ciclo-1 bug, twice over:
 *   1. The UI used `slugQab != null` as "already published" — nothing writes
 *      that column, so it read `false` forever. Covered separately in
 *      `publicationStatusCard.test.ts` (blocked — see the note in that file).
 *   2. `firstPublishPending` was "no STORE event was ever emitted" while every
 *      applied PATCH emits one — so saving contact data before the first
 *      publish silently consumed the brand question. THIS is what this file
 *      exercises: the signal has to survive a PATCH that emits with
 *      `publishToStore: false`.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const OTHER_NEGOCIO_ID = "9a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5061";
const TIENDA_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-04T12:00:00.000Z");

const transactionMock = vi.fn();
const tiendaFindManyMock = vi.fn().mockResolvedValue([]);
const outboxFindManyMock = vi.fn().mockResolvedValue([]);
const outboxGroupByMock = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    tienda: { findMany: tiendaFindManyMock },
    outboxEvento: { findMany: outboxFindManyMock, groupBy: outboxGroupByMock },
  },
}));

const {
  saveTiendaOnlineLocal,
  listTiendaOnlineLocales,
  hasEverPublishedToStore,
  hasAnyStoreEvent,
} = await import("@/lib/tiendaOnline/tiendaOnlineStore");

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TIENDA_ID,
    nombre: "Sucursal Centro",
    tipo: "TIENDA",
    publicarEnTienda: true,
    slug: "sucursal-centro",
    slugQab: null,
    descripcion: null,
    direccion: null,
    ciudad: null,
    provincia: null,
    latitud: null,
    longitud: null,
    telefono: "+5350000000",
    whatsapp: null,
    email: null,
    horarios: null,
    motivoDespublicacion: null,
    negocio: { nombre: "Bodega Central" },
    ...overrides,
  };
}

function baseUpdateInput(overrides: Partial<ITiendaOnlineLocalUpdate> = {}): ITiendaOnlineLocalUpdate {
  return {
    publicarEnTienda: true,
    slug: "sucursal-centro",
    descripcion: null,
    direccion: null,
    ciudad: null,
    provincia: null,
    latitud: null,
    longitud: null,
    telefono: "+5350000000",
    whatsapp: null,
    email: null,
    horarios: null,
    motivoDespublicacion: null,
    ...overrides,
  };
}

beforeEach(() => {
  transactionMock.mockReset();
  tiendaFindManyMock.mockReset().mockResolvedValue([]);
  outboxFindManyMock.mockReset().mockResolvedValue([]);
  outboxGroupByMock.mockReset().mockResolvedValue([]);
});

/* -------------------------------------------------------------------------- */
/* Part 1 — hasEverPublishedToStore / hasAnyStoreEvent, unit-tested directly.  */
/* -------------------------------------------------------------------------- */

/**
 * A standalone `tx.outboxEvento.findFirst` stub. `matched` decides what THIS
 * particular where-clause resolves to, so a test can simulate "events exist,
 * but none of them satisfy the payload filter" versus "one of them does".
 */
function makeOutboxFindFirstStub(matched: boolean) {
  const wheres: Array<Record<string, unknown>> = [];
  const findFirst = vi.fn(async (args: { where: Record<string, unknown> }) => {
    wheres.push(args.where);
    return matched ? { id: BigInt(1) } : null;
  });
  const tx = { outboxEvento: { findFirst } } as unknown as PrismaClientLike;
  return { tx, wheres };
}

describe("hasEverPublishedToStore — filters by payload.publishToStore, not by existence (ADR 0035)", () => {
  it("should query with negocioId, entidad STORE, entidadId AND payload: { path: ['publishToStore'], equals: true }", async () => {
    const { tx, wheres } = makeOutboxFindFirstStub(false);

    await hasEverPublishedToStore(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(wheres).toHaveLength(1);
    expect(wheres[0]).toEqual({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: TIENDA_ID,
      payload: { path: ["publishToStore"], equals: true },
    });
  });

  it("should return false when the local has STORE events but none carries publishToStore: true — the exact ciclo-1 scenario", async () => {
    // `matched: false` simulates a local with, say, five prior STORE events, all
    // emitted by plain saves (publishToStore: false): the payload-filtered
    // query finds none of them, so the brand question must stay open.
    const { tx } = makeOutboxFindFirstStub(false);

    const result = await hasEverPublishedToStore(tx, {
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
    });

    expect(result).toBe(false);
  });

  it("should return true as soon as one STORE event of the local carries publishToStore: true", async () => {
    const { tx } = makeOutboxFindFirstStub(true);

    const result = await hasEverPublishedToStore(tx, {
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
    });

    expect(result).toBe(true);
  });

  it("should scope the query to the given negocioId even when a same-id local exists in another business", async () => {
    const { tx, wheres } = makeOutboxFindFirstStub(false);

    await hasEverPublishedToStore(tx, { negocioId: OTHER_NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(wheres[0]).toMatchObject({ negocioId: OTHER_NEGOCIO_ID });
  });
});

describe("hasAnyStoreEvent — the UNFILTERED question that operacion needs (ADR 0035)", () => {
  it("should query with negocioId, entidad STORE and entidadId, and NO payload filter", async () => {
    const { tx, wheres } = makeOutboxFindFirstStub(false);

    await hasAnyStoreEvent(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(wheres).toHaveLength(1);
    expect(wheres[0]).toEqual({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: TIENDA_ID,
    });
    expect(wheres[0]).not.toHaveProperty("payload");
  });

  it("should return true for a local whose only STORE event carries publishToStore: false — it still counts as emitted", async () => {
    const { tx } = makeOutboxFindFirstStub(true);

    const result = await hasAnyStoreEvent(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(result).toBe(true);
  });

  it("should return false when no STORE event exists for the local at all", async () => {
    const { tx } = makeOutboxFindFirstStub(false);

    const result = await hasAnyStoreEvent(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(result).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Part 2 — saveTiendaOnlineLocal: operacion vs firstPublishPending no longer  */
/* share a signal, and the PATCH response formula (contract §5.1 step 10).    */
/* -------------------------------------------------------------------------- */

/**
 * Drives `saveTiendaOnlineLocal` end to end with a tx whose
 * `outboxEvento.findFirst` distinguishes the payload-filtered call from the
 * unfiltered one purely by inspecting the where clause it receives — exactly
 * the two predicates the contract documents, so this does not assume which of
 * the two runs first or how many times either runs.
 */
function makeTx(options: {
  existingRow: Record<string, unknown> | null;
  /** Whether a payload-filtered STORE event (publishToStore: true) exists. */
  everPublishedBefore: boolean;
  /** Whether ANY STORE event exists at all, filtered or not. */
  anyEventExists: boolean;
}) {
  const outboxFindFirstWheres: Array<Record<string, unknown>> = [];
  const outboxCreateCalls: Array<Record<string, unknown>> = [];

  const tx = {
    tienda: {
      findFirst: vi.fn(async () => options.existingRow),
      update: vi.fn(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        return { ...options.existingRow, ...data };
      }),
    },
    outboxEvento: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        outboxFindFirstWheres.push(args.where);
        const isPayloadFiltered = "payload" in args.where;
        const matched = isPayloadFiltered
          ? options.everPublishedBefore
          : options.anyEventExists;
        return matched ? { id: BigInt(1) } : null;
      }),
      create: vi.fn(async (args: Record<string, unknown>) => {
        outboxCreateCalls.push(args);
        return { id: BigInt(1) };
      }),
    },
  };

  return { tx, outboxFindFirstWheres, outboxCreateCalls };
}

function runSave(
  tx: unknown,
  input: Partial<ITiendaOnlineLocalUpdate> = {},
) {
  transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn(tx));
  return saveTiendaOnlineLocal({
    negocioId: NEGOCIO_ID,
    tiendaId: TIENDA_ID,
    input: baseUpdateInput(input),
    now: () => NOW,
  });
}

describe("saveTiendaOnlineLocal — operacion and firstPublishPending are DIFFERENT questions (ADR 0035)", () => {
  it('should enqueue operacion "UPDATE" AND report firstPublishPending: true for a local whose only STORE event never published', async () => {
    // The distinguishing case the ciclo-1 contract collapsed: a row exists on
    // QAB's side already (an event was emitted, so operacion has to be
    // UPDATE), but that event never carried publishToStore: true, so the brand
    // question is still open. A contract that shares one signal for both
    // cannot produce this combination.
    const { tx, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: true,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    const created = outboxCreateCalls[0].data as { operacion: string };
    expect(created.operacion).toBe("UPDATE");
    expect(result.local.firstPublishPending).toBe(true);
  });

  it('should enqueue operacion "CREATE" when no STORE event exists for the local at all', async () => {
    const { tx, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: false,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    const created = outboxCreateCalls[0].data as { operacion: string };
    expect(created.operacion).toBe("CREATE");
    expect(result.local.firstPublishPending).toBe(true);
  });

  it('should enqueue operacion "UPDATE" when the local has already published (which implies it has emitted)', async () => {
    const { tx, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: true,
      anyEventExists: true,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    const created = outboxCreateCalls[0].data as { operacion: string };
    expect(created.operacion).toBe("UPDATE");
    expect(result.local.firstPublishPending).toBe(false);
  });

  it("should short-circuit: never call the unfiltered hasAnyStoreEvent query once hasEverPublishedToStore already returned true", async () => {
    const { tx, outboxFindFirstWheres } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: true,
      anyEventExists: true,
    });

    await runSave(tx, { publicarEnTienda: false });

    const payloadFilteredCalls = outboxFindFirstWheres.filter((w) => "payload" in w);
    const unfilteredCalls = outboxFindFirstWheres.filter((w) => !("payload" in w));
    expect(payloadFilteredCalls).toHaveLength(1);
    expect(unfilteredCalls).toHaveLength(0);
  });
});

describe("saveTiendaOnlineLocal — outbox query count per combination (contract §5.1 step 7: the short-circuit is part of the contract, not an optimisation)", () => {
  it("never published AND never emitted -> CREATE, with BOTH outbox queries run (hasAnyStoreEvent has to run: hasEverPublishedToStore alone cannot answer operacion)", async () => {
    const { tx, outboxFindFirstWheres, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: false,
    });

    await runSave(tx, { publicarEnTienda: false });

    const payloadFilteredCalls = outboxFindFirstWheres.filter((w) => "payload" in w);
    const unfilteredCalls = outboxFindFirstWheres.filter((w) => !("payload" in w));
    expect(payloadFilteredCalls).toHaveLength(1);
    expect(unfilteredCalls).toHaveLength(1);
    expect((outboxCreateCalls[0].data as { operacion: string }).operacion).toBe("CREATE");
  });

  it("never published BUT already emitted (a save without publishing before) -> UPDATE, with BOTH outbox queries run", async () => {
    const { tx, outboxFindFirstWheres, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: true,
    });

    await runSave(tx, { publicarEnTienda: false });

    const payloadFilteredCalls = outboxFindFirstWheres.filter((w) => "payload" in w);
    const unfilteredCalls = outboxFindFirstWheres.filter((w) => !("payload" in w));
    expect(payloadFilteredCalls).toHaveLength(1);
    expect(unfilteredCalls).toHaveLength(1);
    expect((outboxCreateCalls[0].data as { operacion: string }).operacion).toBe("UPDATE");
  });

  it("already published -> UPDATE, with ONLY ONE outbox query: hasAnyStoreEvent must NOT run once hasEverPublishedToStore already answered true", async () => {
    const { tx, outboxFindFirstWheres, outboxCreateCalls } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: true,
      anyEventExists: true,
    });

    await runSave(tx, { publicarEnTienda: false });

    const payloadFilteredCalls = outboxFindFirstWheres.filter((w) => "payload" in w);
    const unfilteredCalls = outboxFindFirstWheres.filter((w) => !("payload" in w));
    expect(payloadFilteredCalls).toHaveLength(1);
    expect(unfilteredCalls).toHaveLength(0);
    expect(outboxFindFirstWheres).toHaveLength(1);
    expect((outboxCreateCalls[0].data as { operacion: string }).operacion).toBe("UPDATE");
  });
});

describe("saveTiendaOnlineLocal — the PATCH response formula: firstPublishPending = !(everPublishedBefore || updated.publicarEnTienda)", () => {
  it("never published before + publicarEnTienda: false (a plain save with the switch off) -> firstPublishPending: true", async () => {
    const { tx } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: false,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    expect(result.local.firstPublishPending).toBe(true);
  });

  it("never published before + publicarEnTienda: true (the first publish itself) -> firstPublishPending: false", async () => {
    const { tx } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: false,
    });

    const result = await runSave(tx, { publicarEnTienda: true });

    expect(result.local.firstPublishPending).toBe(false);
  });

  it("published before + publicarEnTienda: false (unpublishing) -> firstPublishPending stays false, the question stays answered", async () => {
    const { tx } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: true,
      anyEventExists: true,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    expect(result.local.firstPublishPending).toBe(false);
  });

  it("published before + publicarEnTienda: true (re-publishing) -> firstPublishPending: false", async () => {
    const { tx } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: true,
      anyEventExists: true,
    });

    const result = await runSave(tx, { publicarEnTienda: true });

    expect(result.local.firstPublishPending).toBe(false);
  });

  it("should NEVER return firstPublishPending: false as a fixed value regardless of input — the exact ciclo-1 defect", async () => {
    // Before the fix, the PATCH response hardcoded `firstPublishPending: false`.
    // Saving contact data with the switch off, on a never-published local, is
    // the one combination that MUST come back true; a fixed false passes every
    // other case in this describe block by accident.
    const { tx } = makeTx({
      existingRow: baseRow(),
      everPublishedBefore: false,
      anyEventExists: false,
    });

    const result = await runSave(tx, { publicarEnTienda: false });

    expect(result.local.firstPublishPending).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Part 3 — readPublishedTiendaIds via listTiendaOnlineLocales (GET, §5.1).   */
/* -------------------------------------------------------------------------- */

describe("listTiendaOnlineLocales — readPublishedTiendaIds, the batched GET-side signal (contract §5.1, §8.3)", () => {
  it("should query outboxEvento.groupBy with negocioId, entidad STORE, entidadId: { in: tiendaIds } AND the payload filter", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([baseRow({ id: "tienda-1" }), baseRow({ id: "tienda-2" })]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    await listTiendaOnlineLocales(NEGOCIO_ID);

    expect(outboxGroupByMock).toHaveBeenCalledTimes(1);
    const call = outboxGroupByMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.by).toEqual(["entidadId"]);
    expect(call.where).toEqual({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: { in: ["tienda-1", "tienda-2"] },
      payload: { path: ["publishToStore"], equals: true },
    });
  });

  it("should NOT pass a `take` to the groupBy call — a row cap could drop an old publish and reopen the brand question", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([baseRow({ id: "tienda-1" })]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    await listTiendaOnlineLocales(NEGOCIO_ID);

    const call = outboxGroupByMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("take");
  });

  it("should mark a local absent from the groupBy result as firstPublishPending: true", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([baseRow({ id: "tienda-1" })]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    const [local] = await listTiendaOnlineLocales(NEGOCIO_ID);

    expect(local.firstPublishPending).toBe(true);
  });

  it("should mark a local present in the groupBy result as firstPublishPending: false", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([
      baseRow({ id: "tienda-1" }),
      baseRow({ id: "tienda-2" }),
    ]);
    outboxGroupByMock.mockResolvedValueOnce([{ entidadId: "tienda-2" }]);

    const locales = await listTiendaOnlineLocales(NEGOCIO_ID);

    const uno = locales.find((l) => l.id === "tienda-1");
    const dos = locales.find((l) => l.id === "tienda-2");
    expect(uno?.firstPublishPending).toBe(true);
    expect(dos?.firstPublishPending).toBe(false);
  });

  it("should not call groupBy at all when the business has no locals (tiendaIds: [])", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([]);

    const locales = await listTiendaOnlineLocales(NEGOCIO_ID);

    expect(locales).toEqual([]);
    expect(outboxGroupByMock).not.toHaveBeenCalled();
  });

  it("should keep negocioId in the groupBy where even alongside the payload filter — tenancy is never relaxed by it", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([baseRow({ id: "tienda-1" })]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    await listTiendaOnlineLocales(OTHER_NEGOCIO_ID);

    const call = outboxGroupByMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.where).toMatchObject({ negocioId: OTHER_NEGOCIO_ID });
  });
});

describe("the payload filter ADDS to tenancy, it never replaces it (contract §8.2: 'las tres consultas llevan negocioId ... el filtro por payload se suma, nunca lo sustituye')", () => {
  it("hasEverPublishedToStore: negocioId, entidad and entidadId are ALL still present alongside the payload filter", async () => {
    const { tx, wheres } = makeOutboxFindFirstStub(false);

    await hasEverPublishedToStore(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(wheres[0]).toMatchObject({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: TIENDA_ID,
    });
    expect(wheres[0]).toHaveProperty("payload");
  });

  it("hasAnyStoreEvent: negocioId, entidad and entidadId are present, with NO payload filter added on top", async () => {
    const { tx, wheres } = makeOutboxFindFirstStub(false);

    await hasAnyStoreEvent(tx, { negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID });

    expect(wheres[0]).toMatchObject({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: TIENDA_ID,
    });
    expect(wheres[0]).not.toHaveProperty("payload");
  });

  it("readPublishedTiendaIds (via listTiendaOnlineLocales): negocioId, entidad and entidadId are ALL still present alongside the payload filter", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([baseRow({ id: "tienda-1" })]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    await listTiendaOnlineLocales(NEGOCIO_ID);

    const call = outboxGroupByMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.where).toMatchObject({
      negocioId: NEGOCIO_ID,
      entidad: "STORE",
      entidadId: { in: ["tienda-1"] },
    });
    expect(call.where).toHaveProperty("payload");
  });
});
