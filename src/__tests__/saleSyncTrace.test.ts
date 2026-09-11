import { describe, expect, it } from "vitest";
import {
  hasSyncTrace,
  saleSyncTraceMinAttempts,
  saleSyncTraceReasons,
  type SaleSyncTrace,
} from "@/lib/venta/saleSyncTrace";
import {
  SALE_SYNC_ATTEMPTS_ARE_FAILURES,
  SALE_SYNC_TRACE_MIN_ATTEMPTS,
  SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS,
  SALE_SYNC_TRACE_REASONS,
  type ISaleSyncTraceReason,
} from "@/constants/venta";

/**
 * F-034 — contract § "Firmas públicas" > 4 (ADR 0113, amending ADR 0112).
 *
 * The threshold that decides whether a sale's syncAttempts evidences a retry
 * is NO LONGER a constant: it is `saleSyncTraceMinAttempts(sale)`, a pure
 * function of the row. `1` when the row DECLARES that its counter counts
 * FAILED attempts (`syncAttemptsAreFailures === true`); `2` when it does not
 * (absent, `undefined`, `null` or explicit `false` — all four collapse into
 * ONE "undeclared" branch, never three-state logic — E-036).
 *
 * THE PAIR THAT DECIDES WHETHER THIS SUITE IS WORTH ANYTHING (ADR 0113, spec
 * § "Lista de testabilidad"): `{wasOffline: false, syncAttempts: 1,
 * syncAttemptsAreFailures: true}` → has a trace, vs.
 * `{wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: null}` → does
 * not. Same `wasOffline`, same `syncAttempts`, opposite result, and the new
 * field is the ONLY thing that differs. An implementation that ignores the
 * new column entirely — e.g. one that kept the old `>= 2` constant — would
 * pass every test that only varies `wasOffline`/`syncAttempts`, so this pair
 * is asserted explicitly below, not only through the two threshold constants
 * (E-008).
 *
 * NOTE ON THE TWO RENAMED TESTS BELOW: F-032's suite had two tests whose name
 * justified `{wasOffline: false, syncAttempts: 1}` with "the literal value the
 * online POS path writes on a first-try sale". After F-034 that justification
 * is FALSE — criterion 1 makes the online path stop writing that literal. The
 * CASE itself is still required (it is exactly the ambiguous legacy row of
 * criterion 6: a row that never declared what its counter counts), so it is
 * kept, not deleted — only renamed to the reason that is true now.
 */

describe("SALE_SYNC_TRACE_MIN_ATTEMPTS", () => {
  it("is pinned to 2 — the threshold for a row that does NOT declare syncAttemptsAreFailures (ADR 0113 keeps the name and value of the ADR 0112 constant)", () => {
    expect(SALE_SYNC_TRACE_MIN_ATTEMPTS).toBe(2);
  });
});

describe("SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS", () => {
  it("is pinned to 1 — the threshold for a row that DOES declare syncAttemptsAreFailures === true (ADR 0113)", () => {
    expect(SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS).toBe(1);
  });

  it("is strictly lower than SALE_SYNC_TRACE_MIN_ATTEMPTS — a declared row must never need MORE evidence than an undeclared one", () => {
    expect(SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS).toBeLessThan(
      SALE_SYNC_TRACE_MIN_ATTEMPTS,
    );
  });
});

describe("SALE_SYNC_ATTEMPTS_ARE_FAILURES", () => {
  it("is true — what every write path in this repository declares about its own counter after F-034", () => {
    expect(SALE_SYNC_ATTEMPTS_ARE_FAILURES).toBe(true);
  });
});

describe("SALE_SYNC_TRACE_REASONS", () => {
  it("declares OFFLINE before RETRIES — this order IS the render order saleSyncTraceReasons must honour", () => {
    expect(SALE_SYNC_TRACE_REASONS).toEqual(["OFFLINE", "RETRIES"]);
  });
});

