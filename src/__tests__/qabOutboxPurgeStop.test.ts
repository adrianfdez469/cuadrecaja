import { describe, it, expect } from "vitest";
import {
  initialQabOutboxPurgeState,
  resolveQabOutboxPurgeStop,
  type IQabOutboxPurgeBatchState,
} from "@/lib/qab/outboxPurge";
import {
  QAB_OUTBOX_PURGE_BATCH_SIZE,
  QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
  QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
} from "@/constants/qab";

/**
 * F-019 — `initialQabOutboxPurgeState` and `resolveQabOutboxPurgeStop`
 * (contract § 4). Precedence is fixed and load-bearing when more than one
 * condition holds at once: drained > deadline > batch_cap. Every case below is
 * a literal table built in this file, NOT an `it.each` over an imported array
 * constant (E-019): the table itself always exists even while a symbol inside
 * it (e.g. QAB_OUTBOX_PURGE_BATCH_SIZE) may still be undefined, so a missing
 * constant fails only the specific cases that use it, not the whole file.
 */

describe("initialQabOutboxPurgeState", () => {
  it("should seed lastBatchDeleted with the batch size, batchesDone at 0, and elapsedMs at 0 with no argument", () => {
    expect(initialQabOutboxPurgeState()).toEqual({
      lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE,
      batchesDone: 0,
      elapsedMs: 0,
    });
  });

  it("should carry elapsedMs over from the previous phase when given one", () => {
    expect(initialQabOutboxPurgeState(12_345)).toEqual({
      lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE,
      batchesDone: 0,
      elapsedMs: 12_345,
    });
  });

  it("should not read as drained on its own: the seeded lastBatchDeleted equals the batch size, not less than it", () => {
    expect(resolveQabOutboxPurgeStop(initialQabOutboxPurgeState())).toBeNull();
  });
});

describe("resolveQabOutboxPurgeStop", () => {
  const state = (overrides: Partial<IQabOutboxPurgeBatchState>): IQabOutboxPurgeBatchState => ({
    lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE,
    batchesDone: 0,
    elapsedMs: 0,
    ...overrides,
  });

  const cases: Array<[string, IQabOutboxPurgeBatchState, string | null]> = [
    ["nothing crossed any threshold", state({}), null],
    [
      "lastBatchDeleted one below the batch size -> drained",
      state({ lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE - 1 }),
      "drained",
    ],
    [
      "lastBatchDeleted exactly at the batch size -> NOT drained",
      state({ lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE }),
      null,
    ],
    [
      "elapsedMs one below the deadline -> not yet",
      state({ elapsedMs: QAB_OUTBOX_PURGE_RUN_DEADLINE_MS - 1 }),
      null,
    ],
    [
      "elapsedMs exactly at the deadline -> deadline",
      state({ elapsedMs: QAB_OUTBOX_PURGE_RUN_DEADLINE_MS }),
      "deadline",
    ],
    [
      "batchesDone one below the cap -> not yet",
      state({ batchesDone: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN - 1 }),
      null,
    ],
    [
      "batchesDone exactly at the cap -> batch_cap",
      state({ batchesDone: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN }),
      "batch_cap",
    ],
    [
      "precedence: drained beats deadline when both hold",
      state({
        lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE - 1,
        elapsedMs: QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
      }),
      "drained",
    ],
    [
      "precedence: drained beats batch_cap when both hold",
      state({
        lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE - 1,
        batchesDone: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
      }),
      "drained",
    ],
    [
      "precedence: deadline beats batch_cap when the batch itself was full",
      state({
        elapsedMs: QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
        batchesDone: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
      }),
      "deadline",
    ],
    [
      "precedence: all three hold at once -> drained still wins",
      state({
        lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE - 1,
        elapsedMs: QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
        batchesDone: QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
      }),
      "drained",
    ],
  ];

  it.each(cases)("%s", (_label, input, expected) => {
    expect(resolveQabOutboxPurgeStop(input)).toBe(expected);
  });
});
