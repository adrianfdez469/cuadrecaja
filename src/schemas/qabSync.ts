import { z } from "zod";
import { QAB_OUTBOX_BATCH_SIZE } from "@/constants/qab";
import { qabOutboxEntitySchema, qabOutboxOperationSchema } from "@/schemas/qabOutbox";

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

export const QAB_BUSINESS_OUTCOMES = ["ok", "error", "skipped_no_token", "skipped_deadline"] as const;

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
});
export type IQabOutboxDrainReport = z.infer<typeof qabOutboxDrainReportSchema>;

export const qabOrderPollPhaseReportSchema = z.object({
  attempted: z.number().int().min(0),
  acquired: z.number().int().min(0),
  skippedLocked: z.number().int().min(0),
  businesses: z.array(
    z.object({
      negocioId: z.string(),
      lock: z.enum(["acquired", "skipped_locked"]),
      pulled: z.number().int().min(0),
    }),
  ),
});
export type IQabOrderPollPhaseReport = z.infer<typeof qabOrderPollPhaseReportSchema>;

export const qabSyncRunReportSchema = z.object({
  startedAt: z.string(),
  durationMs: z.number().int().min(0),
  skipped: z.literal("QAB_API_BASE_URL_NOT_SET").nullable(),
  outbox: qabOutboxDrainReportSchema,
  poll: qabOrderPollPhaseReportSchema,
});
export type IQabSyncRunReport = z.infer<typeof qabSyncRunReportSchema>;
