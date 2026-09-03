import { describe, it, expect, vi, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { pullQabOrders } from "@/lib/qab/orderPoll";

/**
 * F-002 — `src/lib/qab/orderPoll.ts`, the slot F-010 fills in. This feature builds only
 * the shape: no network call, a fixed `{ pulled: 0, implemented: false }`, and exactly
 * one log line on entry — the log is the executable evidence of criterion 6 (two
 * concurrent runs on the same business must never both reach this point). `tx` is unused
 * in F-002's body, so an empty stub is enough; no database needed.
 */
describe("pullQabOrders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should perform no network call and report { pulled: 0, implemented: false }", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const report = await pullQabOrders({
      tx: {} as Prisma.TransactionClient,
      negocioId: "negocio-1",
      token: "t",
      baseUrl: "https://qab.example",
    });

    expect(report).toEqual({ pulled: 0, implemented: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should log exactly one 'qab.orderPoll.enter' line naming the negocioId", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await pullQabOrders({
      tx: {} as Prisma.TransactionClient,
      negocioId: "negocio-42",
      token: "t",
      baseUrl: "https://qab.example",
    });

    const enterLines = logSpy.mock.calls
      .map((args) => args.join(" "))
      .filter((line) => line.includes("qab.orderPoll.enter"));

    expect(enterLines).toHaveLength(1);
    expect(enterLines[0]).toContain("negocioId=negocio-42");
  });

  it("should never leak the token in its log output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = "super-secret-poll-token";

    await pullQabOrders({
      tx: {} as Prisma.TransactionClient,
      negocioId: "negocio-1",
      token,
      baseUrl: "https://qab.example",
    });

    const allLoggedText = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(allLoggedText).not.toContain(token);
  });
});
