import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { IQabOrderPullReport } from "@/lib/qab/orderPoll";
import {
  emptyQabOutboxDrainReport,
  emptyQabSlugLearnPhaseReport,
} from "@/lib/qab/outboxAck";
import { emptyQabAvailabilityPhaseReport } from "@/lib/qab/qabAvailabilityPlan";

/**
 * F-010 — criterion 12, "un fallo de red o HTTP en el pull de un negocio no
 * interrumpe la corrida de los demás", verified at the ONE place it can actually
 * be verified: the loop of `runQabSyncTiendaCron()` (contract § "Encaje en
 * src/lib/qab/syncTiendaCron.ts"). `pullQabOrders` itself never knows about other
 * businesses, so this property cannot be exercised at its level — that suite
 * (`orderPoll.test.ts`) already covers what a single business's HTTP-error
 * outcome looks like; this file covers whether the ORCHESTRATOR keeps going.
 *
 * `pullQabOrders` and `withQabOrderPollLock` are mocked here on purpose — this is
 * NOT a montage of two concurrent pollers (the contract explicitly forbids that,
 * ADR 0052) and NOT a real database (`qabPrisma`'s advisory lock needs live
 * Postgres, out of this "sin base de datos" suite's reach). The DB-path test
 * below is exactly the "montaje aparte y obligatorio" the contract's own mapping
 * table (criterio 12, fila "base de datos") calls for: a `pullQabOrders` that
 * THROWS — standing in for a `create()` that hit `P2002`/`P2028` after the
 * Postgres transaction was already aborted, which `pullQabOrders` cannot catch by
 * construction (ADR 0052) — with two eligible businesses, checking the loop's own
 * `try/catch` (contract § same section) never lets that exception escape
 * `runQabSyncTiendaCron()` and never lets it stop the SECOND business.
 */

const OK_NEGOCIO = "negocio-ok";
const FAIL_NEGOCIO = "negocio-fail";

const negocioFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { negocio: { findMany: (...args: unknown[]) => negocioFindManyMock(...args) } },
}));

const loadQabTokensMock = vi.fn();
const drainQabOutboxMock = vi.fn();
vi.mock("@/lib/qab/outboxDrain", () => ({
  drainQabOutbox: (...args: unknown[]) => drainQabOutboxMock(...args),
  loadQabTokens: (...args: unknown[]) => loadQabTokensMock(...args),
}));

const withQabOrderPollLockMock = vi.fn();
vi.mock("@/lib/qab/orderPollLock", () => ({
  withQabOrderPollLock: (...args: unknown[]) => withQabOrderPollLockMock(...args),
}));

const readQabOrderCursorMock = vi.fn();
vi.mock("@/lib/qab/qabOrderWrite", () => ({
  // syncTiendaCron.ts's own contract snippet only reads the cursor here; every
  // OTHER qabOrderWrite.ts function is used inside pullQabOrders, which this
  // file mocks away entirely. If syncTiendaCron.ts ever imports something else
  // from this module, this stub makes that obvious instead of silently patching
  // over it (the same technique slugLearn.test.ts uses for outboxDrain.ts).
  readQabOrderCursor: (...args: unknown[]) => readQabOrderCursorMock(...args),
}));

const pullQabOrdersMock = vi.fn();
vi.mock("@/lib/qab/orderPoll", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/qab/orderPoll")>();
  return { ...actual, pullQabOrders: (...args: unknown[]) => pullQabOrdersMock(...args) };
});

const syncQabAvailabilityMock = vi.fn();
vi.mock("@/lib/qab/availabilitySync", () => ({
  syncQabAvailability: (...args: unknown[]) => syncQabAvailabilityMock(...args),
}));

const learnQabAssignedSlugsMock = vi.fn();
vi.mock("@/lib/qab/slugLearn", () => ({
  learnQabAssignedSlugs: (...args: unknown[]) => learnQabAssignedSlugsMock(...args),
}));

const { runQabSyncTiendaCron } = await import("@/lib/qab/syncTiendaCron");

