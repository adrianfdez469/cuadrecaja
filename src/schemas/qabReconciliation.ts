import { z } from "zod";
import {
  QAB_RECONCILIATION_HASH_PATTERN,
  QAB_RECONCILIATION_STORE_OUTCOMES,
  QAB_RECONCILIATION_UPSTREAM_CODES,
  QAB_SYNC_SKIPPED_NO_BASE_URL,
} from "@/constants/qab";
import { NivelImportanciaEnum, TipoNotificacionEnum } from "@/schemas/notificacion";

/**
 * One row of the mirror, as `readQabMirrorRows` projects it. `precio` and
 * `monedaPrecioCode` are non-null because the mirror's WHERE excludes the nulls;
 * `dispPublicada` IS nullable, and the hash folds the null into
 * QAB_RECONCILIATION_DEFAULT_AVAILABILITY. Nothing else of the row travels:
 * neither `existencia` nor `umbralBajo` nor `costo` reaches this shape.
 */
export const qabMirrorRowSchema = z.object({
  /** ProductoTienda.id. The wire and the hash both call it the row's id. */
  id: z.string().min(1),
  precio: z.number().finite(),
  monedaPrecioCode: z.string().min(1),
  dispPublicada: z.string().nullable(),
});
export type IQabMirrorRow = z.infer<typeof qabMirrorRowSchema>;

/**
 * `{ products, hash }` — the pair § ⑤ publishes. ONE schema for both sides: the
 * local result and the parsed response have the same shape, and defining it
 * twice is what makes two readings of one contract possible.
 *
 * `z.object` drops unknown keys, so a field QAB adds later is ignored here and
 * never mirrored back.
 */
export const qabCatalogHashSchema = z.object({
  products: z.number().int().min(0),
  hash: z.string().regex(QAB_RECONCILIATION_HASH_PATTERN),
});
export type IQabCatalogHash = z.infer<typeof qabCatalogHashSchema>;

/** One store the run may compare, with the key that orders the round robin. */
export const qabReconciliationTargetSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
  ultimaComparacionAt: z.coerce.date().nullable(),
});
export type IQabReconciliationTarget = z.infer<typeof qabReconciliationTargetSchema>;

export const qabReconciliationStoreOutcomeSchema = z.enum(QAB_RECONCILIATION_STORE_OUTCOMES);
export type IQabReconciliationStoreOutcome = z.infer<typeof qabReconciliationStoreOutcomeSchema>;

export const qabReconciliationUpstreamCodeSchema = z.enum(QAB_RECONCILIATION_UPSTREAM_CODES);
export type IQabReconciliationUpstreamCode = z.infer<typeof qabReconciliationUpstreamCodeSchema>;

/**
 * One store's entry of the run report. Counts, ids and codes only: the two
 * hashes are NOT here — `hashMatch` says whether they agreed, which is
 * everything the report needs and the same rule the other phases follow.
 */
export const qabReconciliationStoreReportSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
  outcome: qabReconciliationStoreOutcomeSchema,
  /** null when the local mirror was never read (`skipped_deadline`). */
  localProducts: z.number().int().min(0).nullable(),
  /** null when QAB gave no comparable answer. */
  remoteProducts: z.number().int().min(0).nullable(),
  /** null when there was nothing to compare. */
  hashMatch: z.boolean().nullable(),
  /** Rows `dispPublicada` was set to NULL for. 0 unless `outcome` is "diverged". */
  clearedRows: z.number().int().min(0),
  upstreamCode: qabReconciliationUpstreamCodeSchema.nullable(),
});
export type IQabReconciliationStoreReport = z.infer<typeof qabReconciliationStoreReportSchema>;

/** What the alert pass wrote in one run. */
export const qabAlertSyncReportSchema = z.object({
  businesses: z.number().int().min(0),
  stalled: z.number().int().min(0),
  diverged: z.number().int().min(0),
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  deleted: z.number().int().min(0),
});
export type IQabAlertSyncReport = z.infer<typeof qabAlertSyncReportSchema>;

export const qabReconciliationRunReportSchema = z.object({
  startedAt: z.string().min(1),
  durationMs: z.number().int().min(0),
  skipped: z.literal(QAB_SYNC_SKIPPED_NO_BASE_URL).nullable(),
  /** Eligible businesses of this run. */
  businesses: z.number().int().min(0),
  /** Published stores of those businesses. */
  candidates: z.number().int().min(0),
  attempted: z.number().int().min(0),
  matched: z.number().int().min(0),
  diverged: z.number().int().min(0),
  unknownStores: z.number().int().min(0),
  errors: z.number().int().min(0),
  tooLarge: z.number().int().min(0),
  skippedDeadline: z.number().int().min(0),
  clearedRows: z.number().int().min(0),
  /** Forced tiendaIds that matched no candidate. A COUNT, never the ids. */
  forcedMissing: z.number().int().min(0),
  stores: z.array(qabReconciliationStoreReportSchema).default([]),
  alerts: qabAlertSyncReportSchema,
});
export type IQabReconciliationRunReport = z.infer<typeof qabReconciliationRunReportSchema>;

/** One persisted row, as `readQabSyncStalenessRows` reads it. */
export const qabSyncStalenessRowSchema = z.object({
  negocioId: z.string().min(1),
  tiendaId: z.string().min(1),
  nombre: z.string().min(1),
  ultimoContactoOkAt: z.coerce.date().nullable(),
  hashDivergenteAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type IQabSyncStalenessRow = z.infer<typeof qabSyncStalenessRowSchema>;

/** One business's aggregated alert state. The unit of acceptance criterion 8. */
export const qabBusinessAlertStateSchema = z.object({
  negocioId: z.string().min(1),
  /** max over the business's rows of (ultimoContactoOkAt ?? createdAt). */
  ultimoContactoAt: z.coerce.date(),
  stale: z.boolean(),
  /** tiendaIds whose `hashDivergenteAt` is set, ascending by tiendaId. */
  divergedTiendaIds: z.array(z.string().min(1)).default([]),
  /** Tienda.nombre of those ids, in the SAME order. For the copy only. */
  divergedNombres: z.array(z.string().min(1)).default([]),
});
export type IQabBusinessAlertState = z.infer<typeof qabBusinessAlertStateSchema>;

/** What ONE notification must look like. `null` from the planner means "must not exist". */
export const qabAlertDescriptorSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  nivelImportancia: NivelImportanciaEnum,
  tipo: TipoNotificacionEnum,
  /** EXACTLY the negocioId, so `findExistingNotification` matches it. */
  negociosDestino: z.string().min(1),
  /** Left EMPTY on purpose. See the F-008 contract § 7. */
  usuariosDestino: z.literal(""),
  accionUrl: z.string().min(1),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
});
export type IQabAlertDescriptor = z.infer<typeof qabAlertDescriptorSchema>;

export const qabAlertPlanSchema = z.object({
  stalled: qabAlertDescriptorSchema.nullable(),
  diverged: qabAlertDescriptorSchema.nullable(),
});
export type IQabAlertPlan = z.infer<typeof qabAlertPlanSchema>;
