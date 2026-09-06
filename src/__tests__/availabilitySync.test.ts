import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyQabAvailabilityPhaseReport } from "@/lib/qab/qabAvailabilityPlan";
import { QAB_AVAILABILITY_BATCH_SIZE } from "@/constants/qab";
import type { IQabDivergentRow } from "@/schemas/qabAvailability";
import type { IQabAvailabilityPostOutcome } from "@/lib/qab/qabAvailabilityClient";

/**
 * F-007 — `src/lib/qab/availabilitySync.ts`, the phase orchestrator (contract's
 * "Secuencia vinculante"). `deps.post` is injected per the contract, so this file never
 * touches `global.fetch`; the two database boundaries it calls directly
 * (`qabAvailabilityQuery.ts`) and `loadQabTokens` (`outboxDrain.ts`) are mocked as
 * external dependencies, the same way Prisma itself is mocked elsewhere in this suite.
 * `qabAvailabilityPlan.ts`'s pure functions are NOT mocked: this is where their real
 * grouping/chunking/write-plan behaviour is exercised end to end.
 *
 * The test worth the most attention is credential isolation (criterion 8, second half):
 * two businesses get DISTINCT, distinguishable tokens (E-008 — with the same token in
 * both, a broken pairing would pass this test just as well) and the assertion is that
 * `deps.post` receives negocio A's own token for negocio A's batch, never B's.
 */

const readDivergentAvailabilityRowsMock = vi.fn();
const readProductoTiendaIdsWithPendingProductEventMock = vi.fn();
const writeDispPublicadaMock = vi.fn();
const loadQabTokensMock = vi.fn();

vi.mock("@/lib/qab/qabAvailabilityQuery", () => ({
  readDivergentAvailabilityRows: readDivergentAvailabilityRowsMock,
  readProductoTiendaIdsWithPendingProductEvent: readProductoTiendaIdsWithPendingProductEventMock,
  writeDispPublicada: writeDispPublicadaMock,
}));

vi.mock("@/lib/qab/outboxDrain", () => ({
  loadQabTokens: loadQabTokensMock,
}));

const { syncQabAvailability } = await import("@/lib/qab/availabilitySync");

function row(overrides: Partial<IQabDivergentRow> = {}): IQabDivergentRow {
  return {
    productoTiendaId: "pt-1",
    tiendaId: "tienda-1",
    negocioId: "negocio-1",
    availability: "OUT_OF_STOCK",
    ...overrides,
  };
}

function okOutcome(confirmed: Array<[string, string]>): IQabAvailabilityPostOutcome {
  return { kind: "ok", response: { applied: confirmed.length, confirmed } };
}

/** Confirms every id of a batch, matching each item's storeId. Convenience for the happy path. */
function confirmAll(batch: { items: Array<{ storeProductId: string; storeId: string }> }) {
  return okOutcome(batch.items.map((i) => [i.storeProductId, i.storeId] as [string, string]));
}

beforeEach(() => {
  readDivergentAvailabilityRowsMock.mockReset().mockResolvedValue([]);
  readProductoTiendaIdsWithPendingProductEventMock.mockReset().mockResolvedValue(new Set());
  writeDispPublicadaMock.mockReset().mockImplementation(async (args) => {
    return args.plan.groups.reduce((sum: number, g: { productoTiendaIds: string[] }) => sum + g.productoTiendaIds.length, 0);
  });
  loadQabTokensMock.mockReset().mockResolvedValue(new Map());
});

describe("syncQabAvailability — negocioIds vacío y sin filas", () => {
  it("should return emptyQabAvailabilityPhaseReport WITHOUT touching the database when negocioIds is empty", async () => {
    const post = vi.fn();

    const report = await syncQabAvailability({ negocioIds: [], post });

    expect(report).toEqual(emptyQabAvailabilityPhaseReport());
    expect(readDivergentAvailabilityRowsMock).not.toHaveBeenCalled();
    expect(loadQabTokensMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("should return emptyQabAvailabilityPhaseReport when the divergence read returns no rows", async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([]);
    const post = vi.fn();

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    expect(report).toEqual(emptyQabAvailabilityPhaseReport());
    expect(loadQabTokensMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});

describe("syncQabAvailability — capped", () => {
  it("should report capped: true when the read returned exactly `limit` rows", async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([row(), row({ productoTiendaId: "pt-2" })]);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post, limit: 2 });

    expect(report.capped).toBe(true);
  });

  it("should report capped: false when fewer rows than `limit` were read", async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([row()]);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post, limit: 100 });

    expect(report.capped).toBe(false);
  });
});