describe("saleSyncTraceMinAttempts", () => {
  it("returns SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS (1) when the row declares syncAttemptsAreFailures === true", () => {
    const sale: SaleSyncTrace = { syncAttemptsAreFailures: true };
    expect(saleSyncTraceMinAttempts(sale)).toBe(
      SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS,
    );
  });

  it.each<[boolean | null | undefined, string]>([
    [false, "explicit false"],
    [null, "explicit null (a Prisma row that has nothing declared)"],
    [undefined, "absent (a payload that omits the field)"],
  ])(
    "returns SALE_SYNC_TRACE_MIN_ATTEMPTS (2) when syncAttemptsAreFailures is %s — %s",
    (declared) => {
      const sale: SaleSyncTrace = { syncAttemptsAreFailures: declared };
      expect(saleSyncTraceMinAttempts(sale)).toBe(SALE_SYNC_TRACE_MIN_ATTEMPTS);
    },
  );

  it("reads ONLY '=== true' as affirmative: false and null must resolve to the SAME threshold as undeclared, not a threshold of their own", () => {
    const withFalse = saleSyncTraceMinAttempts({
      syncAttemptsAreFailures: false,
    });
    const withNull = saleSyncTraceMinAttempts({
      syncAttemptsAreFailures: null,
    });
    const withAbsent = saleSyncTraceMinAttempts({});
    expect(withFalse).toBe(SALE_SYNC_TRACE_MIN_ATTEMPTS);
    expect(withNull).toBe(SALE_SYNC_TRACE_MIN_ATTEMPTS);
    expect(withAbsent).toBe(SALE_SYNC_TRACE_MIN_ATTEMPTS);
  });

  it("does not depend on wasOffline or syncAttempts — it is a function of the declaration alone", () => {
    const declaredNoMatterWhat = saleSyncTraceMinAttempts({
      wasOffline: true,
      syncAttempts: 99,
      syncAttemptsAreFailures: true,
    });
    expect(declaredNoMatterWhat).toBe(SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS);
  });
});

describe("saleSyncTraceReasons — the pair that decides whether this suite is worth anything (ADR 0113)", () => {
  it('returns ["RETRIES"] for {wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: true} — a declared row where one stored unit IS one failed attempt (criterion 4: a NEW sale with exactly one real retry)', () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: true,
    };
    expect(saleSyncTraceReasons(sale)).toEqual(["RETRIES"]);
  });

  it("returns [] for {wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: null} — an UNDECLARED row with the exact same wasOffline and syncAttempts as the fixture above; syncAttemptsAreFailures is the ONLY field that differs, and it must be the only reason the results differ (criterion 6: an OLD ambiguous row)", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: null,
    };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });
});

describe("hasSyncTrace — same pair as above, boolean form", () => {
  it("is true for {wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: true}", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: true,
    };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false for {wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: null} — same wasOffline/syncAttempts as the fixture above, opposite result", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: null,
    };
    expect(hasSyncTrace(sale)).toBe(false);
  });
});

describe("saleSyncTraceReasons — threshold boundaries, 0/1/2, against every form the declaration can take", () => {
  it.each<[boolean | null | undefined, number, ISaleSyncTraceReason[]]>([
    // Declared branch (syncAttemptsAreFailures === true): threshold is 1.
    [true, 0, []],
    [true, 1, ["RETRIES"]],
    [true, 2, ["RETRIES"]],
    // Undeclared branch, explicit false: threshold is 2, same as null/absent.
    [false, 0, []],
    [false, 1, []],
    [false, 2, ["RETRIES"]],
    // Undeclared branch, explicit null (a Prisma row with nothing declared).
    [null, 0, []],
    [null, 1, []],
    [null, 2, ["RETRIES"]],
    // Undeclared branch, field absent altogether (a payload that omits it).
    [undefined, 0, []],
    [undefined, 1, []],
    [undefined, 2, ["RETRIES"]],
  ])(
    "wasOffline false, syncAttemptsAreFailures=%s, syncAttempts=%i -> %j",
    (declared, attempts, expected) => {
      const sale: SaleSyncTrace = {
        wasOffline: false,
        syncAttempts: attempts,
        syncAttemptsAreFailures: declared,
      };
      expect(saleSyncTraceReasons(sale)).toEqual(expected);
    },
  );
});

