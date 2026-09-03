import { z } from "zod";
import { QAB_ORDER_CANCELLED_BY, QAB_ORDER_STATUSES } from "@/constants/qab";

/** Longest decimal representation of a signed 64-bit integer is 19 digits. */
const ORDER_ID_PATTERN = /^\d{1,19}$/;
const ORDER_STATUS_MAX_LENGTH = 64;

/** QAB's order id: the decimal digits of a BIGINT, as text. */
export const qabOrderIdSchema: z.ZodType<string, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (typeof input !== "string") {
      ctx.addIssue({ code: "custom", message: "Invalid QAB order id" });
      return z.NEVER;
    }
    const trimmed = input.trim();
    if (!ORDER_ID_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB order id" });
      return z.NEVER;
    }
    return trimmed;
  });
export type IQabOrderId = z.infer<typeof qabOrderIdSchema>;

/**
 * Numeric comparison of two order ids.
 * NEVER compare them as strings: "9" > "10" lexicographically, and Number()
 * lies past 2^53. BigInt is the only correct arithmetic here.
 */
export function compareQabOrderIds(a: IQabOrderId, b: IQabOrderId): -1 | 0 | 1 {
  const left = BigInt(a);
  const right = BigInt(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Cursor advance. Returns whichever id is numerically greater. */
export function maxQabOrderId(
  current: IQabOrderId | null,
  candidate: IQabOrderId,
): IQabOrderId {
  if (current === null) {
    return candidate;
  }
  return compareQabOrderIds(current, candidate) >= 0 ? current : candidate;
}

/** The nine states the contract knows about today. */
export const qabOrderStatusKnownSchema = z.enum(QAB_ORDER_STATUSES);
export type IQabOrderStatusKnown = z.infer<typeof qabOrderStatusKnownSchema>;

/**
 * What is actually persisted: any non-empty text, so an unknown status never
 * breaks the pull. The enum already grew from 6 to 9 values with no transition
 * period and no HTTP error to warn about it (ADR 0004).
 */
export const qabOrderStatusSchema: z.ZodType<string, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (typeof input !== "string") {
      ctx.addIssue({ code: "custom", message: "Invalid QAB order status" });
      return z.NEVER;
    }
    const trimmed = input.trim();
    if (trimmed.length < 1 || trimmed.length > ORDER_STATUS_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB order status" });
      return z.NEVER;
    }
    return trimmed;
  });
export type IQabOrderStatus = z.infer<typeof qabOrderStatusSchema>;

export function isKnownQabOrderStatus(value: string): value is IQabOrderStatusKnown {
  return (QAB_ORDER_STATUSES as readonly string[]).includes(value);
}

/** Same tolerance for cancelledBy: text, nullable, never an enum column. */
export const qabCancelledBySchema: z.ZodType<string | null, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (input === null || input === undefined) {
      return null;
    }
    if (typeof input !== "string") {
      ctx.addIssue({ code: "custom", message: "Invalid QAB cancelledBy" });
      return z.NEVER;
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.length > ORDER_STATUS_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB cancelledBy" });
      return z.NEVER;
    }
    return trimmed;
  });

export function isKnownQabCancelledBy(value: string): boolean {
  return (QAB_ORDER_CANCELLED_BY as readonly string[]).includes(value);
}
