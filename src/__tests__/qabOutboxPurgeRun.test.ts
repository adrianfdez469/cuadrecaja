import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeQabOutboxEvents, type IQabOutboxPurgeDeps } from "@/lib/qab/outboxPurge";
import type { IQabOutboxPurgePhase } from "@/schemas/qabOutboxPurge";
import {
  QAB_OUTBOX_PURGE_BATCH_SIZE,
  QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
  QAB_OUTBOX_PROCESSED_TTL_DAYS,
  QAB_OUTBOX_EXHAUSTED_TTL_DAYS,
} from "@/constants/qab";

/**
 * F-019 — `purgeQabOutboxEvents` (contract § 4), exercised with `deleteBatch`
 * and `now` injected, no database. Kept in its own file (E-019): everything it
 * imports is brand new for this feature, so a not-yet-resolved module can only
 * take THIS file down, never the green tests of unrelated domains.
 *
 * `logQabOutboxPurgeRun` is mocked wholesale (not spied on `console`) because
 * the contract says `purgeQabOutboxEvents` calls it directly with the report
 * before resolving — an internal collaborator worth pinning down, not the unit
 * under test itself.
 */

vi.mock("@/lib/qab/qabOutboxLog", () => ({
  logQabOutboxPurgeRun: vi.fn(),
}));

// eslint-disable-next-line import/order -- must follow the hoisted vi.mock above
import { logQabOutboxPurgeRun } from "@/lib/qab/qabOutboxLog";

const MS_PER_DAY = 86_400_000;
const START_MS = Date.parse("2026-09-04T03:17:00.000Z");

type DeleteCall = { phase: IQabOutboxPurgePhase; cutoff: Date; limit: number };

