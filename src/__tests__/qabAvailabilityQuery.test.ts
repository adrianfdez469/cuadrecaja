import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QAB_PRODUCT_ENTITY,
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_AVAILABILITY_MAX_ROWS_PER_RUN,
} from "@/constants/qab";

/**
 * F-007 — `src/lib/qab/qabAvailabilityQuery.ts`, the impure database boundary of the
 * feature. `qabPrisma` is mocked as an external dependency, the same technique
 * `qabStoreSyncState.test.ts` uses for `@/lib/prisma`.
 *
 * Two things this file protects that the contract calls out explicitly:
 *
 *  - `negocioIds: []` / `productoTiendaIds: []` short-circuit WITHOUT ever touching the
 *    database (`$queryRaw` / `findMany` must not be called at all) — not just "return
 *    the same empty result a real query would."
 *  - `negocioIds` and `limit` travel as bound PARAMETERS of the `$queryRaw` tagged
 *    template, never concatenated into the SQL text. The check reads the raw strings
 *    array Prisma's tag function receives and confirms a real negocioId value never
 *    appears inside it — the same distinction ADR 0048 draws between `Prisma.raw` (for
 *    the CASE constant only) and a bound value.
 */

const queryRawMock = vi.fn();
const outboxFindManyMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/qab/qabPrisma", () => ({
  qabPrisma: {
    $queryRaw: queryRawMock,
    outboxEvento: { findMany: outboxFindManyMock },
    productoTienda: { updateMany: updateManyMock },
  },
}));

const {
  readDivergentAvailabilityRows,
  readProductoTiendaIdsWithPendingProductEvent,
  writeDispPublicada,
} = await import("@/lib/qab/qabAvailabilityQuery");

beforeEach(() => {
  queryRawMock.mockReset().mockResolvedValue([]);
  outboxFindManyMock.mockReset().mockResolvedValue([]);
  updateManyMock.mockReset().mockResolvedValue({ count: 0 });
});

function divergentDbRow(overrides: Record<string, unknown> = {}) {
  return {
    productoTiendaId: "pt-1",
    tiendaId: "tienda-1",
    negocioId: "negocio-1",
    availability: "OUT_OF_STOCK",
    ...overrides,
  };
}