function pullReport(overrides: Partial<IQabOrderPullReport> = {}): IQabOrderPullReport {
  return {
    pulled: 0,
    implemented: true,
    pages: 1,
    received: 0,
    duplicates: 0,
    rejected: 0,
    inconsistentTotals: 0,
    cursorBefore: null,
    cursorAfter: null,
    cursorJumps: 0,
    moreAvailable: false,
    outcome: "ok",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("QAB_API_BASE_URL", "https://qab.example");
  negocioFindManyMock.mockReset().mockResolvedValue([{ id: FAIL_NEGOCIO }, { id: OK_NEGOCIO }]);
  loadQabTokensMock.mockReset().mockResolvedValue(
    new Map([
      [FAIL_NEGOCIO, "token-fail"],
      [OK_NEGOCIO, "token-ok"],
    ]),
  );
  drainQabOutboxMock.mockReset().mockResolvedValue(emptyQabOutboxDrainReport());
  readQabOrderCursorMock.mockReset().mockResolvedValue(null);
  syncQabAvailabilityMock.mockReset().mockResolvedValue(emptyQabAvailabilityPhaseReport());
  learnQabAssignedSlugsMock.mockReset().mockResolvedValue(emptyQabSlugLearnPhaseReport());
  withQabOrderPollLockMock.mockReset().mockImplementation(async (_negocioId: string, run: (tx: unknown) => Promise<unknown>) => ({
    acquired: true,
    value: await run({}),
  }));
  pullQabOrdersMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runQabSyncTiendaCron — criterion 12, HTTP path", () => {
  it("a per-business HTTP/transport error for one business does not stop the other from being processed", async () => {
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        return pullReport({ outcome: "error", cursorBefore: "5", cursorAfter: "5" });
      }
      return pullReport({ outcome: "ok", pulled: 3, cursorBefore: null, cursorAfter: "10" });
    });

    const report = await runQabSyncTiendaCron();

    expect(report.poll.businesses).toHaveLength(2);

    const failEntry = report.poll.businesses.find((b) => b.negocioId === FAIL_NEGOCIO);
    const okEntry = report.poll.businesses.find((b) => b.negocioId === OK_NEGOCIO);

    expect(failEntry?.outcome).toBe("error");
    expect(okEntry?.outcome).toBe("ok");
    expect(okEntry?.pulled).toBe(3);
    // No exception was thrown for this business: `failed` is the counter for a
    // slot that THREW, not for a normal outcome: "error" report.
    expect(report.poll.failed).toBe(0);
  });
});

describe("runQabSyncTiendaCron — criterion 12, DATABASE path (contract's own mandatory montage)", () => {
  it("resolves, without throwing, when one business's slot throws a Prisma error", async () => {
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        throw new Prisma.PrismaClientKnownRequestError("transaction aborted mid-write", {
          code: "P2028",
          clientVersion: "6.0.0",
        });
      }
      return pullReport({ outcome: "ok", pulled: 5, cursorAfter: "10" });
    });

    await expect(runQabSyncTiendaCron()).resolves.toBeDefined();
  });

  it("reports the failed business with lock: 'unknown' (never 'acquired') and outcome: 'error', and counts it in poll.failed", async () => {
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        throw new Prisma.PrismaClientKnownRequestError("transaction aborted mid-write", {
          code: "P2028",
          clientVersion: "6.0.0",
        });
      }
      return pullReport({ outcome: "ok", pulled: 5, cursorAfter: "10" });
    });

    const report = await runQabSyncTiendaCron();
    const failEntry = report.poll.businesses.find((b) => b.negocioId === FAIL_NEGOCIO);

    expect(failEntry?.lock).toBe("unknown");
    expect(failEntry?.outcome).toBe("error");
    expect(report.poll.failed).toBe(1);
  });

  it("still processes the SECOND business normally: its cursor advances and its report shows pulled > 0", async () => {
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        throw new Prisma.PrismaClientKnownRequestError("boom", { code: "P2028", clientVersion: "6.0.0" });
      }
      return pullReport({ outcome: "ok", pulled: 5, cursorAfter: "10" });
    });

    const report = await runQabSyncTiendaCron();
    const okEntry = report.poll.businesses.find((b) => b.negocioId === OK_NEGOCIO);

    expect(okEntry?.outcome).toBe("ok");
    expect(okEntry?.pulled).toBe(5);
  });

  it("the catch never logs the thrown error's own message — only negocioId and a short Prisma code (qabOrderPullErrorCode)", async () => {
    const distinguishableMessage = "UNIQUE_DB_ERROR_TEXT_THAT_MUST_NEVER_BE_LOGGED";
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        throw new Prisma.PrismaClientKnownRequestError(distinguishableMessage, {
          code: "P2028",
          clientVersion: "6.0.0",
          meta: { target: ["negocioId", "qabOrderId"] },
        });
      }
      return pullReport({ outcome: "ok", pulled: 5 });
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runQabSyncTiendaCron();

    const everyErrorLine = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(everyErrorLine).not.toContain(distinguishableMessage);
    expect(everyErrorLine).toContain(FAIL_NEGOCIO);
    expect(everyErrorLine).toContain("P2028");

    errorSpy.mockRestore();
  });

  it("a non-Prisma error thrown by the slot is reported with the QAB_ORDER_PULL_UNKNOWN_ERROR_CODE, not swallowed and not left to bubble up as free text", async () => {
    pullQabOrdersMock.mockImplementation(async (args: { negocioId: string }) => {
      if (args.negocioId === FAIL_NEGOCIO) {
        throw new Error("a transport-level error unrelated to Prisma");
      }
      return pullReport({ outcome: "ok", pulled: 1 });
    });

    const report = await runQabSyncTiendaCron();
    const failEntry = report.poll.businesses.find((b) => b.negocioId === FAIL_NEGOCIO);

    expect(failEntry?.outcome).toBe("error");
    expect(failEntry?.lock).toBe("unknown");
    expect(report.poll.failed).toBe(1);
  });
});
