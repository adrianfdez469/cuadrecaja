import { describe, it, expect } from "vitest";
import { emptyQabReconciliationReport } from "@/lib/qab/qabReconciliationCron";

/**
 * F-008 — the ONE pure symbol of `src/lib/qab/qabReconciliationCron.ts` (contract § 4.5):
 * everything else there orchestrates Prisma and HTTP and is `qa`'s job, executed for
 * real, never the suite's (§ 9, "Exige ejecución").
 */

describe("emptyQabReconciliationReport", () => {
  it("gives every counter at zero and skipped: null", () => {
    expect(emptyQabReconciliationReport()).toEqual({
      startedAt: expect.any(String),
      durationMs: 0,
      skipped: null,
      businesses: 0,
      candidates: 0,
      attempted: 0,
      matched: 0,
      diverged: 0,
      unknownStores: 0,
      errors: 0,
      tooLarge: 0,
      skippedDeadline: 0,
      clearedRows: 0,
      forcedMissing: 0,
      stores: [],
      alerts: { businesses: 0, stalled: 0, diverged: 0, created: 0, updated: 0, deleted: 0 },
    });
  });
});
