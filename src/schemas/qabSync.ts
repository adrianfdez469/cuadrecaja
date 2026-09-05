import { z } from "zod";
import {
  QAB_BUSINESS_OUTCOMES,
  QAB_ORDER_POLL_LOCK_STATES,
  QAB_ORDER_PULL_OUTCOMES,
  QAB_OUTBOX_BATCH_SIZE,
  QAB_OUTBOX_PERMANENT_ERROR_CODES,
  QAB_SLUG_LEARN_OUTCOMES,
} from "@/constants/qab";
import { qabOutboxEntitySchema, qabOutboxOperationSchema } from "@/schemas/qabOutbox";
import { qabAvailabilityPhaseReportSchema } from "@/schemas/qabAvailability";

/** One event as it travels over the wire (§ ① «Formato»). Names in English. */
export const qabCatalogEventSchema = z.object({
  eventId: z.string().min(1), // OutboxEvento.id in decimal, NEVER a BigInt
  entity: qabOutboxEntitySchema,
  operation: qabOutboxOperationSchema,
  occurredAt: z.string().min(1), // ISO-8601 UTC with milliseconds
  payload: z.unknown(),
});
export type IQabCatalogEvent = z.infer<typeof qabCatalogEventSchema>;

export const qabCatalogBatchSchema = z.object({
  businessId: z.string().min(1),
  events: z.array(qabCatalogEventSchema).min(1).max(QAB_OUTBOX_BATCH_SIZE),
});
export type IQabCatalogBatch = z.infer<typeof qabCatalogBatchSchema>;

/**
 * The 207 response. `ok` and `failed` are authoritative; `results` is detail for
 * logs, and that is why its `status` is a `z.string()` and NOT an enum: if QAB
 * adds a new status, a strict enum would take the whole drain down with it.
 */
export const qabCatalogSyncResponseSchema = z.object({
  ok: z.array(z.string()).default([]),
  failed: z.array(z.object({ id: z.string(), error: z.string() })).default([]),
  results: z.array(z.object({ eventId: z.string(), status: z.string() })).default([]),
});
export type IQabCatalogSyncResponse = z.infer<typeof qabCatalogSyncResponseSchema>;

/** What has to be written back to the outbox after a send. */
export const qabOutboxAckPlanSchema = z.object({
  processedIds: z.array(z.string()),
  failedAcks: z.array(z.object({ id: z.string(), ultimoError: z.string() })),
});
export type IQabOutboxAckPlan = z.infer<typeof qabOutboxAckPlanSchema>;

/**
 * A failure that will fail identically on all QAB_OUTBOX_MAX_ATTEMPTS retries,
 * because nothing changes between them: the data has to be fixed in cuadrecaja
 * first. Reported so it does not burn the six attempts in silence (F-005,
 * acceptance criterion 12).
 */
export const qabPermanentFailureSchema = z.object({
  eventId: z.string().min(1),
  negocioId: z.string().min(1),
  entidad: qabOutboxEntitySchema,
  /** For a STORE event this is the Tienda.id: the local, named by its id. */
  entidadId: z.string().min(1),
  code: z.enum(QAB_OUTBOX_PERMANENT_ERROR_CODES),
});
export type IQabPermanentFailure = z.infer<typeof qabPermanentFailureSchema>;

/* -------------------------------------------------------------------------- */
/* F-020 — Learning the slug QAB actually assigned                             */
/* -------------------------------------------------------------------------- */

/** A local whose `slugQab` is still null and whose publish was already applied. */
export const qabSlugLearningTargetSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
  /** What the merchant asked for. The `slug` query param; NEVER the value written. */
  slug: z.string().nullable(),
  /** Fallback for the query when `slug` is null: § ⑥ needs `slug` OR `name`. */
  nombre: z.string().min(1),
});
export type IQabSlugLearningTarget = z.infer<typeof qabSlugLearningTargetSchema>;

/** One STORE event of this run whose payload published and whose ack succeeded. */
export const qabAppliedStorePublishSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
});
export type IQabAppliedStorePublish = z.infer<typeof qabAppliedStorePublishSchema>;

