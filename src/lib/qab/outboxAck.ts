import {
  QAB_OUTBOX_DEFERRED_ERROR_CODES,
  QAB_OUTBOX_ERROR_CODES,
  QAB_OUTBOX_ERROR_MAX_LENGTH,
  QAB_OUTBOX_PERMANENT_ERROR_CODES,
} from "@/constants/qab";
import type { IOutboxEvento } from "@/schemas/qabOutbox";
import type {
  IQabCatalogBatch,
  IQabOutboxAckPlan,
  IQabOutboxDeferral,
  IQabOutboxDeferralCode,
  IQabOutboxDrainReport,
  IQabPermanentFailure,
  IQabSlugLearnPhaseReport,
} from "@/schemas/qabSync";
import type { IQabPostOutcome } from "@/lib/qab/qabCatalogClient";

/** A row of the batch does not belong to the business the batch is addressed to. */
export class QabTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QabTenantMismatchError";
  }
}

const ELLIPSIS = "…";

/** `message.length <= QAB_OUTBOX_ERROR_MAX_LENGTH ? message : message.slice(0, MAX - 1) + "…"` */
export function truncateOutboxError(message: string): string {
  return message.length <= QAB_OUTBOX_ERROR_MAX_LENGTH
    ? message
    : `${message.slice(0, QAB_OUTBOX_ERROR_MAX_LENGTH - 1)}${ELLIPSIS}`;
}

function compareByEventId(a: IOutboxEvento, b: IOutboxEvento): number {
  const left = BigInt(a.id);
  const right = BigInt(b.id);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Partitions a claimed batch by business, preserving the id order inside each
 * group. The returned entries are ordered by the SMALLEST event id of each
 * business.
 */
export function groupOutboxEventsByNegocio(rows: IOutboxEvento[]): Array<{
  negocioId: string;
  rows: IOutboxEvento[];
}> {
  const groups = new Map<string, IOutboxEvento[]>();
  for (const row of [...rows].sort(compareByEventId)) {
    const group = groups.get(row.negocioId);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.negocioId, [row]);
    }
  }
  // Map preserves insertion order, and insertion happened in ascending id order,
  // so the entries are already ordered by each business's smallest event id.
  return [...groups.entries()].map(([negocioId, groupRows]) => ({ negocioId, rows: groupRows }));
}

/**
 * Wire payload for one business. Throws `QabTenantMismatchError` when any row's
 * `negocioId` differs from `negocioId`: the tenant boundary is an invariant of
 * this function, not something the caller has to remember.
 */
export function toQabCatalogBatch(negocioId: string, rows: IOutboxEvento[]): IQabCatalogBatch {
  return {
    businessId: negocioId,
    events: rows.map((row) => {
      if (row.negocioId !== negocioId) {
        throw new QabTenantMismatchError(
          `Outbox event ${row.id} belongs to another business than the batch it was put in`,
        );
      }
      return {
        eventId: row.id,
        entity: row.entidad,
        operation: row.operacion,
        occurredAt: row.ocurridoAt.toISOString(),
        payload: row.payload,
      };
    }),
  };
}

/**
 * PURE. The member of QAB_OUTBOX_DEFERRED_ERROR_CODES that `error` is EXACTLY
 * equal to, or `undefined`. Case sensitive, no trimming, no substring search and
 * no normalisation: see ADR 0103 § 1 for why this is narrower than the match
 * `collectQabPermanentFailures` does, on purpose.
 *
 * It returns the CONSTANT and not the received string, so nothing QAB controls
 * travels any further than this comparison. Never throws: `===` between two
 * strings has no failure mode, and this function does no parsing, no truncation
 * and no interpolation (E-031).
 */
export function matchQabOutboxDeferralCode(error: string): IQabOutboxDeferralCode | undefined {
  return QAB_OUTBOX_DEFERRED_ERROR_CODES.find((candidate) => error === candidate);
}

/**
 * What to write back, given what was sent and what came back. Pure and total:
 * every row of `rows` appears in exactly ONE of the THREE lists, in the given
 * order. Ids in `outcome` that do not belong to `rows` are IGNORED - QAB can
 * never make this run acknowledge a row it did not send.
 *
 * The third list, `deferrals`, is the one the caller writes NOTHING for: no
 * `procesadoAt`, no `intentos`, no `ultimoError`. It is the seventh row of the
 * truth table of ADR 0011, added by ADR 0102; the other six are unchanged and
 * are not restated here.
 */
