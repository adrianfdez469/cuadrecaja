import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import {
  readExistingQabOrderIds,
  readOwnTiendaIds,
  insertQabOrder,
  insertQabOrders,
  readQabOrderCursor,
  advanceQabOrderCursorRow,
} from "@/lib/qab/qabOrderWrite";

/**
 * F-010 — `src/lib/qab/qabOrderWrite.ts` (contract § same name). The impure half of
 * the pull: everything here runs on an injected `tx`, never on `prisma` or
 * `qabPrisma` directly, so every function is exercised with a FAKE transaction
 * client — no real database, per the contract's own "Nivel 1 — suite (dev-tester),
 * sin base de datos y sin red".
 *
 * `insertQabOrders` invoked twice against the SAME real Postgres connection (the
 * DB-level half of criterion 4, ADR 0052) and the direct `create` that provokes a
 * real `P2002` are QA's job at "Nivel 2, extremo a extremo": this suite only
 * verifies this module's OWN logic (which queries it issues, with which shape, and
 * how it counts), against a fake client.
 *
 * The file-content grep at the bottom is deliberately a poor substitute for
 * reading the code — the contract says so itself — but it is the only thing that
 * can turn "no function here reads qabToken" from a prose rule into something a
 * test can hit, given ADR 0013's `select` beats `omit` and ADR 0015's wide
 * `qabPrisma` type gives no compiler error either.
 */

function fakeTx(overrides: Record<string, unknown> = {}): Prisma.TransactionClient {
  return {
    pedidoEntrante: { findMany: vi.fn(), create: vi.fn() },
    tienda: { findMany: vi.fn() },
    negocio: { findUnique: vi.fn(), updateMany: vi.fn() },
    ...overrides,
  } as unknown as Prisma.TransactionClient;
}

describe("readExistingQabOrderIds", () => {
  it("should return an empty Set without touching the database when qabOrderIds is []", async () => {
    const findMany = vi.fn();
    const tx = fakeTx({ pedidoEntrante: { findMany, create: vi.fn() } });

    const result = await readExistingQabOrderIds({ tx, negocioId: "negocio-1", qabOrderIds: [] });

    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("should query with negocioId AND qabOrderId: { in }, selecting only qabOrderId", async () => {
    const findMany = vi.fn().mockResolvedValue([{ qabOrderId: "1" }]);
    const tx = fakeTx({ pedidoEntrante: { findMany, create: vi.fn() } });

    await readExistingQabOrderIds({ tx, negocioId: "negocio-1", qabOrderIds: ["1", "2"] });

    expect(findMany).toHaveBeenCalledWith({
      where: { negocioId: "negocio-1", qabOrderId: { in: ["1", "2"] } },
      select: { qabOrderId: true },
    });
  });

  it("should return the ids found as a Set", async () => {
    const findMany = vi.fn().mockResolvedValue([{ qabOrderId: "1" }, { qabOrderId: "2" }]);
    const tx = fakeTx({ pedidoEntrante: { findMany, create: vi.fn() } });

    const result = await readExistingQabOrderIds({ tx, negocioId: "negocio-1", qabOrderIds: ["1", "2", "3"] });

    expect(result).toEqual(new Set(["1", "2"]));
  });

  it("should never mix a qabOrderId of another business in: the where always carries THIS negocioId", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = fakeTx({ pedidoEntrante: { findMany, create: vi.fn() } });

    await readExistingQabOrderIds({ tx, negocioId: "negocio-a", qabOrderIds: ["1"] });

    const callArgs = findMany.mock.calls[0][0];
    expect(callArgs.where.negocioId).toBe("negocio-a");
  });
});

describe("readOwnTiendaIds", () => {
  it("should return an empty Set without touching the database when storeExternalIds is []", async () => {
    const findMany = vi.fn();
    const tx = fakeTx({ tienda: { findMany } });

    const result = await readOwnTiendaIds({ tx, negocioId: "negocio-1", storeExternalIds: [] });

    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("should query Tienda with negocioId AND id: { in }, selecting only id — ONE query, never one per order", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "tienda-1" }]);
    const tx = fakeTx({ tienda: { findMany } });

    await readOwnTiendaIds({ tx, negocioId: "negocio-1", storeExternalIds: ["tienda-1", "tienda-2"] });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { negocioId: "negocio-1", id: { in: ["tienda-1", "tienda-2"] } },
      select: { id: true },
    });
  });

  it("criterion 7, second half: a storeExternalId that names a store of ANOTHER business must not resolve here", async () => {
    // The where already carries negocioId, so a store of another business simply
    // never appears among the rows the fake DB returns for THIS negocioId.
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = fakeTx({ tienda: { findMany } });

    const result = await readOwnTiendaIds({
      tx,
      negocioId: "negocio-a",
      storeExternalIds: ["shared-store-external-id"],
    });

    expect(result.has("shared-store-external-id")).toBe(false);
  });
});