/** A deterministic clock: each call advances by `stepMs`, starting at START_MS. */
function makeClock(stepMs: number) {
  let calls = 0;
  return vi.fn(() => new Date(START_MS + stepMs * calls++));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("purgeQabOutboxEvents", () => {
  it("should run the exhausted phase before the processed phase, each against its own cutoff and batch size", async () => {
    const now = makeClock(1_000);
    const calls: DeleteCall[] = [];
    const exhaustedCounts = [500, 500, 200]; // last one < batch size: drains after 3
    const processedCounts = [500, 300]; // last one < batch size: drains after 2
    let exhaustedIdx = 0;
    let processedIdx = 0;

    const deleteBatch = vi.fn(async (args: DeleteCall) => {
      calls.push(args);
      return args.phase === "exhausted"
        ? exhaustedCounts[exhaustedIdx++]
        : processedCounts[processedIdx++];
    });
    const deps: IQabOutboxPurgeDeps = { deleteBatch, now };

    const report = await purgeQabOutboxEvents(deps);

    expect(calls).toHaveLength(5);
    const phases = calls.map((c) => c.phase);
    expect(phases.lastIndexOf("exhausted")).toBeLessThan(phases.indexOf("processed"));

    const expectedExhaustedBefore = new Date(START_MS - QAB_OUTBOX_EXHAUSTED_TTL_DAYS * MS_PER_DAY);
    const expectedProcessedBefore = new Date(START_MS - QAB_OUTBOX_PROCESSED_TTL_DAYS * MS_PER_DAY);

    for (const call of calls) {
      expect(call.limit).toBe(QAB_OUTBOX_PURGE_BATCH_SIZE);
      const expectedCutoff =
        call.phase === "exhausted" ? expectedExhaustedBefore : expectedProcessedBefore;
      expect(call.cutoff.getTime()).toBe(expectedCutoff.getTime());
    }

    expect(report.exhausted).toMatchObject({ deleted: 1200, batches: 3, stopReason: "drained" });
    expect(report.processed).toMatchObject({ deleted: 800, batches: 2, stopReason: "drained" });
    expect(report.deleted).toBe(2000);
    expect(report.exhausted.cutoff).toBe(expectedExhaustedBefore.toISOString());
    expect(report.processed.cutoff).toBe(expectedProcessedBefore.toISOString());
  });

  it("should call now() exactly once at the start and once after each deleteBatch resolves, and derive durationMs from those calls", async () => {
    const now = makeClock(1_000);
    let exhaustedIdx = 0;
    let processedIdx = 0;
    const exhaustedCounts = [500, 200]; // 2 statements
    const processedCounts = [500, 500, 100]; // 3 statements

    const deleteBatch = vi.fn(async (args: DeleteCall) =>
      args.phase === "exhausted" ? exhaustedCounts[exhaustedIdx++] : processedCounts[processedIdx++]
    );

    const report = await purgeQabOutboxEvents({ deleteBatch, now });

    const totalStatements = exhaustedCounts.length + processedCounts.length;
    expect(now).toHaveBeenCalledTimes(1 + totalStatements);
    expect(report.startedAt).toBe(new Date(START_MS).toISOString());
    // durationMs = the LAST now() value minus the FIRST (contract § 4).
    expect(report.durationMs).toBe(totalStatements * 1_000);
  });

  it("should share the run deadline across phases: time already spent in exhausted stops processed immediately, with zero statements", async () => {
    const now = makeClock(46_000); // one statement alone exceeds the whole run's budget
    const deleteBatch = vi.fn(async (args: DeleteCall) => {
      if (args.phase === "exhausted") return QAB_OUTBOX_PURGE_BATCH_SIZE; // full: not drained on its own
      throw new Error("processed must not run any statement: the run's deadline was already spent");
    });

    const report = await purgeQabOutboxEvents({ deleteBatch, now });

    expect(report.exhausted).toMatchObject({
      deleted: QAB_OUTBOX_PURGE_BATCH_SIZE,
      batches: 1,
      stopReason: "deadline",
    });
    expect(report.processed).toMatchObject({ deleted: 0, batches: 0, stopReason: "deadline" });
    expect(deleteBatch).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(2); // 1 start + 1 after the single exhausted statement
  });

  it("should stop a phase at its own batch cap when every batch stays full and the deadline is never reached", async () => {
    const now = makeClock(1); // 80 statements * 1ms is nowhere near the 45s deadline
    const callsPerPhase: Record<IQabOutboxPurgePhase, number> = { exhausted: 0, processed: 0 };
    const deleteBatch = vi.fn(async (args: DeleteCall) => {
      callsPerPhase[args.phase]++;
      return QAB_OUTBOX_PURGE_BATCH_SIZE; // always a full batch: "drained" never triggers
    });

    const report = await purgeQabOutboxEvents({ deleteBatch, now });

    expect(report.exhausted).toMatchObject({
      batches: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
      deleted: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN * QAB_OUTBOX_PURGE_BATCH_SIZE,
      stopReason: "batch_cap",
    });
    expect(report.processed).toMatchObject({
      batches: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
      deleted: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN * QAB_OUTBOX_PURGE_BATCH_SIZE,
      stopReason: "batch_cap",
    });
    // Each phase caps independently: the cap is per-phase, not shared like the deadline.
    expect(callsPerPhase.exhausted).toBe(QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN);
    expect(callsPerPhase.processed).toBe(QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN);
  });

  it("should propagate a rejected deleteBatch instead of returning a report full of zeros", async () => {
    const now = makeClock(1_000);
    const deleteBatch = vi.fn(async () => {
      throw new Error("connection pool exhausted");
    });

    await expect(purgeQabOutboxEvents({ deleteBatch, now })).rejects.toThrow(
      "connection pool exhausted"
    );
    expect(logQabOutboxPurgeRun).not.toHaveBeenCalled();
  });

  it("should propagate a rejection from a LATER statement, not just the first", async () => {
    const now = makeClock(1_000);
    let call = 0;
    const deleteBatch = vi.fn(async () => {
      call++;
      if (call === 2) throw new Error("second statement failed");
      return QAB_OUTBOX_PURGE_BATCH_SIZE;
    });

    await expect(purgeQabOutboxEvents({ deleteBatch, now })).rejects.toThrow(
      "second statement failed"
    );
  });

  it("should call logQabOutboxPurgeRun exactly once with the exact report it returns, on success", async () => {
    const now = makeClock(1_000);
    const deleteBatch = vi.fn(async () => 10); // well under the batch size: drains both phases in one statement each

    const report = await purgeQabOutboxEvents({ deleteBatch, now });

    expect(logQabOutboxPurgeRun).toHaveBeenCalledTimes(1);
    expect(logQabOutboxPurgeRun).toHaveBeenCalledWith(report);
  });
});
