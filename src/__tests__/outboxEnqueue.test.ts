import { describe, it, expect, vi } from "vitest";
import { ZodError } from "zod";
import { enqueueOutboxEvent, enqueueOutboxEvents } from "@/lib/qab/outboxEnqueue";
import type { IOutboxEventoCreate } from "@/schemas/qabOutbox";
import type { PrismaClientLike } from "@/lib/prisma";

/**
 * F-002 — `src/lib/qab/outboxEnqueue.ts` (criterion 1). The atomicity itself — that a
 * rollback of the caller's transaction leaves no `OutboxEvento` row — needs a real
 * database and is `qa`'s to verify by executing. What IS testable here without one:
 * that a malformed input is rejected with `ZodError` BEFORE any write is attempted (the
 * mechanism the contract relies on to "tumbar también la mutación"), and that an id
 * coming back from Prisma as a BigInt is converted to a decimal string before it leaves
 * this module — the exact boundary E-003 warns about, and the one place in the codebase
 * a BigInt from this table could reach `JSON.stringify` if it slipped through.
 *
 * `tx` is injected per the contract's own signature (`tx` is the first argument on
 * purpose), so it is faked here rather than touching Prisma or a real database.
 */

const validCreate: IOutboxEventoCreate = {
  negocioId: "negocio-1",
  entidad: "PRODUCT",
  entidadId: "producto-1",
  operacion: "UPDATE",
  payload: { storeProductId: "pt-1" },
};

/**
 * A tx whose `outboxEvento` methods throw the moment they are CALLED — not merely
 * accessed, since the implementation is free to destructure `tx.outboxEvento` before
 * validating. Proves no write was attempted, without assuming an access order the
 * contract never promised (it only promises validation happens before WRITING).
 */
const explodingTx = {
  outboxEvento: new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error("must validate before writing to the database");
        };
      },
    }
  ),
} as unknown as PrismaClientLike;

/**
 * A tx that records every call made under `outboxEvento`, regardless of which specific
 * method the implementation picks, and resolves each with `returnValue`.
 */
function makeCapturingTx(returnValue: unknown) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const outboxEvento = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return Promise.resolve(returnValue);
        };
      },
    }
  );
  return { tx: { outboxEvento } as unknown as PrismaClientLike, calls };
}

describe("enqueueOutboxEvent", () => {
  it("should throw ZodError and never touch the database for an entidad outside the wire vocabulary", async () => {
    const invalid = { ...validCreate, entidad: "PRODUCTO" };
    await expect(enqueueOutboxEvent(explodingTx, invalid as unknown as IOutboxEventoCreate)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("should throw ZodError and never touch the database for an operacion outside the wire vocabulary", async () => {
    const invalid = { ...validCreate, operacion: "UPSERT" };
    await expect(enqueueOutboxEvent(explodingTx, invalid as unknown as IOutboxEventoCreate)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("should throw ZodError and never write for a blank negocioId", async () => {
    const invalid = { ...validCreate, negocioId: "" };
    await expect(enqueueOutboxEvent(explodingTx, invalid)).rejects.toBeInstanceOf(ZodError);
  });

  it("should call exactly one Prisma write and return its id as a decimal string, never a BigInt", async () => {
    const { tx, calls } = makeCapturingTx({ id: BigInt(880) });

    const result = await enqueueOutboxEvent(tx, validCreate);

    expect(calls).toHaveLength(1);
    expect(result).toEqual({ id: "880" });
    expect(typeof result.id).toBe("string");
  });
});

describe("enqueueOutboxEvents", () => {
  it("should return { ids: [] } for an empty input array without touching the database", async () => {
    await expect(enqueueOutboxEvents(explodingTx, [])).resolves.toEqual({ ids: [] });
  });

  it("should throw ZodError and never touch the database when any one entry is invalid", async () => {
    const inputs = [validCreate, { ...validCreate, operacion: "UPSERT" } as unknown as IOutboxEventoCreate];
    await expect(enqueueOutboxEvents(explodingTx, inputs)).rejects.toBeInstanceOf(ZodError);
  });

  it("should use createManyAndReturn and convert every BigInt id to a decimal string, preserving order", async () => {
    const createManyAndReturn = vi.fn().mockResolvedValue([{ id: BigInt(880) }, { id: BigInt(881) }]);
    const tx = { outboxEvento: { createManyAndReturn } } as unknown as PrismaClientLike;

    const result = await enqueueOutboxEvents(tx, [validCreate, validCreate]);

    expect(createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ids: ["880", "881"] });
    expect(result.ids.every((id) => typeof id === "string")).toBe(true);
  });
});
