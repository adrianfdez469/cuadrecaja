import { z } from "zod";
import {
  QAB_ORDER_CURRENCY_CODE_MAX_LENGTH,
  QAB_ORDER_TEXT_MAX_LENGTH,
} from "@/constants/qab";

/**
 * `PedidoEntrante.rateSnapshot` as QAB persists it: opaque, stored verbatim,
 * never recomputed and never rewritten. Shape read from contract v10.1 § 3-4.
 *
 * NOT `.strict()`: a key the other side adds tomorrow must not make an already
 * stored order unreadable.
 *
 * The values of `rates` stay `unknown` ON PURPOSE, so ONE unreadable rate does
 * not cost the whole snapshot. Each one is validated where it is used, by
 * `readQabRate`.
 *
 * This module imports only `zod` and `@/constants/qab`, and nothing under
 * `@/schemas/**` imports it back: there is no value edge that could close a
 * cycle (E-028).
 */
export const qabRateSnapshotSchema = z.object({
  base: z.string().trim().min(1).max(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
  capturedAt: z.string().max(QAB_ORDER_TEXT_MAX_LENGTH).nullish(),
  rates: z.record(z.string(), z.unknown()).default({}),
});
export type IQabRateSnapshot = z.infer<typeof qabRateSnapshotSchema>;

/**
 * PURE. The snapshot of a row, or `null` when the column is null or the value
 * does not satisfy the schema.
 *
 * Uses `safeParse`, and the issues are NEITHER returned NOR logged: no fragment
 * of the stored value leaves through an error message (ADR 0061, E-031).
 */
export function parseQabRateSnapshot(value: unknown): IQabRateSnapshot | null {
  const parsed = qabRateSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
