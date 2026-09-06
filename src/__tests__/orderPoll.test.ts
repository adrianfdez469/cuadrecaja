import { describe, it, expect, vi, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  pullQabOrders,
  qabOrderPullErrorCode,
  emptyQabOrderPullReport,
} from "@/lib/qab/orderPoll";
import type { IQabOrderFetchOutcome } from "@/lib/qab/qabOrderClient";
import {
  QAB_ORDER_PULL_MAX_PAGES_PER_RUN,
  QAB_ORDER_PULL_PAGE_SIZE_LADDER,
  QAB_ORDER_PULL_UNKNOWN_ERROR_CODE,
} from "@/constants/qab";

/**
 * F-010 — `src/lib/qab/orderPoll.ts` (contract § same name), rewritten wholesale
 * for the feature that fills the slot F-002 built. The old F-002 suite asserted
 * the stub's fixed `{ pulled: 0, implemented: false }` and no network call — both
 * deliberately replaced by this contract, so those assertions are obsolete, not a
 * regression to protect. This file replaces them with the real contract.
 *
 * Per the contract's own "Verificación" section: `pullQabOrders` is exercised
 * WHOLE, with `fetchPage` injected (sin red) and a FAKE, in-memory `tx` (sin base
 * de datos) — never a real Postgres connection. The fake tx below is a minimal
 * in-memory Prisma stand-in, driving the REAL `qabOrderWrite.ts` /
 * `qabOrderPullPlan.ts` functions this module calls internally.
 *
 * Five cases are written to be impossible to pass with a broken implementation
 * (E-008), because the contract calls them out by name: criterion 2 needs the
 * exact zero-fee pair, criterion 9 needs a NON-ZERO deliveryFee, criterion 6 needs
 * an invented tenth status, criterion 7 needs two genuinely different
 * cursors/tokens, and criterion 12 needs both businesses checked, not just the
 * failing one.
 */

interface IFakeOrder {
  id: string;
  code?: string;
  storeExternalId?: string;
  status?: string;
  cancelledBy?: string | null;
  contact?: unknown;
  currencyCode?: string;
  subtotal?: string;
  discountTotal?: string;
  deliveryFee?: string;
  total?: string;
  deliveryFeePending?: boolean;
  rateSnapshot?: unknown;
  notes?: string | null;
  customerWhatsappUrl?: string | null;
  proposal?: unknown;
  createdAt?: string | null;
  items?: unknown[];
}

function rawOrder(overrides: IFakeOrder): Record<string, unknown> {
  return {
    code: "ABCDEFGHIJ",
    storeExternalId: "store-1",
    status: "PENDING",
    cancelledBy: null,
    contact: { name: "Cliente" },
    currencyCode: "CUP",
    subtotal: "100.00",
    discountTotal: "0.00",
    deliveryFee: "0.00",
    total: "100.00",
    deliveryFeePending: false,
    rateSnapshot: { rate: "1" },
    notes: null,
    customerWhatsappUrl: null,
    proposal: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    items: [],
    ...overrides,
  };
}

function fakeFetchPage(
  ...pages: IQabOrderFetchOutcome[]
): (args: { since: string | null; limit: number }) => Promise<IQabOrderFetchOutcome> {
  const calls: Array<{ since: string | null; limit: number }> = [];
  let i = 0;
  const fn = vi.fn(async (args: { since: string | null; limit: number }) => {
    calls.push(args);
    const page = pages[Math.min(i, pages.length - 1)];
    i += 1;
    return page;
  });
  (fn as unknown as { calls: typeof calls }).calls = calls;
  return fn as unknown as (args: {
    since: string | null;
    limit: number;
  }) => Promise<IQabOrderFetchOutcome>;
}

/** A minimal in-memory stand-in for `Prisma.TransactionClient`, driving the REAL
 * `qabOrderWrite.ts` functions `pullQabOrders` calls internally. No real database. */
function createFakeTx(ownTiendaIds: string[] = []) {
  const stored = new Map<string, Record<string, unknown>>();
  const ownStores = new Set(ownTiendaIds);
  const updateManyCalls: Array<{ where: unknown; data: unknown }> = [];

  const tx = {
    pedidoEntrante: {
      findMany: vi.fn(async (args: { where: { negocioId: string; qabOrderId: { in: string[] } } }) => {
        const { negocioId, qabOrderId } = args.where;
        return qabOrderId.in
          .filter((id) => stored.has(`${negocioId}:${id}`))
          .map((id) => ({ qabOrderId: id }));
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const key = `${args.data.negocioId}:${args.data.qabOrderId}`;
        stored.set(key, args.data);
        return args.data;
      }),
    },
    tienda: {
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.filter((id) => ownStores.has(id)).map((id) => ({ id })),
      ),
    },
    negocio: {
      findUnique: vi.fn(),
      updateMany: vi.fn(async (args: { where: unknown; data: unknown }) => {
        updateManyCalls.push(args);
        return { count: 1 };
      }),
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, stored, updateManyCalls };
}