describe("readDivergentAvailabilityRows", () => {
  it("should return [] WITHOUT calling $queryRaw when negocioIds is empty", async () => {
    const rows = await readDivergentAvailabilityRows({ negocioIds: [] });

    expect(rows).toEqual([]);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("should call $queryRaw exactly once for a non-empty negocioIds", async () => {
    queryRawMock.mockResolvedValue([divergentDbRow()]);

    await readDivergentAvailabilityRows({ negocioIds: ["negocio-1"] });

    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("should return the rows the query resolves with, matching qabDivergentRowSchema's shape", async () => {
    const row = divergentDbRow({ productoTiendaId: "pt-42", availability: "LOW_STOCK" });
    queryRawMock.mockResolvedValue([row]);

    const rows = await readDivergentAvailabilityRows({ negocioIds: ["negocio-1"] });

    expect(rows).toEqual([row]);
  });

  it("should throw when a returned row does not satisfy qabDivergentRowSchema — malformed SQL output must never pass silently", async () => {
    queryRawMock.mockResolvedValue([{ productoTiendaId: "pt-1" /* missing every other field */ }]);

    await expect(readDivergentAvailabilityRows({ negocioIds: ["negocio-1"] })).rejects.toThrow();
  });

  it("should pass negocioIds as a bound VALUE of the tagged template, never concatenated into the SQL text", async () => {
    const distinctiveId = "negocio-id-that-must-never-appear-in-raw-sql-text";
    queryRawMock.mockResolvedValue([]);

    await readDivergentAvailabilityRows({ negocioIds: [distinctiveId] });

    const [strings, ...values] = queryRawMock.mock.calls[0];
    const rawText = (strings as readonly string[]).join("");
    expect(rawText).not.toContain(distinctiveId);
    expect(values).toContainEqual([distinctiveId]);
  });

  it("should default limit to QAB_AVAILABILITY_MAX_ROWS_PER_RUN when omitted", async () => {
    queryRawMock.mockResolvedValue([]);

    await readDivergentAvailabilityRows({ negocioIds: ["negocio-1"] });

    const [, ...values] = queryRawMock.mock.calls[0];
    expect(values).toContain(QAB_AVAILABILITY_MAX_ROWS_PER_RUN);
  });

  it("should pass an explicit limit through instead of the default", async () => {
    queryRawMock.mockResolvedValue([]);

    await readDivergentAvailabilityRows({ negocioIds: ["negocio-1"], limit: 25 });

    const [, ...values] = queryRawMock.mock.calls[0];
    expect(values).toContain(25);
    expect(values).not.toContain(QAB_AVAILABILITY_MAX_ROWS_PER_RUN);
  });

  it("should query ProductoTienda joined to Tienda and Producto, filtering deletedAt and publicarEnTienda", async () => {
    queryRawMock.mockResolvedValue([]);

    await readDivergentAvailabilityRows({ negocioIds: ["negocio-1"] });

    const [strings] = queryRawMock.mock.calls[0];
    const rawText = (strings as readonly string[]).join("");
    expect(rawText).toContain(`"ProductoTienda"`);
    expect(rawText).toContain(`"Tienda"`);
    expect(rawText).toContain(`"Producto"`);
    expect(rawText).toContain(`"deletedAt"`);
    expect(rawText).toContain(`"publicarEnTienda"`);
    expect(rawText).toContain("IS DISTINCT FROM");
    expect(rawText).toContain(`"dispPublicada"`);
  });
});

describe("readProductoTiendaIdsWithPendingProductEvent", () => {
  it("should return an empty Set WITHOUT calling findMany when productoTiendaIds is empty", async () => {
    const result = await readProductoTiendaIdsWithPendingProductEvent({
      negocioIds: ["negocio-1"],
      productoTiendaIds: [],
    });

    expect(result).toEqual(new Set());
    expect(outboxFindManyMock).not.toHaveBeenCalled();
  });

  it("should return a Set of the entidadId of every pending, retryable PRODUCT event found", async () => {
    outboxFindManyMock.mockResolvedValue([{ entidadId: "pt-1" }, { entidadId: "pt-2" }]);

    const result = await readProductoTiendaIdsWithPendingProductEvent({
      negocioIds: ["negocio-1"],
      productoTiendaIds: ["pt-1", "pt-2", "pt-3"],
    });

    expect(result).toEqual(new Set(["pt-1", "pt-2"]));
  });

  it("should call findMany with the exact where clause of the contract, including the intentos cap (ADR 0049)", async () => {
    outboxFindManyMock.mockResolvedValue([]);

    await readProductoTiendaIdsWithPendingProductEvent({
      negocioIds: ["negocio-1", "negocio-2"],
      productoTiendaIds: ["pt-1", "pt-2"],
    });

    expect(outboxFindManyMock).toHaveBeenCalledWith({
      where: {
        negocioId: { in: ["negocio-1", "negocio-2"] },
        entidad: QAB_PRODUCT_ENTITY,
        entidadId: { in: ["pt-1", "pt-2"] },
        procesadoAt: null,
        intentos: { lt: QAB_OUTBOX_MAX_ATTEMPTS },
      },
      select: { entidadId: true },
    });
  });

  it("should be called exactly once, never once per row", async () => {
    outboxFindManyMock.mockResolvedValue([]);

    await readProductoTiendaIdsWithPendingProductEvent({
      negocioIds: ["negocio-1"],
      productoTiendaIds: ["pt-1", "pt-2", "pt-3"],
    });

    expect(outboxFindManyMock).toHaveBeenCalledTimes(1);
  });
});

describe("writeDispPublicada", () => {
  it("should write NOTHING and return 0 when plan.groups is empty", async () => {
    const written = await writeDispPublicada({ negocioId: "negocio-1", plan: { groups: [], confirmed: 0 } });

    expect(written).toBe(0);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("should issue exactly ONE updateMany per group", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await writeDispPublicada({
      negocioId: "negocio-1",
      plan: {
        groups: [
          { availability: "OUT_OF_STOCK", productoTiendaIds: ["pt-1"] },
          { availability: "AVAILABLE", productoTiendaIds: ["pt-2", "pt-3"] },
        ],
        confirmed: 3,
      },
    });

    expect(updateManyMock).toHaveBeenCalledTimes(2);
  });

  it("should return the SUM of every updateMany's count", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 2 });

    const written = await writeDispPublicada({
      negocioId: "negocio-1",
      plan: {
        groups: [
          { availability: "OUT_OF_STOCK", productoTiendaIds: ["pt-1", "pt-2", "pt-3"] },
          { availability: "AVAILABLE", productoTiendaIds: ["pt-4", "pt-5"] },
        ],
        confirmed: 5,
      },
    });

    expect(written).toBe(5);
  });

  it("should scope each updateMany's where to { id: { in: ... }, tienda: { negocioId } } — the tenant filter is not omitted", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await writeDispPublicada({
      negocioId: "negocio-1",
      plan: { groups: [{ availability: "LOW_STOCK", productoTiendaIds: ["pt-1"] }], confirmed: 1 },
    });

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["pt-1"] }, tienda: { negocioId: "negocio-1" } },
      data: { dispPublicada: "LOW_STOCK" },
    });
  });

  it("should never write a group's ids under another business's negocioId", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await writeDispPublicada({
      negocioId: "negocio-A",
      plan: { groups: [{ availability: "AVAILABLE", productoTiendaIds: ["pt-1"] }], confirmed: 1 },
    });

    const [call] = updateManyMock.mock.calls;
    expect(call[0].where.tienda.negocioId).toBe("negocio-A");
    expect(call[0].where.tienda.negocioId).not.toBe("negocio-B");
  });

  it("should NOT filter by NOT dispPublicada: the count reflects rows found, not rows changed", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await writeDispPublicada({
      negocioId: "negocio-1",
      plan: { groups: [{ availability: "AVAILABLE", productoTiendaIds: ["pt-1"] }], confirmed: 1 },
    });

    const [call] = updateManyMock.mock.calls;
    expect(call[0].where).not.toHaveProperty("dispPublicada");
    expect(call[0].data).toEqual({ dispPublicada: "AVAILABLE" });
  });
});
