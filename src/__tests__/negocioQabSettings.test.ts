import { describe, it, expect, vi } from "vitest";
import { NEGOCIO_QAB_SELECT, toNegocioQabSettings, loadNegocioIdsWithQabToken } from "@/lib/negocio/qabSettings";
import { negocioQabSettingsItemSchema } from "@/schemas/qabNegocio";
import type { INegocioQabRow } from "@/lib/negocio/qabSettings";
import type { PrismaClientLike } from "@/lib/prisma";

/**
 * F-003 — `src/lib/negocio/qabSettings.ts` (ADR 0024). The invariant this module exists to
 * guarantee: `qabTokenConfigurado` is derived with a `where`, and no function here ever
 * receives the token's value. `toNegocioQabSettings` takes a boolean, not the secret; that is
 * what makes criteria 5, 14 and 15 hold by construction rather than by someone remembering to
 * redact a field before a response goes out.
 */

const ROW: INegocioQabRow = {
  id: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
  tiendaOnlineHabilitada: true,
  qabTokenActualizadoAt: new Date("2026-09-03T10:00:00.000Z"),
};

describe("NEGOCIO_QAB_SELECT", () => {
  it("should never name qabToken", () => {
    expect(NEGOCIO_QAB_SELECT).not.toHaveProperty("qabToken");
  });

  it("should select id, tiendaOnlineHabilitada and qabTokenActualizadoAt", () => {
    expect(NEGOCIO_QAB_SELECT).toEqual({
      id: true,
      tiendaOnlineHabilitada: true,
      qabTokenActualizadoAt: true,
    });
  });
});

describe("toNegocioQabSettings", () => {
  it("should map id to negocioId and pass tiendaOnlineHabilitada / qabTokenActualizadoAt through", () => {
    const result = toNegocioQabSettings(ROW, true);

    expect(result).toEqual({
      negocioId: ROW.id,
      tiendaOnlineHabilitada: true,
      qabTokenConfigurado: true,
      qabTokenActualizadoAt: ROW.qabTokenActualizadoAt,
    });
  });

  it("should take qabTokenConfigurado from its own second argument, not from the row", () => {
    // Same row, opposite boolean: the two calls MUST diverge, or the argument is being ignored.
    const withToken = toNegocioQabSettings(ROW, true);
    const withoutToken = toNegocioQabSettings(ROW, false);

    expect(withToken.qabTokenConfigurado).toBe(true);
    expect(withoutToken.qabTokenConfigurado).toBe(false);
  });

  it("should produce a value that validates against negocioQabSettingsItemSchema", () => {
    const result = toNegocioQabSettings(ROW, true);
    expect(() => negocioQabSettingsItemSchema.parse(result)).not.toThrow();
  });

  it("should never let a stray qabToken key on the row object reach the output", () => {
    // Defense in depth: even if a caller passed a wider row than INegocioQabRow allows
    // (e.g. from a mistaken select), the projection must not carry it through.
    const wideRow = { ...ROW, qabToken: "SUPER_SECRET_QAB_TOKEN" } as unknown as INegocioQabRow;

    const result = toNegocioQabSettings(wideRow, true);

    expect(result).not.toHaveProperty("qabToken");
    expect(JSON.stringify(result)).not.toContain("SUPER_SECRET_QAB_TOKEN");
  });

  it("should carry a null qabTokenActualizadoAt through unchanged", () => {
    const result = toNegocioQabSettings({ ...ROW, qabTokenActualizadoAt: null }, false);
    expect(result.qabTokenActualizadoAt).toBeNull();
  });
});

describe("loadNegocioIdsWithQabToken", () => {
  it("should return a Set of the ids Prisma reports as having a token", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadNegocioIdsWithQabToken(tx, ["a", "b", "c"]);

    expect(result).toBeInstanceOf(Set);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("should filter by qabToken: { not: null }", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    await loadNegocioIdsWithQabToken(tx, ["a"]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ qabToken: { not: null } }),
      })
    );
  });

  it("should never select the qabToken column itself, only ids", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    await loadNegocioIdsWithQabToken(tx, ["a"]);

    const call = findMany.mock.calls[0][0];
    expect(call.select).not.toHaveProperty("qabToken");
  });

  it("should treat an ABSENT negocioIds as 'every business', not 'none'", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadNegocioIdsWithQabToken(tx);

    expect(result).toEqual(new Set(["a", "b", "c"]));
    const call = findMany.mock.calls[0][0];
    expect(call.where.id).toBeUndefined();
  });

  it("should treat an EMPTY negocioIds array as 'filter by nothing' -> an empty Set, WITHOUT touching the database", async () => {
    // Revised per the arch-guardian after this suite's first pass flagged the opposite
    // reading (see .agents/errors — the original contract text conflated "absent" and
    // "empty"). `undefined` means "don't filter"; `[]` means "filter by this set, which is
    // empty" — the two are opposites and are not the same "todos" case. Collapsing an empty
    // filter into "everyone" would over-report exactly the thing this function exists to
    // answer precisely: "who has a credential". The early return is the point, so this test
    // checks BOTH halves: the empty Set AND that `findMany` is never called.
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    const result = await loadNegocioIdsWithQabToken(tx, []);

    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("should scope the query by the given ids when a non-empty array is passed", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }]);
    const tx = { negocio: { findMany } } as unknown as PrismaClientLike;

    await loadNegocioIdsWithQabToken(tx, ["a", "b"]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["a", "b"] } }),
      })
    );
  });
});
