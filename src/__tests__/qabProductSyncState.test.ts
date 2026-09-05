import { describe, it, expect } from "vitest";
import { mergeQabProductSyncState } from "@/lib/qab/qabProductSyncState";
import type { IQabStoreSyncState } from "@/schemas/tiendaOnline";

/**
 * F-006 — `mergeQabProductSyncState` (`src/lib/qab/qabProductSyncState.ts`,
 * contract §5.4). Precedence, worst first: BLOCKED > FAILED > PENDING > SYNCED.
 * `attempts` is the MAXIMUM across states, `since` the EARLIEST non-null. An
 * empty array is SYNCED.
 */

function state(overrides: Partial<IQabStoreSyncState> = {}): IQabStoreSyncState {
  return { state: "SYNCED", code: null, attempts: 0, since: null, ...overrides };
}

describe("mergeQabProductSyncState — empty input", () => {
  it("should return SYNCED with zero attempts and null since for an empty array", () => {
    expect(mergeQabProductSyncState([])).toEqual({
      state: "SYNCED",
      code: null,
      attempts: 0,
      since: null,
    });
  });
});

describe("mergeQabProductSyncState — precedence, worst first", () => {
  it("BLOCKED beats FAILED, PENDING and SYNCED", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "SYNCED" }),
      state({ state: "PENDING" }),
      state({ state: "FAILED" }),
      state({ state: "BLOCKED" }),
    ]);

    expect(merged.state).toBe("BLOCKED");
  });

  it("FAILED beats PENDING and SYNCED, when there is no BLOCKED", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "SYNCED" }),
      state({ state: "PENDING" }),
      state({ state: "FAILED" }),
    ]);

    expect(merged.state).toBe("FAILED");
  });

  it("PENDING beats SYNCED, when nothing is worse", () => {
    const merged = mergeQabProductSyncState([state({ state: "SYNCED" }), state({ state: "PENDING" })]);

    expect(merged.state).toBe("PENDING");
  });

  it("should report SYNCED only when EVERY row is SYNCED", () => {
    const merged = mergeQabProductSyncState([state({ state: "SYNCED" }), state({ state: "SYNCED" })]);

    expect(merged.state).toBe("SYNCED");
  });

  it("order of the input array must not matter — the worst state wins regardless of position", () => {
    const worstFirst = mergeQabProductSyncState([
      state({ state: "BLOCKED" }),
      state({ state: "SYNCED" }),
    ]);
    const worstLast = mergeQabProductSyncState([
      state({ state: "SYNCED" }),
      state({ state: "BLOCKED" }),
    ]);

    expect(worstFirst.state).toBe("BLOCKED");
    expect(worstLast.state).toBe("BLOCKED");
  });
});

describe("mergeQabProductSyncState — attempts is the MAXIMUM across all rows", () => {
  it("should take the highest attempts count, not the winning row's own count in isolation, not the first, not the last", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "FAILED", attempts: 2 }),
      state({ state: "FAILED", attempts: 5 }),
      state({ state: "FAILED", attempts: 1 }),
    ]);

    expect(merged.attempts).toBe(5);
  });

  it("discriminating case: the row with the WORST state does not have the highest attempts — attempts must still be the max across ALL rows, not just the winning one", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "BLOCKED", attempts: 6 }),
      state({ state: "PENDING", attempts: 9 }),
    ]);

    // If the implementation only looked at the winning (BLOCKED) row's attempts, this would be 6.
    expect(merged.attempts).toBe(9);
  });
});

describe("mergeQabProductSyncState — since is the EARLIEST non-null", () => {
  it("should take the earliest `since` among the rows", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "PENDING", since: "2026-09-04T12:00:00.000Z" }),
      state({ state: "PENDING", since: "2026-09-04T08:00:00.000Z" }),
      state({ state: "PENDING", since: "2026-09-04T10:00:00.000Z" }),
    ]);

    expect(merged.since).toBe("2026-09-04T08:00:00.000Z");
  });

  it("should ignore a null since when at least one row has a real one", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "SYNCED", since: null }),
      state({ state: "PENDING", since: "2026-09-04T08:00:00.000Z" }),
    ]);

    expect(merged.since).toBe("2026-09-04T08:00:00.000Z");
  });

  it("should be null only when every row's since is null", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "SYNCED", since: null }),
      state({ state: "SYNCED", since: null }),
    ]);

    expect(merged.since).toBeNull();
  });
});

describe("mergeQabProductSyncState — code is the one of the winning state", () => {
  it("should carry the code of the state that won the precedence, not of a losing one", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "PENDING", code: null }),
      state({ state: "FAILED", code: "TRANSPORT" }),
    ]);

    expect(merged.code).toBe("TRANSPORT");
  });

  it("discriminating case: two FAILED rows with different codes — the merge cannot silently prefer one over the other by array order alone without being deliberate about it, but it must be consistent regardless of order", () => {
    const first = mergeQabProductSyncState([
      state({ state: "FAILED", code: "TRANSPORT", attempts: 1 }),
      state({ state: "FAILED", code: "UNKNOWN", attempts: 3 }),
    ]);
    const second = mergeQabProductSyncState([
      state({ state: "FAILED", code: "UNKNOWN", attempts: 3 }),
      state({ state: "FAILED", code: "TRANSPORT", attempts: 1 }),
    ]);

    // Both permutations must agree on attempts (the max) regardless of code tie-break policy.
    expect(first.attempts).toBe(3);
    expect(second.attempts).toBe(3);
  });

  it("pinned tie-break: with two rows of the SAME severity, the FIRST row's code in array order wins — reversing the array must flip which code wins", () => {
    // Not spelled out in the interface contract's prose ("code, the one of the state that
    // won"), but this is the actual, deliberate tie-break the implementation uses (a `reduce`
    // that only replaces the current winner on a STRICTLY greater severity) — pinned here so a
    // future refactor cannot silently swap it for "last wins" or "arbitrary" without a test
    // noticing.
    const transportFirst = mergeQabProductSyncState([
      state({ state: "FAILED", code: "TRANSPORT", attempts: 1 }),
      state({ state: "FAILED", code: "UNKNOWN", attempts: 1 }),
    ]);
    const unknownFirst = mergeQabProductSyncState([
      state({ state: "FAILED", code: "UNKNOWN", attempts: 1 }),
      state({ state: "FAILED", code: "TRANSPORT", attempts: 1 }),
    ]);

    expect(transportFirst.code).toBe("TRANSPORT");
    expect(unknownFirst.code).toBe("UNKNOWN");
  });

  it("discriminating case: attempts is the MAXIMUM across ALL rows of a same-severity tie, not just the winning (first) row's own count", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "FAILED", code: "TRANSPORT", attempts: 1 }),
      state({ state: "FAILED", code: "UNKNOWN", attempts: 9 }),
    ]);

    // If the implementation only read the winning row's attempts, this would be 1.
    expect(merged.code).toBe("TRANSPORT");
    expect(merged.attempts).toBe(9);
  });

  it("discriminating case: since is the MINIMUM non-null across ALL rows of a same-severity tie, not just the winning (first) row's own since", () => {
    const merged = mergeQabProductSyncState([
      state({ state: "FAILED", code: "TRANSPORT", since: "2026-09-04T12:00:00.000Z" }),
      state({ state: "FAILED", code: "UNKNOWN", since: "2026-09-04T06:00:00.000Z" }),
    ]);

    // If the implementation only read the winning row's since, this would be the noon value.
    expect(merged.code).toBe("TRANSPORT");
    expect(merged.since).toBe("2026-09-04T06:00:00.000Z");
  });
});
