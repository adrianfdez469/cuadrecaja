import { z } from "zod";
import {
  QAB_AVAILABILITY,
  QAB_AVAILABILITY_BATCH_SIZE,
  QAB_BUSINESS_OUTCOMES,
} from "@/constants/qab";

/** The three-value enum. The ONLY availability datum that crosses the boundary. */
export const qabAvailabilityValueSchema = z.enum(QAB_AVAILABILITY);
export type IQabAvailabilityValue = z.infer<typeof qabAvailabilityValueSchema>;

/**
 * One row of the divergence query. INTERNAL: it never travels, and it carries
 * neither `existencia` nor `umbralBajo` — the integer and its threshold stop at
 * the SQL projection, which returns the CASE result and not its operands.
 */
export const qabDivergentRowSchema = z.object({
  /** ProductoTienda.id. The wire calls it `storeProductId`. */
  productoTiendaId: z.string().min(1),
  /** Tienda.id. The wire calls it `storeId`. */
  tiendaId: z.string().min(1),
  /** Tienda.negocioId. The tenant of the row; NEVER read from the payload. */
  negocioId: z.string().min(1),
  availability: qabAvailabilityValueSchema,
});
export type IQabDivergentRow = z.infer<typeof qabDivergentRowSchema>;

/** One item as it travels (§ ②). Three keys, no more: see the forbidden-keys rule. */
export const qabAvailabilityItemSchema = z.object({
  storeProductId: z.string().min(1),
  storeId: z.string().min(1),
  availability: qabAvailabilityValueSchema,
});
export type IQabAvailabilityItem = z.infer<typeof qabAvailabilityItemSchema>;

export const qabAvailabilityBatchSchema = z.object({
  businessId: z.string().min(1),
  items: z.array(qabAvailabilityItemSchema).min(1).max(QAB_AVAILABILITY_BATCH_SIZE),
});
export type IQabAvailabilityBatch = z.infer<typeof qabAvailabilityBatchSchema>;

/**
 * The 200 response. `confirmed` is authoritative and holds PAIRS
 * [storeProductId, storeId]; `applied` is the other side's changed-row count and
 * decides NOTHING here. See ADR 0050.
 */
export const qabAvailabilitySyncResponseSchema = z.object({
  applied: z.number().int().min(0),
  confirmed: z
    .array(z.tuple([z.string().min(1), z.string().min(1)]))
    // A well-formed response can never confirm more items than the page carried:
    // the other side pushes at most one pair per item it received. The bound is
    // declared HERE and not left to the byte cap of `readBoundedBody`, which is a
    // different concern in a different module. See ADR 0051.
    .max(QAB_AVAILABILITY_BATCH_SIZE)
    .default([]),
});
export type IQabAvailabilitySyncResponse = z.infer<typeof qabAvailabilitySyncResponseSchema>;

/** What one page's response authorises writing. Values come from the SENT rows. */
export const qabAvailabilityWritePlanSchema = z.object({
  /** One entry per distinct value, in QAB_AVAILABILITY order. Never an empty group. */
  groups: z
    .array(
      z.object({
        availability: qabAvailabilityValueSchema,
        productoTiendaIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .default([]),
  /** Sent rows matched by a confirmed pair. Equals the sum of the group sizes. */
  confirmed: z.number().int().min(0),
});
export type IQabAvailabilityWritePlan = z.infer<typeof qabAvailabilityWritePlanSchema>;

export const qabAvailabilityBusinessReportSchema = z.object({
  negocioId: z.string().min(1),
  /** Divergent rows this run read for this business, after every filter. */
  items: z.number().int().min(0),
  /** HTTP requests actually issued for it. */
  requests: z.number().int().min(0),
  /** Sent rows a confirmed pair matched. */
  confirmed: z.number().int().min(0),
  /** Rows `dispPublicada` was written for: the sum of the updateMany counts. */
  written: z.number().int().min(0),
  outcome: z.enum(QAB_BUSINESS_OUTCOMES),
});
export type IQabAvailabilityBusinessReport = z.infer<typeof qabAvailabilityBusinessReportSchema>;

export const qabAvailabilityPhaseReportSchema = z.object({
  /** Divergent rows read this run, across every eligible business. */
  rows: z.number().int().min(0),
  /** true when the read returned exactly QAB_AVAILABILITY_MAX_ROWS_PER_RUN. */
  capped: z.boolean(),
  /** Businesses with at least one divergent row this run. */
  businesses: z.number().int().min(0),
  requests: z.number().int().min(0),
  confirmed: z.number().int().min(0),
  written: z.number().int().min(0),
  byBusiness: z.array(qabAvailabilityBusinessReportSchema).default([]),
});
export type IQabAvailabilityPhaseReport = z.infer<typeof qabAvailabilityPhaseReportSchema>;
