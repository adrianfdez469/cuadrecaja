import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  QAB_SLUG_LEARN_MAX_PER_RUN,
  QAB_SLUG_LEARNED_REASON,
  QAB_SLUG_AVAILABILITY_PATH,
} from "@/constants/qab";
import { qabAppliedPublishWhere } from "@/lib/qab/qabStoreOutboxFilters";
import { qabSlugLearningTargetSchema } from "@/schemas/qabSync";
import type { IQabSlugOutcome } from "@/lib/qab/qabSlugClient";

/**
 * F-020 — `src/lib/qab/slugLearn.ts` (contract §6), the I/O half of the phase. It runs on
 * `qabPrisma` and reuses `loadQabTokens` from `outboxDrain.ts`, so both are mocked at their
 * module boundary — the same technique `qabToken.test.ts` and
 * `tiendaOnlineFirstPublishSignal.test.ts` use for `@/lib/prisma`.
 *
 * `readQabSlugLearningTargets` and `writeLearnedQabSlug` are I/O, per contract §14: verified
 * against an injected client here, never against a real database. `learnQabAssignedSlugs` is
 * exercised with `fetchSlug` injected, per the contract's own suggestion.
 */

const tiendaFindManyMock = vi.fn();
const tiendaUpdateManyMock = vi.fn();
const outboxGroupByMock = vi.fn();

vi.mock("@/lib/qab/qabPrisma", () => ({
  qabPrisma: {
    tienda: {
      findMany: (...args: unknown[]) => tiendaFindManyMock(...args),
      updateMany: (...args: unknown[]) => tiendaUpdateManyMock(...args),
    },
    outboxEvento: {
      groupBy: (...args: unknown[]) => outboxGroupByMock(...args),
    },
  },
}));

const loadQabTokensMock = vi.fn();
vi.mock("@/lib/qab/outboxDrain", () => ({
  loadQabTokens: (...args: unknown[]) => loadQabTokensMock(...args),
  // slugLearn.ts must not import drainQabOutbox: if it did, this stub would make that obvious.
}));

const { readQabSlugLearningTargets, writeLearnedQabSlug, learnQabAssignedSlugs } = await import(
  "@/lib/qab/slugLearn"
);

const BASE_URL = "https://qab.example";
const NEGOCIO_A = "negocio-a";
const NEGOCIO_B = "negocio-b";

beforeEach(() => {
  tiendaFindManyMock.mockReset();
  tiendaUpdateManyMock.mockReset();
  outboxGroupByMock.mockReset();
  loadQabTokensMock.mockReset();
});

interface SeedRow {
  id: string;
  negocioId: string;
  slug: string | null;
  nombre: string;
}

/** Seeds the Tienda candidates AND makes every one of them "eligible" (its own pair applied). */
function seedEligibleTargets(rows: SeedRow[]) {
  tiendaFindManyMock.mockResolvedValueOnce(
    rows.map((r) => ({
      id: r.id,
      negocioId: r.negocioId,
      slug: r.slug,
      nombre: r.nombre,
      slugQab: null,
      tipo: "TIENDA",
    }))
  );
  outboxGroupByMock.mockResolvedValueOnce(
    rows.map((r) => ({ negocioId: r.negocioId, entidadId: r.id }))
  );
}

/* -------------------------------------------------------------------------- */
/* readQabSlugLearningTargets — §6.1                                          */
/* -------------------------------------------------------------------------- */