describe("saleSyncTraceReasons — the four inhabitants of 'undeclared' collapse into ONE branch (E-036)", () => {
  it("absent, undefined, null and explicit false all give the SAME result for the same (wasOffline, syncAttempts) pair — no three-state logic anywhere", () => {
    const absent: SaleSyncTrace = { wasOffline: false, syncAttempts: 1 };
    const explicitUndefined: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: undefined,
    };
    const explicitNull: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: null,
    };
    const explicitFalse: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 1,
      syncAttemptsAreFailures: false,
    };

    for (const sale of [
      absent,
      explicitUndefined,
      explicitNull,
      explicitFalse,
    ]) {
      expect(saleSyncTraceReasons(sale)).toEqual([]);
    }
  });
});

describe("saleSyncTraceReasons — the legacy ambiguous row (renamed from F-032's suite, ADR 0113)", () => {
  it("returns empty for wasOffline: false, syncAttempts: 1 with syncAttemptsAreFailures ABSENT — the row this feature can never resolve: after F-034 no producer in this repo writes this shape on purpose, but a row that already exists (or a stale bundle that omits the field) must keep classifying as NO trace, forever (criterion 6)", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 1 };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns only RETRIES once an UNDECLARED row's syncAttempts reaches SALE_SYNC_TRACE_MIN_ATTEMPTS (2), with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS,
    };
    expect(saleSyncTraceReasons(sale)).toEqual(["RETRIES"]);
  });

  it("returns empty one attempt below the UNDECLARED threshold, with wasOffline false — the exact boundary", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS - 1,
    };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });
});

describe("saleSyncTraceReasons — ordinary sales never trigger, declared or not", () => {
  it("returns empty for an ordinary sale: wasOffline false, syncAttempts 0, no declaration", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 0 };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns empty for an ordinary sale that DOES declare syncAttemptsAreFailures: true — a declared 0 still means zero failures", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: 0,
      syncAttemptsAreFailures: true,
    };
    expect(saleSyncTraceReasons(sale)).toEqual([]);
  });

  it("returns empty when both wasOffline and syncAttempts are absent, with no declaration either", () => {
    expect(saleSyncTraceReasons({})).toEqual([]);
  });

  it("returns empty when wasOffline is explicitly false and syncAttempts is absent, declared true", () => {
    expect(
      saleSyncTraceReasons({
        wasOffline: false,
        syncAttemptsAreFailures: true,
      }),
    ).toEqual([]);
  });
});

describe("saleSyncTraceReasons — wasOffline: true always yields OFFLINE, whatever syncAttempts and syncAttemptsAreFailures are", () => {
  it.each<[number, boolean | null | undefined]>([
    [0, undefined],
    [0, true],
    [0, false],
    [0, null],
    [1, true],
    [1, null],
    [5, true],
    [5, null],
  ])(
    "wasOffline true, syncAttempts=%i, syncAttemptsAreFailures=%s -> reasons include OFFLINE",
    (attempts, declared) => {
      const sale: SaleSyncTrace = {
        wasOffline: true,
        syncAttempts: attempts,
        syncAttemptsAreFailures: declared,
      };
      expect(saleSyncTraceReasons(sale)).toContain("OFFLINE");
      expect(hasSyncTrace(sale)).toBe(true);
    },
  );

  it("returns BOTH reasons, in order, when offline and past ITS OWN threshold on a DECLARED row (1 is enough)", () => {
    const sale: SaleSyncTrace = {
      wasOffline: true,
      syncAttempts: 1,
      syncAttemptsAreFailures: true,
    };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE", "RETRIES"]);
  });

  it("returns only OFFLINE, not RETRIES, when offline and past a DECLARED sale's threshold is NOT met (0 attempts)", () => {
    const sale: SaleSyncTrace = {
      wasOffline: true,
      syncAttempts: 0,
      syncAttemptsAreFailures: true,
    };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE"]);
  });

  it("returns BOTH reasons, in the declared order, when offline and past the UNDECLARED threshold (2) — OFFLINE before RETRIES, never the reverse", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 3 };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE", "RETRIES"]);
  });

  it("returns only OFFLINE, not RETRIES, when offline but an UNDECLARED row's syncAttempts stays below 2", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 1 };
    expect(saleSyncTraceReasons(sale)).toEqual(["OFFLINE"]);
  });
});

