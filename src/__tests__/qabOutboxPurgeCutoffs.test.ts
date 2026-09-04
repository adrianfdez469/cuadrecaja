import { describe, it, expect } from "vitest";
import { resolveQabOutboxPurgeCutoffs } from "@/lib/qab/outboxPurge";

/**
 * F-019 — `resolveQabOutboxPurgeCutoffs` (contract § 4). Both cutoffs are pure
 * arithmetic over a single `now`: 30 days back for `processedBefore`, 90 for
 * `exhaustedBefore` (ADR 0039). Fixed-length days (86 400 000 ms each), not
 * calendar days, so the test does not need to cross a DST boundary to be
 * exact — the contract itself says as much ("not TTLs over calendar days").
 */

const MS_PER_DAY = 86_400_000;
const PROCESSED_TTL_DAYS = 30;
const EXHAUSTED_TTL_DAYS = 90;

describe("resolveQabOutboxPurgeCutoffs", () => {
  const now = new Date("2026-09-04T03:17:00.000Z");

  it("should compute processedBefore as now minus 30 days", () => {
    const { processedBefore } = resolveQabOutboxPurgeCutoffs(now);
    expect(processedBefore.getTime()).toBe(now.getTime() - PROCESSED_TTL_DAYS * MS_PER_DAY);
  });

  it("should compute exhaustedBefore as now minus 90 days", () => {
    const { exhaustedBefore } = resolveQabOutboxPurgeCutoffs(now);
    expect(exhaustedBefore.getTime()).toBe(now.getTime() - EXHAUSTED_TTL_DAYS * MS_PER_DAY);
  });

  it("should make exhaustedBefore exactly three times as far in the past as processedBefore", () => {
    const { processedBefore, exhaustedBefore } = resolveQabOutboxPurgeCutoffs(now);
    const processedAgeMs = now.getTime() - processedBefore.getTime();
    const exhaustedAgeMs = now.getTime() - exhaustedBefore.getTime();
    expect(exhaustedAgeMs).toBe(processedAgeMs * 3);
  });

  it("should derive both cutoffs from the SAME now instant on every call", () => {
    const fixedNow = new Date("2026-01-15T00:00:00.000Z");
    const first = resolveQabOutboxPurgeCutoffs(fixedNow);
    const second = resolveQabOutboxPurgeCutoffs(fixedNow);
    expect(first).toEqual(second);
  });

  it("should return Date instances, matching qabOutboxPurgeCutoffsSchema's z.date()", () => {
    const cutoffs = resolveQabOutboxPurgeCutoffs(now);
    expect(cutoffs.processedBefore).toBeInstanceOf(Date);
    expect(cutoffs.exhaustedBefore).toBeInstanceOf(Date);
  });

  it("should place exhaustedBefore strictly before processedBefore for any now", () => {
    const { processedBefore, exhaustedBefore } = resolveQabOutboxPurgeCutoffs(now);
    expect(exhaustedBefore.getTime()).toBeLessThan(processedBefore.getTime());
  });
});
