import { describe, expect, it } from "vitest";
import {
  hasSyncTrace,
  saleSyncTraceReasons,
  type SaleSyncTrace,
} from "@/lib/venta/saleSyncTrace";
import {
  SALE_SYNC_TRACE_MIN_ATTEMPTS,
  SALE_SYNC_TRACE_REASONS,
  type ISaleSyncTraceReason,
} from "@/constants/venta";

/**
 * F-032 — contract § "Firmas públicas" > 2 (ADR 0112), plus the reason
 * selector `arch-guardian` closed on top of `.agents/designs/F-032.md`
 * § "E-035": `saleSyncTraceReasons` is now the PRIMARY symbol and
 * `hasSyncTrace` is DERIVED from it (`saleSyncTraceReasons(sale).length > 0`).
 *
 * The single case that separates a correct threshold from a broken one is
 * `wasOffline: false, syncAttempts: 1`: it is the literal value the online
 * POS path writes on a sale that synced on its first try
 * (src/app/pos/page.tsx). A fixture that only tries `syncAttempts: 0` would
 * let a `> 0` gate through and the defect would only show up in production,
 * on almost every row (E-008) — so it is asserted explicitly below, not only
 * through the SALE_SYNC_TRACE_MIN_ATTEMPTS constant.
 */

describe("SALE_SYNC_TRACE_MIN_ATTEMPTS", () => {
  it("is pinned to 2 — the ADR 0112 threshold, repeated here so a silent change is caught", () => {
    expect(SALE_SYNC_TRACE_MIN_ATTEMPTS).toBe(2);
  });
});

describe("SALE_SYNC_TRACE_REASONS", () => {
  it("declares OFFLINE before RETRIES — this order IS the render order saleSyncTraceReasons must honour", () => {
    expect(SALE_SYNC_TRACE_REASONS).toEqual(["OFFLINE", "RETRIES"]);
  });
});

describe("saleSyncTraceReasons", () => {
  it("returns only OFFLINE for an offline sale with no retries", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 0 };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE"]);
  });

  it("returns empty for an ordinary sale: wasOffline false, syncAttempts 0", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 0 };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns empty for wasOffline: false, syncAttempts: 1 — the literal value the online POS path writes on a first-try sale; the imperative case that separates a correct threshold from a broken one", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 1 };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns only RETRIES once syncAttempts reaches SALE_SYNC_TRACE_MIN_ATTEMPTS (2), with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS,
    };
    expect(saleSyncTraceReasons(sale)).toEqual(["RETRIES"]);
  });

  it("returns empty one attempt below the threshold, with wasOffline false — the exact boundary", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS - 1,
    };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns BOTH reasons when a sale is offline AND past the retries threshold, in the declared order — OFFLINE before RETRIES, never the reverse", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 3 };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE", "RETRIES"]);
  });

  it("returns empty when both fields are absent", () => {
    expect(saleSyncTraceReasons({})).toEqual([]);
  });

  it("returns empty when wasOffline is explicitly false and syncAttempts is absent", () => {
    expect(saleSyncTraceReasons({ wasOffline: false })).toEqual([]);
  });

  it("the result is always a SUBSEQUENCE of SALE_SYNC_TRACE_REASONS — same relative order, no reordering and no duplicates — across every reachable combination", () => {
    const fixtures: SaleSyncTrace[] = [
      { wasOffline: true, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 1 },
      { wasOffline: false, syncAttempts: 2 },
      { wasOffline: true, syncAttempts: 3 },
      { wasOffline: true, syncAttempts: 5 },
      {},
      { wasOffline: false },
      { syncAttempts: 5 },
    ];

    for (const sale of fixtures) {
      const reasons = saleSyncTraceReasons(sale);
      const expectedSubsequence: ISaleSyncTraceReason[] =
        SALE_SYNC_TRACE_REASONS.filter((reason) => reasons.includes(reason));

      expect(reasons).toEqual(expectedSubsequence);
      expect(new Set(reasons).size).toBe(reasons.length); // no duplicates
    }
  });
});

describe("hasSyncTrace", () => {
  it("is true when wasOffline is true, regardless of syncAttempts", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 0 };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false for an ordinary sale: wasOffline false, syncAttempts 0", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 0 };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is false for wasOffline: false, syncAttempts: 1 — the literal value the online POS path writes on a first-try sale (ADR 0112); a `syncAttempts > 0` gate would wrongly return true here", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 1 };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is true from SALE_SYNC_TRACE_MIN_ATTEMPTS (2) upwards, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS,
    };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false one attempt below the threshold, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS - 1,
    };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is true when both wasOffline is true AND syncAttempts is past the threshold", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 3 };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false when both fields are absent", () => {
    expect(hasSyncTrace({})).toBe(false);
  });

  it("invariant: hasSyncTrace(sale) === (saleSyncTraceReasons(sale).length > 0) — now a structural property since hasSyncTrace derives from the selector, but still a regression guard if the two are ever split apart again", () => {
    const fixtures: SaleSyncTrace[] = [
      { wasOffline: true, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 1 },
      { wasOffline: false, syncAttempts: 2 },
      { wasOffline: true, syncAttempts: 3 },
      {},
      { wasOffline: false },
      { syncAttempts: 5 },
      { wasOffline: true },
    ];

    for (const sale of fixtures) {
      expect(hasSyncTrace(sale)).toBe(saleSyncTraceReasons(sale).length > 0);
    }
  });
});
