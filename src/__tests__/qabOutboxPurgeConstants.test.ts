import { describe, it, expect } from "vitest";
import {
  QAB_OUTBOX_PROCESSED_TTL_DAYS,
  QAB_OUTBOX_EXHAUSTED_TTL_DAYS,
  QAB_OUTBOX_PURGE_BATCH_SIZE,
  QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
  QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
  QAB_OUTBOX_PURGE_PHASES,
  QAB_OUTBOX_PURGE_STOP_REASONS,
  QAB_OUTBOX_PURGABLE_INDEX_NAME,
  QAB_OUTBOX_PURGE_LOG,
  QAB_OUTBOX_PURGE_API_ERRORS,
} from "@/constants/qab";

/**
 * F-019 — the constants block of `src/constants/qab.ts` (contract § 1). Every
 * value here is fixed by the contract and load-bearing: a wrong TTL purges rows
 * an ADR says must survive (see qabOutboxPurgeRun.test.ts, row B of the ADR
 * 0039 table), a wrong batch size changes how many statements a run needs. Each
 * constant gets its own assertion instead of a generic "is defined" check.
 *
 * Kept in its own file (E-019): a not-yet-declared constant fails the whole
 * file at collection, and this file's only job is exactly that risk, isolated
 * away from every other domain's tests.
 */
describe("F-019 outbox purge constants", () => {
  it("should fix the processed TTL at 30 days (ADR 0039)", () => {
    expect(QAB_OUTBOX_PROCESSED_TTL_DAYS).toBe(30);
  });

  it("should fix the exhausted TTL at 90 days, three times the processed one (ADR 0039)", () => {
    expect(QAB_OUTBOX_EXHAUSTED_TTL_DAYS).toBe(90);
    expect(QAB_OUTBOX_EXHAUSTED_TTL_DAYS).toBe(QAB_OUTBOX_PROCESSED_TTL_DAYS * 3);
  });

  it("should fix the purge batch size at 500, same as the drain's claim batch", () => {
    expect(QAB_OUTBOX_PURGE_BATCH_SIZE).toBe(500);
  });

  it("should fix the batch cap at 40 statements per phase per run", () => {
    expect(QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN).toBe(40);
  });

  it("should fix the run deadline at 45 seconds, under the route's 60s maxDuration", () => {
    expect(QAB_OUTBOX_PURGE_RUN_DEADLINE_MS).toBe(45_000);
  });

  it("should run the exhausted phase before the processed phase", () => {
    expect([...QAB_OUTBOX_PURGE_PHASES]).toEqual(["exhausted", "processed"]);
  });

  it("should hold exactly the three stop reasons, in precedence order", () => {
    expect([...QAB_OUTBOX_PURGE_STOP_REASONS]).toEqual(["drained", "deadline", "batch_cap"]);
  });

  it("should name the purgable-phase index idx_outbox_purgable (ADR 0041)", () => {
    expect(QAB_OUTBOX_PURGABLE_INDEX_NAME).toBe("idx_outbox_purgable");
  });

  it("should prefix the run's log line with qab.outboxPurge", () => {
    expect(QAB_OUTBOX_PURGE_LOG).toBe("qab.outboxPurge");
  });

  it("should carry the single 500 error code of the cron endpoint", () => {
    expect(QAB_OUTBOX_PURGE_API_ERRORS.purgeFailed).toBe("QAB_OUTBOX_PURGE_FAILED");
  });
});