describe("readQabSlugLearningTargets", () => {
  it("should return [] and never query the database when negocioIds is empty", async () => {
    const result = await readQabSlugLearningTargets([]);

    expect(result).toEqual([]);
    expect(tiendaFindManyMock).not.toHaveBeenCalled();
    expect(outboxGroupByMock).not.toHaveBeenCalled();
  });

  it("should query Tienda candidates with negocioId IN, slugQab: null, tipo TIENDA, ordered by id", async () => {
    seedEligibleTargets([]);
    outboxGroupByMock.mockResolvedValueOnce([]);

    await readQabSlugLearningTargets([NEGOCIO_A, NEGOCIO_B]);

    expect(tiendaFindManyMock).toHaveBeenCalledTimes(1);
    const args = tiendaFindManyMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args.where).toMatchObject({
      negocioId: { in: [NEGOCIO_A, NEGOCIO_B] },
      slugQab: null,
      tipo: "TIENDA",
    });
    expect(args.orderBy).toEqual({ id: "asc" });
  });

  it("should query the groupBy with qabAppliedPublishWhere over exactly the candidate ids", async () => {
    seedEligibleTargets([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: null, nombre: "Sucursal Norte" },
    ]);

    await readQabSlugLearningTargets([NEGOCIO_A]);

    expect(outboxGroupByMock).toHaveBeenCalledTimes(1);
    const args = outboxGroupByMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args.by).toEqual(["negocioId", "entidadId"]);
    expect(args.where).toEqual(qabAppliedPublishWhere({ negocioIds: [NEGOCIO_A], tiendaIds: ["t-1", "t-2"] }));
  });

  it("should keep a candidate only when its OWN (negocioId, entidadId) pair is in the groupBy result", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro", slugQab: null, tipo: "TIENDA" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: null, nombre: "Sucursal Norte", slugQab: null, tipo: "TIENDA" },
    ]);
    // Only t-1's pair comes back from the groupBy: t-2 has never been published.
    outboxGroupByMock.mockResolvedValueOnce([{ negocioId: NEGOCIO_A, entidadId: "t-1" }]);

    const targets = await readQabSlugLearningTargets([NEGOCIO_A]);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ negocioId: NEGOCIO_A, tiendaId: "t-1", slug: "la-rampa", nombre: "Sucursal Centro" });
    for (const target of targets) {
      expect(() => qabSlugLearningTargetSchema.parse(target)).not.toThrow();
    }
  });

  it("should match by the FULL pair, never by tiendaId alone — a same-id row of another business must not leak in", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([
      { id: "shared-id", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A", slugQab: null, tipo: "TIENDA" },
    ]);
    // The groupBy reports the SAME tiendaId, but for negocio-b — must not match negocio-a's row.
    outboxGroupByMock.mockResolvedValueOnce([{ negocioId: NEGOCIO_B, entidadId: "shared-id" }]);

    const targets = await readQabSlugLearningTargets([NEGOCIO_A]);

    expect(targets).toEqual([]);
  });

  it("should return [] when there are no Tienda candidates, without throwing", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([]);
    outboxGroupByMock.mockResolvedValue([]);

    await expect(readQabSlugLearningTargets([NEGOCIO_A])).resolves.toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* writeLearnedQabSlug — §6.2                                                  */
/* -------------------------------------------------------------------------- */

describe("writeLearnedQabSlug", () => {
  it("should updateMany with where {id, negocioId, slugQab: null} and data {slugQab}", async () => {
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    await writeLearnedQabSlug({ negocioId: NEGOCIO_A, tiendaId: "t-1", slugQab: "la-rampa-2" });

    expect(tiendaUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "t-1", negocioId: NEGOCIO_A, slugQab: null },
      data: { slugQab: "la-rampa-2" },
    });
  });

  it("should return true when exactly one row was updated", async () => {
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(
      writeLearnedQabSlug({ negocioId: NEGOCIO_A, tiendaId: "t-1", slugQab: "la-rampa-2" })
    ).resolves.toBe(true);
  });

  it("should return false, not throw, when count is 0 — concurrently learned or the local is gone", async () => {
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 0 });

    await expect(
      writeLearnedQabSlug({ negocioId: NEGOCIO_A, tiendaId: "t-1", slugQab: "la-rampa-2" })
    ).resolves.toBe(false);
  });

  it("should return false for any count other than exactly 1", async () => {
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 2 });

    await expect(
      writeLearnedQabSlug({ negocioId: NEGOCIO_A, tiendaId: "t-1", slugQab: "la-rampa-2" })
    ).resolves.toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* learnQabAssignedSlugs — §6.3, the phase                                    */
/* -------------------------------------------------------------------------- */

function okOutcome(overrides: Record<string, unknown> = {}): IQabSlugOutcome {
  return {
    kind: "ok",
    forecast: {
      candidate: "la-rampa",
      available: false,
      reason: QAB_SLUG_LEARNED_REASON,
      resolvedSlug: "la-rampa-2",
      url: "https://queandabuscando.com/la-rampa-2",
      storeKnown: true,
      ...overrides,
    },
  } as IQabSlugOutcome;
}