describe("syncQabAvailability — discarding rows with a pending PRODUCT event (ADR 0049)", () => {
  it("should exclude a row whose ProductoTienda id is still pending in the outbox from the sent batch and from `items`", async () => {
    const rowPending = row({ productoTiendaId: "pt-pending" });
    const rowReady = row({ productoTiendaId: "pt-ready" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([rowPending, rowReady]);
    readProductoTiendaIdsWithPendingProductEventMock.mockResolvedValue(new Set(["pt-pending"]));
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    expect(post).toHaveBeenCalledTimes(1);
    const sentBatch = post.mock.calls[0][0].batch;
    expect(sentBatch.items.map((i: { storeProductId: string }) => i.storeProductId)).toEqual([
      "pt-ready",
    ]);
    expect(report.byBusiness[0].items).toBe(1);
  });
});

describe("syncQabAvailability — multi-tenant isolation, DATA (criterion 8, first half)", () => {
  it("should never mix negocio A's items into negocio B's batch, or vice versa", async () => {
    const rowA = row({ negocioId: "negocio-A", productoTiendaId: "pt-a", tiendaId: "tienda-a" });
    const rowB = row({ negocioId: "negocio-B", productoTiendaId: "pt-b", tiendaId: "tienda-b" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([rowA, rowB]);
    loadQabTokensMock.mockResolvedValue(
      new Map([
        ["negocio-A", "token-A"],
        ["negocio-B", "token-B"],
      ])
    );
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    await syncQabAvailability({ negocioIds: ["negocio-A", "negocio-B"], post });

    expect(post).toHaveBeenCalledTimes(2);
    const batchByBusiness = new Map(
      post.mock.calls.map((call) => [call[0].batch.businessId, call[0].batch])
    );
    expect(batchByBusiness.get("negocio-A").items).toHaveLength(1);
    expect(batchByBusiness.get("negocio-A").items[0].storeProductId).toBe("pt-a");
    expect(batchByBusiness.get("negocio-B").items).toHaveLength(1);
    expect(batchByBusiness.get("negocio-B").items[0].storeProductId).toBe("pt-b");
  });
});

describe("syncQabAvailability — multi-tenant isolation, CREDENTIAL (criterion 8, second half)", () => {
  it("should send negocio A's request with EXACTLY negocio A's token, never negocio B's — and the two tokens must be distinguishable", async () => {
    const rowA = row({ negocioId: "negocio-A", productoTiendaId: "pt-a", tiendaId: "tienda-a" });
    const rowB = row({ negocioId: "negocio-B", productoTiendaId: "pt-b", tiendaId: "tienda-b" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([rowA, rowB]);
    // DISTINCT tokens on purpose (E-008): with the same token for both businesses, a
    // broken pairing (e.g. always using the FIRST token loaded) would pass this test
    // just as well as a correct implementation.
    const tokenOfA = "qab-token-belonging-to-negocio-A";
    const tokenOfB = "qab-token-belonging-to-negocio-B";
    expect(tokenOfA).not.toBe(tokenOfB);
    loadQabTokensMock.mockResolvedValue(
      new Map([
        ["negocio-A", tokenOfA],
        ["negocio-B", tokenOfB],
      ])
    );
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    await syncQabAvailability({ negocioIds: ["negocio-A", "negocio-B"], post });

    const tokenByBusiness = new Map(
      post.mock.calls.map((call) => [call[0].negocioId, call[0].token])
    );
    expect(tokenByBusiness.get("negocio-A")).toBe(tokenOfA);
    expect(tokenByBusiness.get("negocio-B")).toBe(tokenOfB);
    expect(tokenByBusiness.get("negocio-A")).not.toBe(tokenOfB);
    expect(tokenByBusiness.get("negocio-B")).not.toBe(tokenOfA);
  });
});

describe("syncQabAvailability — a business without a token (criterion 9's underlying mechanism)", () => {
  it('should mark a tokenless business as "skipped_no_token", make NO HTTP call and write NOTHING, while leaving its rows divergent', async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([row({ negocioId: "negocio-1" })]);
    loadQabTokensMock.mockResolvedValue(new Map()); // no entry for negocio-1
    const post = vi.fn();

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    expect(post).not.toHaveBeenCalled();
    expect(writeDispPublicadaMock).not.toHaveBeenCalled();
    expect(report.byBusiness).toContainEqual(
      expect.objectContaining({
        negocioId: "negocio-1",
        outcome: "skipped_no_token",
        requests: 0,
        confirmed: 0,
        written: 0,
      })
    );
  });
});

describe("syncQabAvailability — deadline already passed (Secuencia vinculante, step 7)", () => {
  it('should mark every business as "skipped_deadline" and make NO HTTP call when deadlineAt is already in the past', async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([row({ negocioId: "negocio-1" })]);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn();

    const report = await syncQabAvailability({
      negocioIds: ["negocio-1"],
      post,
      deadlineAt: Date.now() - 1_000,
    });

    expect(post).not.toHaveBeenCalled();
    expect(writeDispPublicadaMock).not.toHaveBeenCalled();
    expect(report.byBusiness).toContainEqual(
      expect.objectContaining({ negocioId: "negocio-1", outcome: "skipped_deadline", requests: 0 })
    );
  });
});

describe("syncQabAvailability — confirmed writes and the report's counters (criteria 1, 4, 5, 7)", () => {
  it("should write dispPublicada only for confirmed items, and report items/requests/confirmed/written accordingly", async () => {
    const confirmedRow = row({ productoTiendaId: "pt-confirmed", availability: "OUT_OF_STOCK" });
    const unconfirmedRow = row({ productoTiendaId: "pt-unconfirmed", availability: "LOW_STOCK" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([confirmedRow, unconfirmedRow]);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockResolvedValue(okOutcome([["pt-confirmed", "tienda-1"]]));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    expect(writeDispPublicadaMock).toHaveBeenCalledTimes(1);
    const [writeArgs] = writeDispPublicadaMock.mock.calls[0];
    expect(writeArgs.plan.groups.flatMap((g: { productoTiendaIds: string[] }) => g.productoTiendaIds)).toEqual([
      "pt-confirmed",
    ]);
    expect(report.rows).toBe(2);
    expect(report.requests).toBe(1);
    expect(report.confirmed).toBe(1);
    expect(report.written).toBe(1);
    expect(report.byBusiness[0]).toMatchObject({
      negocioId: "negocio-1",
      items: 2,
      requests: 1,
      confirmed: 1,
      written: 1,
      outcome: "ok",
    });
  });

  it("should count 50 rows reset to divergent as items=50, confirmed=50 and written=50 in one pass", async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      row({ productoTiendaId: `pt-${i}`, tiendaId: `tienda-${i}`, availability: i % 2 === 0 ? "OUT_OF_STOCK" : "AVAILABLE" })
    );
    readDivergentAvailabilityRowsMock.mockResolvedValue(rows);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    expect(report.rows).toBe(50);
    expect(report.confirmed).toBe(50);
    expect(report.written).toBe(50);
    expect(report.byBusiness[0]).toMatchObject({ items: 50, confirmed: 50, written: 50 });
  });
});

describe("syncQabAvailability — LOW_STOCK travels like the other two values (criterion 7)", () => {
  it("should send and confirm a LOW_STOCK row exactly like OUT_OF_STOCK/AVAILABLE", async () => {
    const lowStockRow = row({ productoTiendaId: "pt-low", availability: "LOW_STOCK" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([lowStockRow]);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    await syncQabAvailability({ negocioIds: ["negocio-1"], post });

    const sentBatch = post.mock.calls[0][0].batch;
    expect(sentBatch.items[0].availability).toBe("LOW_STOCK");
    const [writeArgs] = writeDispPublicadaMock.mock.calls[0];
    expect(writeArgs.plan.groups).toEqual([
      { availability: "LOW_STOCK", productoTiendaIds: ["pt-low"] },
    ]);
  });
});

describe("syncQabAvailability — pagination beyond QAB_AVAILABILITY_BATCH_SIZE (criterion 10)", () => {
  it("should issue more than one request for a business with more than QAB_AVAILABILITY_BATCH_SIZE divergent rows, none over the cap", async () => {
    const total = QAB_AVAILABILITY_BATCH_SIZE + 10;
    const rows = Array.from({ length: total }, (_, i) =>
      row({ negocioId: "negocio-1", productoTiendaId: `pt-${i}`, tiendaId: `tienda-${i}` })
    );
    readDivergentAvailabilityRowsMock.mockResolvedValue(rows);
    loadQabTokensMock.mockResolvedValue(new Map([["negocio-1", "token-1"]]));
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({ negocioIds: ["negocio-1"], post, limit: total });

    expect(post).toHaveBeenCalledTimes(2);
    for (const call of post.mock.calls) {
      expect(call[0].batch.items.length).toBeLessThanOrEqual(QAB_AVAILABILITY_BATCH_SIZE);
    }
    const totalItemsSent = post.mock.calls.reduce((sum, call) => sum + call[0].batch.items.length, 0);
    expect(totalItemsSent).toBe(total);
    expect(report.requests).toBe(2);
  }, 20_000);
});

describe("syncQabAvailability — one business's failure never aborts the run of the others (criterion 11)", () => {
  it("should keep processing negocio B normally when negocio A's request fails, and never throw", async () => {
    const rowA = row({ negocioId: "negocio-A", productoTiendaId: "pt-a", tiendaId: "tienda-a" });
    const rowB = row({ negocioId: "negocio-B", productoTiendaId: "pt-b", tiendaId: "tienda-b" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([rowA, rowB]);
    loadQabTokensMock.mockResolvedValue(
      new Map([
        ["negocio-A", "token-A"],
        ["negocio-B", "token-B"],
      ])
    );
    const post = vi.fn().mockImplementation(async ({ negocioId, batch }) => {
      if (negocioId === "negocio-A") return { kind: "error", error: "TRANSPORT:ECONNREFUSED" };
      return confirmAll(batch);
    });

    let report;
    await expect(
      (async () => {
        report = await syncQabAvailability({ negocioIds: ["negocio-A", "negocio-B"], post });
      })()
    ).resolves.not.toThrow();

    const businessA = report!.byBusiness.find((b) => b.negocioId === "negocio-A");
    const businessB = report!.byBusiness.find((b) => b.negocioId === "negocio-B");
    expect(businessA?.outcome).toBe("error");
    expect(businessA?.written).toBe(0);
    expect(businessB?.outcome).toBe("ok");
    expect(businessB?.written).toBe(1);
  });

  it("should stop the remaining pages of a business whose page failed, without affecting a following business", async () => {
    const total = QAB_AVAILABILITY_BATCH_SIZE + 5; // two pages for negocio-A
    const rowsA = Array.from({ length: total }, (_, i) =>
      row({ negocioId: "negocio-A", productoTiendaId: `a-${i}`, tiendaId: `tienda-a-${i}` })
    );
    const rowB = row({ negocioId: "negocio-B", productoTiendaId: "pt-b", tiendaId: "tienda-b" });
    readDivergentAvailabilityRowsMock.mockResolvedValue([...rowsA, rowB]);
    loadQabTokensMock.mockResolvedValue(
      new Map([
        ["negocio-A", "token-A"],
        ["negocio-B", "token-B"],
      ])
    );
    const post = vi.fn().mockImplementation(async ({ negocioId, batch }) => {
      if (negocioId === "negocio-A") return { kind: "error", error: "TRANSPORT:boom" };
      return confirmAll(batch);
    });

    const report = await syncQabAvailability({
      negocioIds: ["negocio-A", "negocio-B"],
      post,
      limit: total + 1,
    });

    const postCallsForA = post.mock.calls.filter((call) => call[0].negocioId === "negocio-A");
    expect(postCallsForA).toHaveLength(1); // the second page of negocio-A was never attempted
    const businessB = report.byBusiness.find((b) => b.negocioId === "negocio-B");
    expect(businessB?.outcome).toBe("ok");
    expect(businessB?.written).toBe(1);
  }, 20_000);
});

describe("syncQabAvailability — a business with no divergent rows is absent from byBusiness", () => {
  it("should not emit an entry in byBusiness, nor count it in `businesses`, for an eligible business with nothing divergent", async () => {
    readDivergentAvailabilityRowsMock.mockResolvedValue([row({ negocioId: "negocio-with-rows" })]);
    loadQabTokensMock.mockResolvedValue(
      new Map([
        ["negocio-with-rows", "token-1"],
        ["negocio-without-rows", "token-2"],
      ])
    );
    const post = vi.fn().mockImplementation(async ({ batch }) => confirmAll(batch));

    const report = await syncQabAvailability({
      negocioIds: ["negocio-with-rows", "negocio-without-rows"],
      post,
    });

    expect(report.businesses).toBe(1);
    expect(report.byBusiness.map((b) => b.negocioId)).toEqual(["negocio-with-rows"]);
  });
});