export const qabSlugLearnResultSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
  outcome: z.enum(QAB_SLUG_LEARN_OUTCOMES),
});
export type IQabSlugLearnResult = z.infer<typeof qabSlugLearnResultSchema>;

export const qabSlugLearnPhaseReportSchema = z.object({
  /** Eligible targets the query found this run, BEFORE the per-run cap. */
  targets: z.number().int().min(0),
  /** Targets an HTTP read was actually issued for. */
  attempted: z.number().int().min(0),
  /** Columns written. Equals the number of `learned` entries in `results`. */
  learned: z.number().int().min(0),
  results: z.array(qabSlugLearnResultSchema).default([]),
});
export type IQabSlugLearnPhaseReport = z.infer<typeof qabSlugLearnPhaseReportSchema>;

/**
 * Re-exported so this module stays the import site every consumer already uses.
 * Its declaration lives in `@/constants/qab` to keep this module and
 * `@/schemas/qabAvailability` acyclic: see the comment there.
 */
export { QAB_BUSINESS_OUTCOMES };

export const qabOutboxDrainReportSchema = z.object({
  claimed: z.number().int().min(0),
  eventIds: z.array(z.string()), // ids claimed by THIS run, in id order
  businesses: z.number().int().min(0),
  processed: z.number().int().min(0),
  failed: z.number().int().min(0),
  byBusiness: z.array(
    z.object({
      negocioId: z.string(),
      events: z.number().int().min(0),
      processed: z.number().int().min(0),
      failed: z.number().int().min(0),
      outcome: z.enum(QAB_BUSINESS_OUTCOMES),
    }),
  ),
  permanentFailures: z.array(qabPermanentFailureSchema).default([]),
  /**
   * The STORE publishes this run got acknowledged for. ONLY reorders the
   * learning phase's eligible set; it never widens it (ADR 0036b).
   */
  appliedStoreEvents: z.array(qabAppliedStorePublishSchema).default([]),
});
export type IQabOutboxDrainReport = z.infer<typeof qabOutboxDrainReportSchema>;

/**
 * The pull's phase report stays HERE, where F-002 put it, and takes its two
 * vocabularies from `@/constants/qab` and never from another schema module: this
 * module already imports the availability phase report, and a value edge back
 * from `@/schemas/qabOrderPull` would close a cycle that breaks at LOAD time
 * while `tsc --noEmit` stays green (E-028).
 */
export const qabOrderPollBusinessReportSchema = z.object({
  negocioId: z.string(),
  lock: z.enum(QAB_ORDER_POLL_LOCK_STATES),
  outcome: z.enum(QAB_ORDER_PULL_OUTCOMES),
  pages: z.number().int().min(0),
  received: z.number().int().min(0),
  pulled: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  rejected: z.number().int().min(0),
  inconsistentTotals: z.number().int().min(0),
  cursorJumps: z.number().int().min(0),
  moreAvailable: z.boolean(),
});
export type IQabOrderPollBusinessReport = z.infer<typeof qabOrderPollBusinessReportSchema>;

export const qabOrderPollPhaseReportSchema = z.object({
  attempted: z.number().int().min(0),
  acquired: z.number().int().min(0),
  skippedLocked: z.number().int().min(0),
  skippedDeadline: z.number().int().min(0),
  /** Businesses whose slot threw. Counted, never allowed to end the run. */
  failed: z.number().int().min(0),
  received: z.number().int().min(0),
  pulled: z.number().int().min(0),
  rejected: z.number().int().min(0),
  businesses: z.array(qabOrderPollBusinessReportSchema).default([]),
});
export type IQabOrderPollPhaseReport = z.infer<typeof qabOrderPollPhaseReportSchema>;

export const qabSyncRunReportSchema = z.object({
  startedAt: z.string(),
  durationMs: z.number().int().min(0),
  skipped: z.literal("QAB_API_BASE_URL_NOT_SET").nullable(),
  outbox: qabOutboxDrainReportSchema,
  slugLearn: qabSlugLearnPhaseReportSchema,
  availability: qabAvailabilityPhaseReportSchema, // F-007
  poll: qabOrderPollPhaseReportSchema,
});
export type IQabSyncRunReport = z.infer<typeof qabSyncRunReportSchema>;