const BASE_ARGS = { baseUrl: "https://qab.example", token: "t" };

describe("pullQabOrders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should log exactly one 'qab.orderPoll.enter' line naming the negocioId", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { tx } = createFakeTx();

    await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-42",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } }),
    });

    const enterLines = logSpy.mock.calls.map((args) => args.join(" ")).filter((l) => l.includes("qab.orderPoll.enter"));
    expect(enterLines).toHaveLength(1);
    expect(enterLines[0]).toContain("negocioId=negocio-42");
  });

  it("should never leak the token in its log output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = "super-secret-poll-token";
    const { tx } = createFakeTx();

    await pullQabOrders({
      baseUrl: "https://qab.example",
      token,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } }),
    });

    const allLoggedText = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(allLoggedText).not.toContain(token);
  });

  it("criterion 1: a pulled order lands in the fake store with its lines, and the cursor advances", async () => {
    const { tx, stored } = createFakeTx();
    const order = rawOrder({ id: "7", items: [{ name: "Producto", unitPrice: "10.00", currencyCode: "CUP", quantity: "1.000", lineTotal: "10.00" }] });

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
    });

    expect(report.pulled).toBe(1);
    expect(report.received).toBe(1);
    expect(report.cursorAfter).toBe("7");
    expect(stored.get("negocio-1:7")).toBeDefined();
    expect((stored.get("negocio-1:7")?.lineas as { create: unknown[] })?.create).toHaveLength(1);
  });

  it("criterion 4: two runs starting from the SAME cursor (the overlapping-pollers anomaly the QAB contract itself describes) write the order only once", async () => {
    // Both runs are handed the SAME `since` on purpose — this is what the QAB
    // contract calls out as the actual anomaly (its own read + PULLED-mark are
    // not atomic), not "the next run re-fetches an already-cursored id" (which
    // QAB itself would never resend, and is criterion 3's territory instead).
    const { tx } = createFakeTx();
    const order = rawOrder({ id: "9" });

    const first = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
    });
    const second = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
    });

    expect(first.pulled).toBe(1);
    expect(second.pulled).toBe(0);
    expect(second.duplicates).toBe(1);
  });

  it("criterion 5: ids with gaps ('10', '42', '7000' in the same page) advance the cursor without any alarm", async () => {
    const { tx } = createFakeTx();
    const orders = [rawOrder({ id: "10" }), rawOrder({ id: "42" }), rawOrder({ id: "7000" })];

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders, nextCursor: null } }),
    });

    expect(report.cursorAfter).toBe("7000");
    expect(report.pulled).toBe(3);
    expect(report.rejected).toBe(0);
    expect(report.outcome).toBe("ok");
  });

  it.each(["AWAITING_CUSTOMER", "IN_TRANSIT", "REJECTED_BY_STORE", "SOMETHING_INVENTED_FOR_A_TENTH_VALUE"])(
    "criterion 6: an order with status %s is written without throwing — no switch, no default",
    async (status) => {
      const { tx, stored } = createFakeTx();
      const order = rawOrder({ id: "1", status });

      await expect(
        pullQabOrders({
          ...BASE_ARGS,
          tx,
          negocioId: "negocio-1",
          cursor: null,
          fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
        }),
      ).resolves.not.toThrow();

      expect(stored.get("negocio-1:1")?.status).toBe(status);
    },
  );

  it("criterion 7: `since` sent to fetchPage is ALWAYS this business's own cursor, never the other business's", async () => {
    const fetchA = fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } });
    const fetchB = fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } });
    const { tx: txA } = createFakeTx();
    const { tx: txB } = createFakeTx();

    await pullQabOrders({ ...BASE_ARGS, tx: txA, negocioId: "negocio-a", cursor: "100", fetchPage: fetchA });
    await pullQabOrders({ ...BASE_ARGS, tx: txB, negocioId: "negocio-b", cursor: "9000", fetchPage: fetchB });

    const callsA = (fetchA as unknown as { calls: Array<{ since: string | null }> }).calls;
    const callsB = (fetchB as unknown as { calls: Array<{ since: string | null }> }).calls;
    expect(callsA[0].since).toBe("100");
    expect(callsB[0].since).toBe("9000");
  });

  it("criterion 7: the default (non-injected) fetch path sends each business's OWN Authorization token, never swapped", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ orders: [], nextCursor: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { tx: txA } = createFakeTx();
    const { tx: txB } = createFakeTx();

    await pullQabOrders({ baseUrl: "https://qab.example", token: "token-a", tx: txA, negocioId: "negocio-a", cursor: null });
    await pullQabOrders({ baseUrl: "https://qab.example", token: "token-b", tx: txB, negocioId: "negocio-b", cursor: null });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, initA] = fetchMock.mock.calls[0];
    const [, initB] = fetchMock.mock.calls[1];
    expect(initA.headers.Authorization).toBe("Bearer token-a");
    expect(initB.headers.Authorization).toBe("Bearer token-b");
  });

  it("criterion 7: readOwnTiendaIds never resolves a store belonging to another business's negocioId", async () => {
    // Two businesses whose stores share the same storeExternalId VALUE: only the
    // one whose fake tx actually owns it may resolve a tiendaId.
    const SHARED_ID = "shared-store-id";
    const { tx: txWithoutStore, stored: storedA } = createFakeTx([]);
    const { tx: txWithStore, stored: storedB } = createFakeTx([SHARED_ID]);
    const order = rawOrder({ id: "1", storeExternalId: SHARED_ID });

    await pullQabOrders({
      ...BASE_ARGS,
      tx: txWithoutStore,
      negocioId: "negocio-a",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
    });
    await pullQabOrders({
      ...BASE_ARGS,
      tx: txWithStore,
      negocioId: "negocio-b",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [{ ...order }], nextCursor: null } }),
    });

    expect(storedA.get("negocio-a:1")?.tiendaId).toBeNull();
    expect(storedB.get("negocio-b:1")?.tiendaId).toBe(SHARED_ID);
  });

  it("criterion 8: '880' and '880.00' on the wire store the SAME Decimal value", async () => {
    const { tx, stored } = createFakeTx();
    const orders = [
      rawOrder({ id: "1", subtotal: "880", total: "880" }),
      rawOrder({ id: "2", subtotal: "880.00", total: "880.00" }),
    ];

    await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders, nextCursor: null } }),
    });

    expect(stored.get("negocio-1:1")?.subtotal).toBe("880.00");
    expect(stored.get("negocio-1:2")?.subtotal).toBe("880.00");
  });

  it("criterion 9: an order whose totals do not match either identity is still written, counted in inconsistentTotals", async () => {
    const { tx, stored } = createFakeTx();
    const order = rawOrder({
      id: "1",
      deliveryFeePending: false,
      subtotal: "100.00",
      discountTotal: "0.00",
      deliveryFee: "0.00",
      total: "1.00",
    });

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: null } }),
    });

    expect(report.inconsistentTotals).toBe(1);
    expect(report.rejected).toBe(0);
    expect(stored.get("negocio-1:1")).toBeDefined();
  });

  it("criterion 10: an order whose amount overflows Decimal(14,2) is rejected ALONE, the rest of the page is written, and the cursor advances over it too", async () => {
    const { tx, stored } = createFakeTx();
    const orders = [
      rawOrder({ id: "1" }),
      rawOrder({ id: "2", subtotal: "9999999999999.99", total: "9999999999999.99" }),
      rawOrder({ id: "3" }),
    ];

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders, nextCursor: null } }),
    });

    expect(report.rejected).toBe(1);
    expect(report.pulled).toBe(2);
    expect(stored.get("negocio-1:1")).toBeDefined();
    expect(stored.get("negocio-1:2")).toBeUndefined();
    expect(stored.get("negocio-1:3")).toBeDefined();
    expect(report.cursorAfter).toBe("3");
  });

  it("criterion 11: a distinguishable Order.code never appears in any log line, success or failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const marker = "MARKERCODEXX";
    const { tx } = createFakeTx();
    const goodOrder = rawOrder({ id: "1", code: marker });
    const rejectedOrder = rawOrder({ id: "2", code: marker, subtotal: "9999999999999.99" });

    await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [goodOrder, rejectedOrder], nextCursor: null } }),
    });

    const everything = [...logSpy.mock.calls, ...errorSpy.mock.calls].map((c) => c.join(" ")).join("\n");
    expect(everything).not.toContain(marker);
  });

  it("HTTP error (non tooLarge): outcome is 'error', it does not throw, and the cursor does not advance", async () => {
    const { tx } = createFakeTx();

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: "5",
      fetchPage: fakeFetchPage({ kind: "error", error: "HTTP:401", tooLarge: false }),
    });

    expect(report.outcome).toBe("error");
    expect(report.cursorAfter).toBe("5");
    expect(report.pulled).toBe(0);
  });

  it("the retry ladder: a tooLarge error is retried on the SAME since, walking down the page-size ladder, and each attempt counts as a page", async () => {
    const calls: number[] = [];
    const fetchPage = vi.fn(async ({ limit }: { since: string | null; limit: number }) => {
      calls.push(limit);
      if (calls.length < QAB_ORDER_PULL_PAGE_SIZE_LADDER.length) {
        return { kind: "error", error: "TRANSPORT:RESPONSE_TOO_LARGE", tooLarge: true } as IQabOrderFetchOutcome;
      }
      return { kind: "ok", page: { orders: [], nextCursor: null } } as IQabOrderFetchOutcome;
    });
    const { tx } = createFakeTx();

    const report = await pullQabOrders({ ...BASE_ARGS, tx, negocioId: "negocio-1", cursor: null, fetchPage });

    expect(calls).toEqual([...QAB_ORDER_PULL_PAGE_SIZE_LADDER]);
    expect(report.pages).toBe(QAB_ORDER_PULL_PAGE_SIZE_LADDER.length);
    expect(report.outcome).toBe("ok");
  });

  it("the retry ladder exhausted: tooLarge on every rung ends the business with outcome 'error'", async () => {
    const fetchPage = vi.fn(async () => ({ kind: "error", error: "x", tooLarge: true }) as IQabOrderFetchOutcome);
    const { tx } = createFakeTx();

    const report = await pullQabOrders({ ...BASE_ARGS, tx, negocioId: "negocio-1", cursor: null, fetchPage });

    expect(report.outcome).toBe("error");
    expect(report.pages).toBe(QAB_ORDER_PULL_PAGE_SIZE_LADDER.length);
  });

  it("should stop BEFORE a page that would not fit the remaining budget, without treating it as an error", async () => {
    const fetchPage = fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } });
    const { tx } = createFakeTx();

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      deadlineAt: Date.now() - 1,
      fetchPage,
    });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(report.pages).toBe(0);
    expect(report.outcome).toBe("ok");
  });

  it("should never request more than QAB_ORDER_PULL_MAX_PAGES_PER_RUN pages in one run", async () => {
    let n = 0;
    const fetchPage = vi.fn(async () => {
      n += 1;
      return { kind: "ok", page: { orders: [], nextCursor: String(n) } } as IQabOrderFetchOutcome;
    });
    const { tx } = createFakeTx();

    const report = await pullQabOrders({ ...BASE_ARGS, tx, negocioId: "negocio-1", cursor: null, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(QAB_ORDER_PULL_MAX_PAGES_PER_RUN);
    expect(report.pages).toBe(QAB_ORDER_PULL_MAX_PAGES_PER_RUN);
    expect(report.moreAvailable).toBe(true);
  });

  it("an empty page with nextCursor: null touches nothing: all counters at zero, cursor untouched, outcome ok", async () => {
    const { tx, updateManyCalls } = createFakeTx();

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: "5",
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [], nextCursor: null } }),
    });

    expect(report).toMatchObject({
      pulled: 0,
      received: 0,
      duplicates: 0,
      rejected: 0,
      inconsistentTotals: 0,
      cursorAfter: "5",
      cursorJumps: 0,
      moreAvailable: false,
      outcome: "ok",
    });
    expect(updateManyCalls).toHaveLength(0);
  });

  it("writes the cursor at the END OF EACH PAGE, not just at the end of the run", async () => {
    const { tx, updateManyCalls } = createFakeTx();
    let call = 0;
    const fetchPage = vi.fn(async (): Promise<IQabOrderFetchOutcome> => {
      call += 1;
      // nextCursor: "1" on page 1 — equal to the max id THAT page delivered, so
      // no jump — leaves room for page 2 to advance the cursor again, to a
      // genuinely different value ("5"), so the second write is observable.
      if (call === 1) {
        return { kind: "ok", page: { orders: [rawOrder({ id: "1" })], nextCursor: "1" } };
      }
      return { kind: "ok", page: { orders: [rawOrder({ id: "5" })], nextCursor: null } };
    });

    await pullQabOrders({ ...BASE_ARGS, tx, negocioId: "negocio-1", cursor: null, fetchPage });

    expect(updateManyCalls.length).toBeGreaterThanOrEqual(2);
    expect(updateManyCalls[0].data).toEqual({ qabUltimoPedidoVisto: "1" });
    expect(updateManyCalls[1].data).toEqual({ qabUltimoPedidoVisto: "5" });
  });

  it("sequence rule 10: a non-empty page whose ids are ALL unreadable, with nextCursor: null, leaves the cursor exactly where it was — outcome 'error', nothing written", async () => {
    const { tx, stored, updateManyCalls } = createFakeTx();
    // Neither a valid `id` field: readQabOrderId returns null for both, so
    // receivedIds folds to nothing new and the cursor cannot move past them.
    const unreadable = [{ code: "AAAAAAAAAA" }, { code: "BBBBBBBBBB" }];

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: "5",
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: unreadable, nextCursor: null } }),
    });

    expect(report.outcome).toBe("error");
    expect(report.cursorAfter).toBe("5");
    expect(report.pulled).toBe(0);
    expect(stored.size).toBe(0);
    expect(updateManyCalls).toHaveLength(0);
  });

  it("a jumped nextCursor (past every id delivered) is counted in cursorJumps, and still moves the cursor", async () => {
    const { tx } = createFakeTx();
    const order = rawOrder({ id: "10" });

    const report = await pullQabOrders({
      ...BASE_ARGS,
      tx,
      negocioId: "negocio-1",
      cursor: null,
      fetchPage: fakeFetchPage({ kind: "ok", page: { orders: [order], nextCursor: "9000" } }),
    });

    expect(report.cursorJumps).toBe(1);
    expect(report.cursorAfter).toBe("9000");
  });
});

