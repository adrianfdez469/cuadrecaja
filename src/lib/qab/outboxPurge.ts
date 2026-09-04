import {
  QAB_OUTBOX_EXHAUSTED_TTL_DAYS,
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_OUTBOX_PROCESSED_TTL_DAYS,
  QAB_OUTBOX_PURGE_BATCH_SIZE,
  QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN,
  QAB_OUTBOX_PURGE_PHASES,
  QAB_OUTBOX_PURGE_RUN_DEADLINE_MS,
} from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import { logQabOutboxPurgeRun } from "@/lib/qab/qabOutboxLog";
import type {
  IQabOutboxPurgeCutoffs,
  IQabOutboxPurgePhase,
  IQabOutboxPurgePhaseReport,
  IQabOutboxPurgeReport,
  IQabOutboxPurgeStopReason,
} from "@/schemas/qabOutboxPurge";

/** Fixed length of a day in ms. These are TTLs over UTC instants, not calendar days. */
const MS_PER_DAY = 86_400_000;

/** The two phases, named from the closed vocabulary and never as loose literals. */
const EXHAUSTED_PHASE = "exhausted" satisfies IQabOutboxPurgePhase;
const PROCESSED_PHASE = "processed" satisfies IQabOutboxPurgePhase;

/** The three stop reasons, likewise taken from the closed vocabulary. */
const STOP_DRAINED = "drained" satisfies IQabOutboxPurgeStopReason;
const STOP_DEADLINE = "deadline" satisfies IQabOutboxPurgeStopReason;
const STOP_BATCH_CAP = "batch_cap" satisfies IQabOutboxPurgeStopReason;

/**
 * The two cutoffs of one run, both derived from the SAME `now` so the two
 * phases can never disagree about when the run started.
 */
export function resolveQabOutboxPurgeCutoffs(now: Date): IQabOutboxPurgeCutoffs {
  const nowMs = now.getTime();
  return {
    processedBefore: new Date(nowMs - QAB_OUTBOX_PROCESSED_TTL_DAYS * MS_PER_DAY),
    exhaustedBefore: new Date(nowMs - QAB_OUTBOX_EXHAUSTED_TTL_DAYS * MS_PER_DAY),
  };
}

/** State the batch loop of ONE phase carries between iterations. */
export interface IQabOutboxPurgeBatchState {
  /** Rows the previous statement deleted. */
  lastBatchDeleted: number;
  /** Statements this PHASE has already run (reset per phase). */
  batchesDone: number;
  /** Elapsed ms since the start of the RUN (cumulative across phases). */
  elapsedMs: number;
}

/**
 * The state a phase starts from. `lastBatchDeleted` is seeded with the batch
 * size on purpose, so the first evaluation does not read as "drained".
 * `elapsedMs` carries over from the previous phase.
 */
export function initialQabOutboxPurgeState(elapsedMs?: number): IQabOutboxPurgeBatchState {
  return {
    lastBatchDeleted: QAB_OUTBOX_PURGE_BATCH_SIZE,
    batchesDone: 0,
    elapsedMs: elapsedMs ?? 0,
  };
}

/**
 * Why the loop must stop, or null to run one more statement. Evaluated once
 * BEFORE the first statement of the phase and once after each one. Precedence
 * is fixed and matters when more than one condition holds:
 *   1. lastBatchDeleted < QAB_OUTBOX_PURGE_BATCH_SIZE          -> "drained"
 *   2. elapsedMs >= QAB_OUTBOX_PURGE_RUN_DEADLINE_MS           -> "deadline"
 *   3. batchesDone >= QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN     -> "batch_cap"
 *   4. otherwise                                               -> null
 * "drained" wins because a short batch means the phase is genuinely finished:
 * reporting "deadline" there would suggest a backlog that does not exist.
 */
export function resolveQabOutboxPurgeStop(
  state: IQabOutboxPurgeBatchState,
): IQabOutboxPurgeStopReason | null {
  if (state.lastBatchDeleted < QAB_OUTBOX_PURGE_BATCH_SIZE) return STOP_DRAINED;
  if (state.elapsedMs >= QAB_OUTBOX_PURGE_RUN_DEADLINE_MS) return STOP_DEADLINE;
  if (state.batchesDone >= QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN) return STOP_BATCH_CAP;
  return null;
}

/**
 * Deletes at most `limit` rows of one phase in ONE autonomous statement and
 * resolves with how many it deleted. No interactive transaction: see ADR 0040
 * for why, and for why the purge runs on the shared `prisma` client and not on
 * `qabPrisma`. Rejects on a database failure; the caller does not swallow it.
 *
 * Neither statement returns an `id`, only the affected row count, so no BigInt
 * ever reaches JavaScript (E-003).
 */