describe("insertQabOrder", () => {
  it("should create exactly one row with the data given, and return nothing", async () => {
    const create = vi.fn().mockResolvedValue({ id: "row-1" });
    const tx = fakeTx({ pedidoEntrante: { findMany: vi.fn(), create } });
    const data = { negocioId: "negocio-1", qabOrderId: "1" } as unknown as Prisma.PedidoEntranteUncheckedCreateInput;

    const result = await insertQabOrder({ tx, data });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data });
    expect(result).toBeUndefined();
  });
});

/**
 * Arbitrated by arch-guardian mid-flight: `insertQabOrders` RE-READS which of its
 * own `qabOrderId`s are already stored (via `readExistingQabOrderIds`) before
 * creating, EVEN THOUGH the caller already filtered the batch with
 * `selectNewQabOrders`. That is deliberate, not a redundancy: it is what makes
 * this function idempotent BY ITSELF, so a retry after a partial failure — or any
 * future second caller — can never turn into a `P2002` that aborts the whole
 * transaction (ADR 0052). It is also what makes level 2 of criterion 4 executable
 * with a FAKE, in-memory tx: no real Postgres needed to prove the second call of
 * the same batch creates nothing.
 */
describe("insertQabOrders", () => {
  it("should return { created: 0 } and never touch the database when orders is []", async () => {
    const findMany = vi.fn();
    const create = vi.fn();
    const tx = fakeTx({ pedidoEntrante: { findMany, create } });

    const result = await insertQabOrders({ tx, negocioId: "negocio-1", orders: [] });

    expect(result).toEqual({ created: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("should pre-read existing ids (via readExistingQabOrderIds) and create every order NOT already present, IN ORDER", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({});
    const tx = fakeTx({ pedidoEntrante: { findMany, create } });
    const orders = [
      { negocioId: "negocio-1", qabOrderId: "1" },
      { negocioId: "negocio-1", qabOrderId: "2" },
    ] as unknown as Prisma.PedidoEntranteUncheckedCreateInput[];

    const result = await insertQabOrders({ tx, negocioId: "negocio-1", orders });

    expect(findMany).toHaveBeenCalledWith({
      where: { negocioId: "negocio-1", qabOrderId: { in: ["1", "2"] } },
      select: { qabOrderId: true },
    });
    expect(result).toEqual({ created: 2 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toEqual({ data: orders[0] });
    expect(create.mock.calls[1][0]).toEqual({ data: orders[1] });
  });

  it("should skip an order the pre-read finds already stored, without attempting to create it", async () => {
    const findMany = vi.fn().mockResolvedValue([{ qabOrderId: "1" }]);
    const create = vi.fn().mockResolvedValue({});
    const tx = fakeTx({ pedidoEntrante: { findMany, create } });
    const orders = [
      { negocioId: "negocio-1", qabOrderId: "1" },
      { negocioId: "negocio-1", qabOrderId: "2" },
    ] as unknown as Prisma.PedidoEntranteUncheckedCreateInput[];

    const result = await insertQabOrders({ tx, negocioId: "negocio-1", orders });

    expect(result).toEqual({ created: 1 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: orders[1] });
  });

  it("criterion 4, level 2 (ADR 0052): invoking it TWICE with the SAME batch, against a stateful fake DB, creates the rows only the first time — no race to win", async () => {
    // A minimal in-memory stand-in that actually remembers what was created, so
    // the SECOND call's own pre-read finds the row the FIRST call wrote.
    const stored = new Map<string, unknown>();
    const findMany = vi.fn(async (args: { where: { negocioId: string; qabOrderId: { in: string[] } } }) =>
      args.where.qabOrderId.in
        .filter((id) => stored.has(`${args.where.negocioId}:${id}`))
        .map((id) => ({ qabOrderId: id })),
    );
    const create = vi.fn(async (args: { data: { negocioId: string; qabOrderId: string } }) => {
      stored.set(`${args.data.negocioId}:${args.data.qabOrderId}`, args.data);
      return args.data;
    });
    const tx = fakeTx({ pedidoEntrante: { findMany, create } });
    const orders = [{ negocioId: "negocio-1", qabOrderId: "42" }] as unknown as Prisma.PedidoEntranteUncheckedCreateInput[];

    const first = await insertQabOrders({ tx, negocioId: "negocio-1", orders });
    const second = await insertQabOrders({ tx, negocioId: "negocio-1", orders });

    expect(first).toEqual({ created: 1 });
    expect(second).toEqual({ created: 0 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(stored.size).toBe(1);
  });
});

describe("readQabOrderCursor", () => {
  it("should project ONLY qabUltimoPedidoVisto — never qabToken, never even id", async () => {
    const findUnique = vi.fn().mockResolvedValue({ qabUltimoPedidoVisto: "42" });
    const tx = fakeTx({ negocio: { findUnique, updateMany: vi.fn() } });

    await readQabOrderCursor({ tx, negocioId: "negocio-1" });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "negocio-1" },
      select: { qabUltimoPedidoVisto: true },
    });
    const select = findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("qabToken");
    expect(Object.keys(select)).toEqual(["qabUltimoPedidoVisto"]);
  });

  it("should return the cursor verbatim", async () => {
    const findUnique = vi.fn().mockResolvedValue({ qabUltimoPedidoVisto: "999" });
    const tx = fakeTx({ negocio: { findUnique, updateMany: vi.fn() } });

    expect(await readQabOrderCursor({ tx, negocioId: "negocio-1" })).toBe("999");
  });

  it("should return null when the business has no cursor yet", async () => {
    const findUnique = vi.fn().mockResolvedValue({ qabUltimoPedidoVisto: null });
    const tx = fakeTx({ negocio: { findUnique, updateMany: vi.fn() } });

    expect(await readQabOrderCursor({ tx, negocioId: "negocio-1" })).toBeNull();
  });

  it("should return null, never throw, when the business row is gone", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const tx = fakeTx({ negocio: { findUnique, updateMany: vi.fn() } });

    await expect(readQabOrderCursor({ tx, negocioId: "negocio-gone" })).resolves.toBeNull();
  });
});

describe("advanceQabOrderCursorRow", () => {
  it("should write with updateMany({ where: { id: negocioId }, data: { qabUltimoPedidoVisto: cursor } })", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = fakeTx({ negocio: { findUnique: vi.fn(), updateMany } });

    const result = await advanceQabOrderCursorRow({ tx, negocioId: "negocio-1", cursor: "42" });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "negocio-1" },
      data: { qabUltimoPedidoVisto: "42" },
    });
    expect(result).toBe(1);
  });

  it("should write nothing and return 0 when cursor is null", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = fakeTx({ negocio: { findUnique: vi.fn(), updateMany } });

    const result = await advanceQabOrderCursorRow({ tx, negocioId: "negocio-1", cursor: null });

    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("should use updateMany, never a bare update that could touch the wrong row on a race", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = fakeTx({ negocio: { findUnique: vi.fn(), updateMany } });

    await advanceQabOrderCursorRow({ tx, negocioId: "negocio-1", cursor: "1" });

    expect(updateMany).toHaveBeenCalled();
    // `update` (singular) must not exist on the fake negocio client at all for
    // this call to even be possible without it — nothing further to assert here
    // beyond updateMany having been the one invoked.
  });
});

describe("qabOrderWrite.ts never reads qabToken (structural, per ADR 0013/0015)", () => {
  it("should not contain the string 'qabToken' anywhere in the source file", () => {
    const filePath = path.resolve(__dirname, "../lib/qab/qabOrderWrite.ts");
    const source = readFileSync(filePath, "utf8");
    expect(source).not.toContain("qabToken");
  });
});
