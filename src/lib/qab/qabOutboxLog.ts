import {
  QAB_EXCHANGE_RATE_ENTITY,
  QAB_OUTBOX_CANCEL_LOG,
  QAB_OUTBOX_DEFERRED_LOG,
  QAB_OUTBOX_PURGE_LOG,
  QAB_OUTBOX_WITHHELD_LOG,
  QAB_SLUG_LEARN_LOG,
} from "@/constants/qab";
import type { IQabOutboxPurgeReport } from "@/schemas/qabOutboxPurge";
import type {
  IQabOutboxDeferral,
  IQabOutboxWithheld,
  IQabPermanentFailure,
  IQabSlugLearnResult,
} from "@/schemas/qabSync";

/** The one outcome that is an invariant violation, not an ordinary result. */
const TENANT_MISMATCH_OUTCOME: IQabSlugLearnResult["outcome"] = "tenant_mismatch";

/**
 * One line per permanent failure. Ids and codes only: no store name, no payload,
 * no response body - same rule as `logRouteError`.
 * `QAB_PERMANENT_FAILURE entidad=STORE entidadId=<id> negocioId=<id> code=<code> eventId=<id>`
 */
export function logQabPermanentFailure(failure: IQabPermanentFailure): void {
  console.error(
    `QAB_PERMANENT_FAILURE entidad=${failure.entidad} entidadId=${failure.entidadId} negocioId=${failure.negocioId} code=${failure.code} eventId=${failure.eventId}`,
  );
}

/**
 * One line per learning target. Ids and the closed code, nothing else: no
 * `reason`, no `url`, no response body, no slug — the phase's report aggregates
 * every business in one place. Same rule as `logQabPermanentFailure`.
 * `qab.slugLearn negocioId=<id> tiendaId=<id> outcome=<code>`
 */
export function logQabSlugLearnOutcome(result: IQabSlugLearnResult): void {
  const line = `${QAB_SLUG_LEARN_LOG} negocioId=${result.negocioId} tiendaId=${result.tiendaId} outcome=${result.outcome}`;
  // A tenant mismatch is an invariant violation that must never happen, so it is
  // the one outcome loud enough for an error channel.
  if (result.outcome === TENANT_MISMATCH_OUTCOME) console.error(line);
  else console.info(line);
}

/**
 * One line per withheld entity with a backlog. Counts and one instant only: no
 * negocioId, no event id, no payload — same rule as `logQabPermanentFailure`.
 * `qab.outbox.withheld entidad=BUSINESS pending=12 oldest=2026-09-06T14:03:00.000Z`
 *
 * `warn` and not `info`: withholding is deliberate, so it is not an error, and it
 * is not routine either — it is a backlog waiting for a switch.
 */
export function logQabWithheldOutbox(entry: IQabOutboxWithheld): void {
  const oldest =
    entry.oldestOcurridoAt === null ? "null" : entry.oldestOcurridoAt.toISOString();
  console.warn(
    `${QAB_OUTBOX_WITHHELD_LOG} entidad=${entry.entidad} pending=${entry.pending} oldest=${oldest}`,
  );
}

/**
 * One line per run. Counts and closed codes only: no negocioId, no event id, no
 * ultimoError — the function's logs aggregate every business in one place.
 * `qab.outboxPurge deleted=<n> exhausted=<n> processed=<n> batches=<n> exhaustedStop=<code> processedStop=<code> durationMs=<n>`
 */
export function logQabOutboxPurgeRun(report: IQabOutboxPurgeReport): void {
  const batches = report.exhausted.batches + report.processed.batches;
  // A normal run is not an error, so it goes to the info channel.
  console.info(
    `${QAB_OUTBOX_PURGE_LOG} deleted=${report.deleted} exhausted=${report.exhausted.deleted} processed=${report.processed.deleted} batches=${batches} exhaustedStop=${report.exhausted.stopReason} processedStop=${report.processed.stopReason} durationMs=${report.durationMs}`,
  );
}

/**
 * One line per cancellation. Ids and counts only: no payload, no business token,
 * no QAB response body - same rule as `logQabPermanentFailure`. The three ids
 * are the ones acceptance criterion 11 allows.
 * `qab.outbox.cancel entidad=EXCHANGE_RATE negocioId=<id> entidadId=<code> cancelled=<n> capReached=<bool>`
 *
 * `info` for a normal cancellation, which is a deliberate outcome and not an
 * error; `warn` when the cap was reached, which is not routine. Same split as
 * `logQabSlugLearnOutcome`.
 */
export function logQabExchangeRateCancel(entry: {
  negocioId: string;
  entidadId: string;
  cancelled: number;
  capReached: boolean;
}): void {
  const line = `${QAB_OUTBOX_CANCEL_LOG} entidad=${QAB_EXCHANGE_RATE_ENTITY} negocioId=${entry.negocioId} entidadId=${entry.entidadId} cancelled=${entry.cancelled} capReached=${entry.capReached}`;
  if (entry.capReached) console.warn(line);
  else console.info(line);
}

/**
 * One line per deferred event. Ids and the CLOSED code only: no payload, no
 * business token, no QAB response body - same rule as `logQabPermanentFailure`.
 * `code` comes from `IQabOutboxDeferral`, which carries the constant that
 * matched and never the received string (ADR 0103 § 1).
 * `qab.outbox.deferred entidad=PRODUCT entidadId=<id> negocioId=<id> code=<code> eventId=<id>`
 *
 * `warn` and not `error`: a deferral is not a failure of this event, it is a
 * backlog waiting for its dependency - the same reading `logQabWithheldOutbox`
 * gives a backlog waiting for a switch. And not `info` either: it is not routine.
 */
export function logQabOutboxDeferral(deferral: IQabOutboxDeferral): void {
  console.warn(
    `${QAB_OUTBOX_DEFERRED_LOG} entidad=${deferral.entidad} entidadId=${deferral.entidadId} negocioId=${deferral.negocioId} code=${deferral.code} eventId=${deferral.eventId}`,
  );
}
