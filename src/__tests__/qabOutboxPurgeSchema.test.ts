import { describe, it, expect } from "vitest";
import { qabOutboxPurgeReportSchema } from "@/schemas/qabOutboxPurge";

/**
 * F-019 — `qabOutboxPurgeReportSchema` (contract § 2). Validates the shape the
 * route hands back in its 200 body: aggregate counts only, both cutoffs as
 * strings, no negocioId and no event id — there is no field for either.
 */

const validReport = {
  startedAt: "2026-09-04T03:17:00.000Z",
  durationMs: 812,
  deleted: 5001,
  exhausted: { cutoff: "2026-06-06T03:17:00.000Z", deleted: 1, batches: 1, stopReason: "drained" },
  processed: {
    cutoff: "2026-08-05T03:17:00.000Z",
    deleted: 5000,
    batches: 11,
    stopReason: "drained",
  },
};

describe("qabOutboxPurgeReportSchema", () => {
  it("should accept a well formed report", () => {
    expect(qabOutboxPurgeReportSchema.safeParse(validReport).success).toBe(true);
  });

  it("should reject a negative top-level deleted count", () => {
    expect(qabOutboxPurgeReportSchema.safeParse({ ...validReport, deleted: -1 }).success).toBe(
      false
    );
  });

  it("should reject a negative deleted count inside a phase", () => {
    expect(
      qabOutboxPurgeReportSchema.safeParse({
        ...validReport,
        exhausted: { ...validReport.exhausted, deleted: -1 },
      }).success
    ).toBe(false);
  });

  it("should reject a negative batches count inside a phase", () => {
    expect(
      qabOutboxPurgeReportSchema.safeParse({
        ...validReport,
        processed: { ...validReport.processed, batches: -1 },
      }).success
    ).toBe(false);
  });

  it("should reject a stopReason outside the closed vocabulary", () => {
    expect(
      qabOutboxPurgeReportSchema.safeParse({
        ...validReport,
        exhausted: { ...validReport.exhausted, stopReason: "timeout" },
      }).success
    ).toBe(false);
  });

  it("should reject a non-integer deleted count", () => {
    expect(qabOutboxPurgeReportSchema.safeParse({ ...validReport, deleted: 1.5 }).success).toBe(
      false
    );
  });

  it("should reject a report missing the processed phase entirely", () => {
    const { processed: _processed, ...withoutProcessed } = validReport;
    expect(qabOutboxPurgeReportSchema.safeParse(withoutProcessed).success).toBe(false);
  });
});