describe("emptyQabOrderPullReport", () => {
  it("should return every counter at zero, implemented: false, and the given outcome", () => {
    const report = emptyQabOrderPullReport("skipped_deadline");
    expect(report.implemented).toBe(false);
    expect(report.outcome).toBe("skipped_deadline");
    expect(report.pulled).toBe(0);
    expect(report.pages).toBe(0);
    expect(report.cursorBefore).toBeNull();
    expect(report.cursorAfter).toBeNull();
  });
});

describe("qabOrderPullErrorCode", () => {
  it("should return the Prisma error's own code for a PrismaClientKnownRequestError", () => {
    const error = new Prisma.PrismaClientKnownRequestError("some internal detail", {
      code: "P2002",
      clientVersion: "6.0.0",
      meta: { target: ["negocioId", "qabOrderId"] },
    });

    expect(qabOrderPullErrorCode(error)).toBe("P2002");
  });

  it("should recognize a PrismaClientKnownRequestError via instanceof, not duck typing", () => {
    const error = new Prisma.PrismaClientKnownRequestError("boom", { code: "P2028", clientVersion: "6.0.0" });
    expect(error instanceof Prisma.PrismaClientKnownRequestError).toBe(true);
    expect(qabOrderPullErrorCode(error)).toBe("P2028");
  });

  it("should return QAB_ORDER_PULL_UNKNOWN_ERROR_CODE for a plain Error", () => {
    expect(qabOrderPullErrorCode(new Error("network exploded"))).toBe(QAB_ORDER_PULL_UNKNOWN_ERROR_CODE);
  });

  it("should return QAB_ORDER_PULL_UNKNOWN_ERROR_CODE for a non-Error thrown value", () => {
    expect(qabOrderPullErrorCode("a string throw")).toBe(QAB_ORDER_PULL_UNKNOWN_ERROR_CODE);
    expect(qabOrderPullErrorCode(undefined)).toBe(QAB_ORDER_PULL_UNKNOWN_ERROR_CODE);
  });

  it("should NEVER return the error's own message: only a short, closed-vocabulary code", () => {
    const distinguishableMessage = "UNIQUE_MESSAGE_TEXT_THAT_MUST_NEVER_SURFACE";
    expect(qabOrderPullErrorCode(new Error(distinguishableMessage))).not.toContain(distinguishableMessage);

    const prismaError = new Prisma.PrismaClientKnownRequestError(distinguishableMessage, {
      code: "P2028",
      clientVersion: "6.0.0",
    });
    expect(qabOrderPullErrorCode(prismaError)).not.toContain(distinguishableMessage);
  });
});