export async function deleteQabOutboxPurgeBatch(args: {
  phase: IQabOutboxPurgePhase;
  cutoff: Date;
  limit: number;
}): Promise<number> {
  const { phase, cutoff, limit } = args;

  // Covered by `idx_outbox_pendiente`, whose predicate this WHERE implies, so it
  // orders by `id` — the index's leading column (ADR 0041).
  if (phase === EXHAUSTED_PHASE) {
    return prisma.$executeRaw`
      DELETE FROM "OutboxEvento"
      WHERE id IN (
        SELECT id FROM "OutboxEvento"
        WHERE "procesadoAt" IS NULL
          AND intentos >= ${QAB_OUTBOX_MAX_ATTEMPTS}
          AND "ocurridoAt" < ${cutoff}
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
    `;
  }

  // Covered by `idx_outbox_purgable`. The `IS NOT NULL` is written out even
  // though `< cutoff` already implies it: that makes the partial index's
  // predicate syntactically implied instead of planner-dependent (ADR 0041).
  return prisma.$executeRaw`
    DELETE FROM "OutboxEvento"
    WHERE id IN (
      SELECT id FROM "OutboxEvento"
      WHERE "procesadoAt" IS NOT NULL
        AND "procesadoAt" < ${cutoff}
      ORDER BY "procesadoAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
  `;
}

export interface IQabOutboxPurgeDeps {
  /** Injected so the batch loop can be exercised without a database. */
  deleteBatch?: (args: {
    phase: IQabOutboxPurgePhase;
    cutoff: Date;
    limit: number;
  }) => Promise<number>;
  now?: () => Date;
}

/**
 * One run: the `exhausted` phase first, then `processed` (ADR 0040). Both share
 * the run deadline; each has its own batch cap. Calls `logQabOutboxPurgeRun`
 * with the report before returning it.
 *
 * `now` is called once at the start of the run — that single value produces
 * `startedAt` and BOTH cutoffs — and once after each `deleteBatch` resolves, to
 * refresh `elapsedMs`. `durationMs` is the last of those values minus the first.
 *
 * A rejected `deleteBatch` propagates: the run has nothing to roll back (each
 * statement already committed) and swallowing it would hide a broken pool
 * behind a report full of zeros.
 */
export async function purgeQabOutboxEvents(
  deps?: IQabOutboxPurgeDeps,
): Promise<IQabOutboxPurgeReport> {
  const deleteBatch = deps?.deleteBatch ?? deleteQabOutboxPurgeBatch;
  const readNow = deps?.now ?? (() => new Date());

  const startedAt = readNow();
  const startedAtMs = startedAt.getTime();
  const cutoffs = resolveQabOutboxPurgeCutoffs(startedAt);
  const cutoffByPhase: Record<IQabOutboxPurgePhase, Date> = {
    [EXHAUSTED_PHASE]: cutoffs.exhaustedBefore,
    [PROCESSED_PHASE]: cutoffs.processedBefore,
  };

  const phaseReports = {} as Record<IQabOutboxPurgePhase, IQabOutboxPurgePhaseReport>;
  let lastNowMs = startedAtMs;
  // Carried across phases: the deadline belongs to the run, not to one phase.
  let elapsedMs = 0;

  for (const phase of QAB_OUTBOX_PURGE_PHASES) {
    const cutoff = cutoffByPhase[phase];
    const state = initialQabOutboxPurgeState(elapsedMs);
    let deleted = 0;
    let stopReason = resolveQabOutboxPurgeStop(state);

    while (stopReason === null) {
      const batchDeleted = await deleteBatch({
        phase,
        cutoff,
        limit: QAB_OUTBOX_PURGE_BATCH_SIZE,
      });
      lastNowMs = readNow().getTime();
      state.lastBatchDeleted = batchDeleted;
      state.batchesDone += 1;
      state.elapsedMs = lastNowMs - startedAtMs;
      deleted += batchDeleted;
      stopReason = resolveQabOutboxPurgeStop(state);
    }

    elapsedMs = state.elapsedMs;
    phaseReports[phase] = {
      cutoff: cutoff.toISOString(),
      deleted,
      batches: state.batchesDone,
      stopReason,
    };
  }

  const exhausted = phaseReports[EXHAUSTED_PHASE];
  const processed = phaseReports[PROCESSED_PHASE];
  const report: IQabOutboxPurgeReport = {
    startedAt: startedAt.toISOString(),
    durationMs: lastNowMs - startedAtMs,
    deleted: exhausted.deleted + processed.deleted,
    exhausted,
    processed,
  };

  logQabOutboxPurgeRun(report);
  return report;
}
