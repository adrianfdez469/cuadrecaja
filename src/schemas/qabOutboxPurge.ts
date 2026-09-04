import { z } from "zod";
import {
  QAB_OUTBOX_PURGE_PHASES,
  QAB_OUTBOX_PURGE_STOP_REASONS,
} from "@/constants/qab";

export const qabOutboxPurgePhaseSchema = z.enum(QAB_OUTBOX_PURGE_PHASES);
export type IQabOutboxPurgePhase = z.infer<typeof qabOutboxPurgePhaseSchema>;

export const qabOutboxPurgeStopReasonSchema = z.enum(QAB_OUTBOX_PURGE_STOP_REASONS);
export type IQabOutboxPurgeStopReason = z.infer<typeof qabOutboxPurgeStopReasonSchema>;

/** The two exclusive upper bounds of one run, both derived from the same `now`. */
export const qabOutboxPurgeCutoffsSchema = z.object({
  /** Rows with `procesadoAt` strictly older than this are purgable. */
  processedBefore: z.date(),
  /** Exhausted rows with `ocurridoAt` strictly older than this are purgable. */
  exhaustedBefore: z.date(),
});
export type IQabOutboxPurgeCutoffs = z.infer<typeof qabOutboxPurgeCutoffsSchema>;

export const qabOutboxPurgePhaseReportSchema = z.object({
  /** The cutoff this phase applied, ISO-8601 UTC. */
  cutoff: z.string().min(1),
  deleted: z.number().int().min(0),
  batches: z.number().int().min(0),
  stopReason: qabOutboxPurgeStopReasonSchema,
});
export type IQabOutboxPurgePhaseReport = z.infer<typeof qabOutboxPurgePhaseReportSchema>;

/**
 * Aggregate counts ONLY: no negocioId, no event id, no ultimoError. The purge
 * runs without a tenant filter on purpose, so its report must not become a
 * cross-tenant data surface (ADR 0040).
 */
export const qabOutboxPurgeReportSchema = z.object({
  startedAt: z.string().min(1),
  durationMs: z.number().int().min(0),
  /** exhausted.deleted + processed.deleted. */
  deleted: z.number().int().min(0),
  exhausted: qabOutboxPurgePhaseReportSchema,
  processed: qabOutboxPurgePhaseReportSchema,
});
export type IQabOutboxPurgeReport = z.infer<typeof qabOutboxPurgeReportSchema>;
