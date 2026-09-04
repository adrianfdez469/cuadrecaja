import { describe, it, expect, vi, afterEach } from "vitest";
import { logQabOutboxPurgeRun } from "@/lib/qab/qabOutboxLog";
import type { IQabOutboxPurgeReport } from "@/schemas/qabOutboxPurge";
import { QAB_OUTBOX_PURGE_LOG } from "@/constants/qab";

/**
 * F-019 — `logQabOutboxPurgeRun` (contract § 6). One aggregated line per run,
 * counts and closed codes only: no negocioId, no event id, no ultimoError —
 * the whole run purges across every business at once, and the log must not
 * become the cross-tenant surface the report itself deliberately isn't.
 *
 * Deliberately a SEPARATE file from `qabOutboxLog.test.ts` (E-019): that file
 * already has green tests for `logQabPermanentFailure` (F-005) and
 * `logQabSlugLearnOutcome` (F-020). If `logQabOutboxPurgeRun` does not exist
 * yet, only this file goes red — theirs must not.
 */

const report: IQabOutboxPurgeReport = {
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

describe("logQabOutboxPurgeRun", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write exactly one line via console.info in the documented format", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logQabOutboxPurgeRun(report);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      `${QAB_OUTBOX_PURGE_LOG} deleted=5001 exhausted=1 processed=5000 batches=12 exhaustedStop=drained processedStop=drained durationMs=812`
    );
  });

  it("should sum batches across both phases, not report either phase's count alone", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logQabOutboxPurgeRun(report);

    const [line] = infoSpy.mock.calls[0] as [string];
    expect(line).toContain("batches=12");
    expect(line).not.toContain("batches=11");
  });

  it("should never call console.log, console.warn or console.error for a normal run", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabOutboxPurgeRun(report);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(logQabOutboxPurgeRun(report)).toBeUndefined();
  });

  it("should not leak a negocioId or an event id smuggled onto the report", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const smuggled = {
      ...report,
      negocioId: "negocio-1",
      id: "424242",
      ultimoError: "QAB_TOKEN_MISSING",
    } as unknown as IQabOutboxPurgeReport;

    logQabOutboxPurgeRun(smuggled);

    const [line] = infoSpy.mock.calls[0] as [string];
    expect(line).not.toContain("negocioId");
    expect(line).not.toContain("424242");
    expect(line).not.toContain("QAB_TOKEN_MISSING");
    expect(line).not.toMatch(/\bid=/);
  });
});