describe("learnQabAssignedSlugs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should return emptyQabSlugLearnPhaseReport-equivalent and touch nothing when negocioIds is empty", async () => {
    const fetchSlug = vi.fn();

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [], fetchSlug });

    expect(report).toEqual({ targets: 0, attempted: 0, learned: 0, results: [] });
    expect(tiendaFindManyMock).not.toHaveBeenCalled();
    expect(fetchSlug).not.toHaveBeenCalled();
  });

  it("should learn the slug end to end: read the target, fetch, write, and report it as learned", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome({ resolvedSlug: "la-rampa-2" }));

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.targets).toBe(1);
    expect(report.attempted).toBe(1);
    expect(report.learned).toBe(1);
    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "learned" }]);
    expect(tiendaUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "t-1", negocioId: NEGOCIO_A, slugQab: null },
      data: { slugQab: "la-rampa-2" },
    });
  });

  it("should call fetchSlug with the target's own query (storeId always present) and the resolved token", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(fetchSlug).toHaveBeenCalledWith({
      baseUrl: BASE_URL,
      token: "token-a",
      query: { slug: "la-rampa", storeId: "t-1" },
    });
  });

  it('should report upstream_error and write NOTHING when fetchSlug returns an error outcome', async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    const fetchSlug = vi.fn().mockResolvedValue({ kind: "error", code: "TRANSPORT" } as IQabSlugOutcome);

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "upstream_error" }]);
    expect(report.learned).toBe(0);
    expect(tiendaUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should report not_own and write NOTHING when reason is not "own"', async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome({ reason: "taken", resolvedSlug: "la-rampa-9" }));

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "not_own" }]);
    expect(tiendaUpdateManyMock).not.toHaveBeenCalled();
  });

  it("should report invalid_slug and write NOTHING when resolvedSlug fails qabSlugSchema", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome({ resolvedSlug: "La Rampa!!" }));

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "invalid_slug" }]);
    expect(tiendaUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should report not_written (not an exception) when the write lands with count !== 1', async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "not_written" }]);
    expect(report.learned).toBe(0);
    expect(report.attempted).toBe(1);
  });

  it("should skip a business with no token entirely — skipped_no_token for all its targets, and no HTTP call", async () => {
    seedEligibleTargets([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: "otra", nombre: "Sucursal Norte" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map()); // no token for negocio-a
    const fetchSlug = vi.fn();

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.results).toEqual([
      { negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "skipped_no_token" },
      { negocioId: NEGOCIO_A, tiendaId: "t-2", outcome: "skipped_no_token" },
    ]);
    expect(report.attempted).toBe(0);
    expect(fetchSlug).not.toHaveBeenCalled();
    expect(tiendaUpdateManyMock).not.toHaveBeenCalled();
  });

  it("should never let one business without a token block another business's targets from being attempted", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([
      { id: "a-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A", slugQab: null, tipo: "TIENDA" },
      { id: "b-1", negocioId: NEGOCIO_B, slug: "otra", nombre: "B", slugQab: null, tipo: "TIENDA" },
    ]);
    outboxGroupByMock.mockResolvedValueOnce([
      { negocioId: NEGOCIO_A, entidadId: "a-1" },
      { negocioId: NEGOCIO_B, entidadId: "b-1" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_B, "token-b"]])); // A has none
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome({ resolvedSlug: "otra" }));

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A, NEGOCIO_B], fetchSlug });

    expect(fetchSlug).toHaveBeenCalledTimes(1);
    expect(fetchSlug).toHaveBeenCalledWith(expect.objectContaining({ token: "token-b" }));
    const negocioAResult = report.results.find((r) => r.negocioId === NEGOCIO_A);
    expect(negocioAResult?.outcome).toBe("skipped_no_token");
  });

  it(`should respect QAB_SLUG_LEARN_MAX_PER_RUN: extra targets are skipped_deadline and NEVER attempted`, async () => {
    const rows: SeedRow[] = Array.from({ length: QAB_SLUG_LEARN_MAX_PER_RUN + 2 }, (_, i) => ({
      id: `t-${i}`,
      negocioId: NEGOCIO_A,
      slug: `slug-${i}`,
      nombre: `Sucursal ${i}`,
    }));
    seedEligibleTargets(rows);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValue({ count: 1 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.targets).toBe(QAB_SLUG_LEARN_MAX_PER_RUN + 2);
    expect(report.attempted).toBe(QAB_SLUG_LEARN_MAX_PER_RUN);
    expect(fetchSlug).toHaveBeenCalledTimes(QAB_SLUG_LEARN_MAX_PER_RUN);
    const skippedDeadline = report.results.filter((r) => r.outcome === "skipped_deadline");
    expect(skippedDeadline).toHaveLength(2);
    // Nothing is lost: every target still gets a result entry.
    expect(report.results).toHaveLength(QAB_SLUG_LEARN_MAX_PER_RUN + 2);
  });

  it("should let appliedStoreEvents RESCUE a target from the cap: the cap runs AFTER reordering (ADR 0036b)", async () => {
    // 21 candidates, MAX_PER_RUN of them attempted per run. Without the rescue,
    // targets t-0..t-19 (given order) would be the ones capped and t-20 (a
    // freshly applied publish) would be left for the next run. With the
    // reorder-before-cap interaction, t-20 moves to the front and IS attempted,
    // pushing the LAST of the original 20 (t-19) out instead.
    const rows: SeedRow[] = Array.from({ length: QAB_SLUG_LEARN_MAX_PER_RUN + 1 }, (_, i) => ({
      id: `t-${i}`,
      negocioId: NEGOCIO_A,
      slug: `slug-${i}`,
      nombre: `Sucursal ${i}`,
    }));
    seedEligibleTargets(rows);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValue({ count: 1 });
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    const report = await learnQabAssignedSlugs({
      baseUrl: BASE_URL,
      negocioIds: [NEGOCIO_A],
      fetchSlug,
      appliedStoreEvents: [{ negocioId: NEGOCIO_A, tiendaId: `t-${QAB_SLUG_LEARN_MAX_PER_RUN}` }],
    });

    const rescued = report.results.find((r) => r.tiendaId === `t-${QAB_SLUG_LEARN_MAX_PER_RUN}`);
    const bumped = report.results.find((r) => r.tiendaId === `t-${QAB_SLUG_LEARN_MAX_PER_RUN - 1}`);

    expect(rescued?.outcome).not.toBe("skipped_deadline");
    expect(bumped?.outcome).toBe("skipped_deadline");
    expect(report.attempted).toBe(QAB_SLUG_LEARN_MAX_PER_RUN);
    expect(fetchSlug).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ storeId: `t-${QAB_SLUG_LEARN_MAX_PER_RUN}` }) })
    );
  });

  it("should evaluate the deadline PER TARGET, not per group: a no-token business is skipped_no_token even when the deadline has already passed, never skipped_deadline", async () => {
    // Combines what two separate tests only covered apart: a business without
    // a token never reaches the `Date.now() >= deadlineAt` check at all — it is
    // filtered out one step earlier — so it must never consume any of the
    // deadline's budget or be reported as skipped_deadline.
    tiendaFindManyMock.mockResolvedValueOnce([
      { id: "a-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A", slugQab: null, tipo: "TIENDA" },
      { id: "b-1", negocioId: NEGOCIO_B, slug: "otra", nombre: "B", slugQab: null, tipo: "TIENDA" },
    ]);
    outboxGroupByMock.mockResolvedValueOnce([
      { negocioId: NEGOCIO_A, entidadId: "a-1" },
      { negocioId: NEGOCIO_B, entidadId: "b-1" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_B, "token-b"]])); // A has none
    const fetchSlug = vi.fn();

    const report = await learnQabAssignedSlugs({
      baseUrl: BASE_URL,
      negocioIds: [NEGOCIO_A, NEGOCIO_B],
      fetchSlug,
      deadlineAt: Date.now() - 1, // already passed, for whoever gets to check it
    });

    const negocioAResult = report.results.find((r) => r.negocioId === NEGOCIO_A);
    const negocioBResult = report.results.find((r) => r.negocioId === NEGOCIO_B);
    expect(negocioAResult?.outcome).toBe("skipped_no_token");
    expect(negocioBResult?.outcome).toBe("skipped_deadline");
    expect(fetchSlug).not.toHaveBeenCalled();
  });

  it("should mark every target skipped_deadline and call fetchSlug zero times when the deadline has already passed", async () => {
    seedEligibleTargets([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: "otra", nombre: "Sucursal Norte" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    const fetchSlug = vi.fn();

    const report = await learnQabAssignedSlugs({
      baseUrl: BASE_URL,
      negocioIds: [NEGOCIO_A],
      fetchSlug,
      deadlineAt: Date.now() - 1,
    });

    expect(report.attempted).toBe(0);
    expect(fetchSlug).not.toHaveBeenCalled();
    expect(tiendaUpdateManyMock).not.toHaveBeenCalled();
    expect(report.results.every((r) => r.outcome === "skipped_deadline")).toBe(true);
    expect(report.results).toHaveLength(2);
  });

  it("should never throw across a mix of failures: transport error, invalid slug, and a write that did not land", async () => {
    seedEligibleTargets([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: "otra", nombre: "B" },
      { id: "t-3", negocioId: NEGOCIO_A, slug: "tercera", nombre: "C" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const fetchSlug = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error", code: "TRANSPORT" } as IQabSlugOutcome)
      .mockResolvedValueOnce(okOutcome({ resolvedSlug: "not valid!!" }))
      .mockResolvedValueOnce(okOutcome({ resolvedSlug: "tercera" }));

    // If the phase threw, this `await` itself would fail the test — no try/catch needed.
    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });
    expect(report.results.map((r) => r.outcome).sort()).toEqual(
      ["invalid_slug", "not_written", "upstream_error"].sort()
    );
  });

  it("should count report.learned as exactly the number of 'learned' outcomes, no more", async () => {
    seedEligibleTargets([
      { id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A" },
      { id: "t-2", negocioId: NEGOCIO_A, slug: "otra", nombre: "B" },
    ]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const fetchSlug = vi
      .fn()
      .mockResolvedValueOnce(okOutcome({ resolvedSlug: "la-rampa-2" }))
      .mockResolvedValueOnce(okOutcome({ reason: "taken", resolvedSlug: "otra-9" }));

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(report.learned).toBe(1);
  });

  it("should log every result entry exactly once (console.info or console.error)", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "A" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug });

    expect(infoSpy.mock.calls.length + errorSpy.mock.calls.length).toBe(report.results.length);
  });

  it("should use the REAL fetchQabSlugAvailability by default — never an inline simpler fetch", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    tiendaUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidate: "la-rampa",
          available: false,
          reason: QAB_SLUG_LEARNED_REASON,
          resolvedSlug: "la-rampa-2",
          url: "https://queandabuscando.com/la-rampa-2",
          storeKnown: true,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const report = await learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(QAB_SLUG_AVAILABILITY_PATH);
    expect(url).toContain("storeId=t-1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-a");
    expect(report.results).toEqual([{ negocioId: NEGOCIO_A, tiendaId: "t-1", outcome: "learned" }]);
  });

  /**
   * A DATABASE failure is NOT one of the phase's closed outcomes: unlike a transport error, an
   * invalid slug or a write that did not land, a rejected query is never caught and mapped to a
   * `results[]` entry — it propagates, exactly like it does in `drainQabOutbox`. This is the
   * REAL behaviour (confirmed with the implementer against the actual code), not the "NEVER
   * THROWS" the function's JSDoc used to claim before it was corrected — the promise now matches
   * the code, and these two tests are what keep the two from drifting apart again (E-014).
   */
  it("should PROPAGATE a rejection from the eligible-set read (readQabSlugLearningTargets), not swallow it", async () => {
    const dbError = new Error("connection lost");
    tiendaFindManyMock.mockRejectedValueOnce(dbError);
    const fetchSlug = vi.fn();

    await expect(
      learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug })
    ).rejects.toBe(dbError);
    expect(fetchSlug).not.toHaveBeenCalled();
  });

  it("should PROPAGATE a rejection from the write (writeLearnedQabSlug), not swallow it or report not_written", async () => {
    seedEligibleTargets([{ id: "t-1", negocioId: NEGOCIO_A, slug: "la-rampa", nombre: "Sucursal Centro" }]);
    loadQabTokensMock.mockResolvedValueOnce(new Map([[NEGOCIO_A, "token-a"]]));
    const dbError = new Error("connection lost");
    tiendaUpdateManyMock.mockRejectedValueOnce(dbError);
    const fetchSlug = vi.fn().mockResolvedValue(okOutcome());

    await expect(
      learnQabAssignedSlugs({ baseUrl: BASE_URL, negocioIds: [NEGOCIO_A], fetchSlug })
    ).rejects.toBe(dbError);
  });
});