describe("saleSyncTraceReasons — order and shape invariants across every reachable combination", () => {
  it("the result is always a SUBSEQUENCE of SALE_SYNC_TRACE_REASONS — same relative order, no reordering, no duplicates — with syncAttemptsAreFailures varied too", () => {
    const fixtures: SaleSyncTrace[] = [
      { wasOffline: true, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 1 },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: true },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: null },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: false },
      { wasOffline: false, syncAttempts: 2 },
      { wasOffline: false, syncAttempts: 2, syncAttemptsAreFailures: true },
      { wasOffline: true, syncAttempts: 3 },
      { wasOffline: true, syncAttempts: 1, syncAttemptsAreFailures: true },
      {},
      { wasOffline: false },
      { syncAttempts: 5 },
      { syncAttempts: 5, syncAttemptsAreFailures: true },
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
  it("is true when wasOffline is true, regardless of syncAttempts and syncAttemptsAreFailures", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 0 };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false for an ordinary sale: wasOffline false, syncAttempts 0, no declaration", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 0 };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is false for wasOffline: false, syncAttempts: 1 with syncAttemptsAreFailures ABSENT — the legacy ambiguous row (criterion 6); a bare `syncAttempts > 0` gate would wrongly return true here", () => {
    const sale: SaleSyncTrace = { wasOffline: false, syncAttempts: 1 };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is true from SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS (1) upwards on a DECLARED row, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS,
      syncAttemptsAreFailures: true,
    };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false one attempt below SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS on a DECLARED row, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS - 1,
      syncAttemptsAreFailures: true,
    };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is true from SALE_SYNC_TRACE_MIN_ATTEMPTS (2) upwards on an UNDECLARED row, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS,
    };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false one attempt below SALE_SYNC_TRACE_MIN_ATTEMPTS on an UNDECLARED row, with wasOffline false", () => {
    const sale: SaleSyncTrace = {
      wasOffline: false,
      syncAttempts: SALE_SYNC_TRACE_MIN_ATTEMPTS - 1,
    };
    expect(hasSyncTrace(sale)).toBe(false);
  });

  it("is true when both wasOffline is true AND syncAttempts is past the UNDECLARED threshold", () => {
    const sale: SaleSyncTrace = { wasOffline: true, syncAttempts: 3 };
    expect(hasSyncTrace(sale)).toBe(true);
  });

  it("is false when both fields are absent", () => {
    expect(hasSyncTrace({})).toBe(false);
  });

  it("invariant: hasSyncTrace(sale) === (saleSyncTraceReasons(sale).length > 0) — structural since hasSyncTrace derives from the selector, still a regression guard if the two are ever split apart, now exercised WITH syncAttemptsAreFailures in play (criterion 8)", () => {
    const fixtures: SaleSyncTrace[] = [
      { wasOffline: true, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 0 },
      { wasOffline: false, syncAttempts: 1 },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: true },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: null },
      { wasOffline: false, syncAttempts: 1, syncAttemptsAreFailures: false },
      { wasOffline: false, syncAttempts: 2 },
      { wasOffline: true, syncAttempts: 3 },
      { wasOffline: true, syncAttempts: 1, syncAttemptsAreFailures: true },
      {},
      { wasOffline: false },
      { syncAttempts: 5 },
      { syncAttempts: 5, syncAttemptsAreFailures: true },
      { wasOffline: true },
    ];

    for (const sale of fixtures) {
      expect(hasSyncTrace(sale)).toBe(saleSyncTraceReasons(sale).length > 0);
    }
  });
});