export function planOutboxAck(
  rows: IOutboxEvento[],
  outcome: IQabPostOutcome,
): IQabOutboxAckPlan {
  if (outcome.kind === "error") {
    // A transport or HTTP failure is not attributable to one event, so nothing in
    // the batch is known to be deferred: same reasoning as the early return of
    // `collectQabPermanentFailures`.
    const ultimoError = truncateOutboxError(outcome.ultimoError);
    return {
      processedIds: [],
      failedAcks: rows.map((row) => ({ id: row.id, ultimoError })),
      deferrals: [],
    };
  }

  const acknowledged = new Set(outcome.response.ok);
  const failures = new Map(outcome.response.failed.map((entry) => [entry.id, entry.error]));

  const processedIds: string[] = [];
  const failedAcks: IQabOutboxAckPlan["failedAcks"] = [];
  const deferrals: IQabOutboxDeferral[] = [];

  for (const row of rows) {
    // An id present in both lists counts as failed: `ok` is an acknowledgement,
    // `failed` is an explicit error, and the contract says an event that failed
    // is never reported in `ok`.
    const failure = failures.get(row.id);
    if (failure !== undefined) {
      const code = matchQabOutboxDeferralCode(failure);
      if (code !== undefined) {
        // Every field comes from the LOCAL row; from the response only the code
        // that matched, which is this side's own constant (ADR 0102).
        deferrals.push({
          eventId: row.id,
          negocioId: row.negocioId,
          entidad: row.entidad,
          entidadId: row.entidadId,
          code,
        });
        continue;
      }
      failedAcks.push({
        id: row.id,
        ultimoError: truncateOutboxError(`${QAB_OUTBOX_ERROR_CODES.event}:${failure}`),
      });
      continue;
    }
    if (acknowledged.has(row.id)) {
      processedIds.push(row.id);
      continue;
    }
    failedAcks.push({ id: row.id, ultimoError: QAB_OUTBOX_ERROR_CODES.missingInResponse });
  }

  return { processedIds, failedAcks, deferrals };
}

/**
 * PURE. The entries of `failed[]` whose error is a permanent one: retrying them
 * unchanged fails identically all QAB_OUTBOX_MAX_ATTEMPTS times. Ids that do not
 * belong to `rows` are IGNORED, exactly like in `planOutboxAck`.
 *
 * It changes NOTHING about the retry mechanics: the rows still take their
 * `intentos++` and their `ultimoError` from `planOutboxAck`. What this adds is
 * visibility, which is all acceptance criterion 12 asks for.
 */
export function collectQabPermanentFailures(
  rows: IOutboxEvento[],
  outcome: IQabPostOutcome,
): IQabPermanentFailure[] {
  // A transport or HTTP failure is not attributable to one event: the batch never
  // got an answer, so nothing in it is known to be permanently broken.
  if (outcome.kind === "error") return [];

  const byId = new Map(rows.map((row) => [row.id, row]));
  const failures: IQabPermanentFailure[] = [];

  for (const entry of outcome.response.failed) {
    const row = byId.get(entry.id);
    if (row === undefined) continue;

    const code = QAB_OUTBOX_PERMANENT_ERROR_CODES.find(
      (candidate) => entry.error === candidate || entry.error.includes(candidate),
    );
    if (code === undefined) continue;

    failures.push({
      eventId: row.id,
      negocioId: row.negocioId,
      entidad: row.entidad,
      entidadId: row.entidadId,
      code,
    });
  }

  return failures;
}

/** A report with every counter at zero and every list empty, whatever its fields. */
export function emptyQabOutboxDrainReport(): IQabOutboxDrainReport {
  return {
    claimed: 0,
    eventIds: [],
    businesses: 0,
    processed: 0,
    failed: 0,
    byBusiness: [],
    permanentFailures: [],
    deferrals: [],
    appliedStoreEvents: [],
    withheld: [],
  };
}

/** A slug-learning phase report with the three counters at zero and no results. */
export function emptyQabSlugLearnPhaseReport(): IQabSlugLearnPhaseReport {
  return { targets: 0, attempted: 0, learned: 0, results: [] };
}
