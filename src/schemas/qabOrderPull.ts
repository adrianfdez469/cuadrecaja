import { z } from "zod";
import {
  QAB_ORDER_CODE_MAX_LENGTH,
  QAB_ORDER_CONTACT_MAX_LENGTH,
  QAB_ORDER_CURRENCY_CODE_MAX_LENGTH,
  QAB_ORDER_LINE_NAME_MAX_LENGTH,
  QAB_ORDER_TEXT_MAX_LENGTH,
  QAB_ORDER_URL_MAX_LENGTH,
} from "@/constants/qab";
import { qabAmountSchema, qabQuantitySchema } from "@/schemas/qabAmount";
import {
  qabCancelledBySchema,
  qabOrderIdSchema,
  qabOrderStatusSchema,
} from "@/schemas/qabOrder";

/**
 * The wire parser of the incoming order pull (F-010).
 *
 * This module is deliberately NOT imported by `@/schemas/qabSync`: the pull's
 * phase report stays where F-002 put it, and a value edge in both directions
 * between two modules that evaluate Zod schemas at the top level breaks at LOAD
 * time while `tsc --noEmit` stays green (E-028).
 */

/** Issue messages are fixed strings of OUR code: never a value of the body. */
const INVALID_CURSOR_MESSAGE = "Invalid QAB order cursor";

/** `null` when absent; the id otherwise. `nextCursor: null` means "up to date". */
export const qabNullableOrderIdSchema: z.ZodType<string | null, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (input === null || input === undefined) {
      return null;
    }
    const parsed = qabOrderIdSchema.safeParse(input);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: INVALID_CURSOR_MESSAGE });
      return z.NEVER;
    }
    return parsed.data;
  });

/** An ISO-8601 instant, or `null` when absent or unparseable. NEVER rejects. */
export const qabOrderTimestampSchema: z.ZodType<Date | null, unknown> = z
  .unknown()
  .transform((input) => {
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input;
    }
    if (typeof input !== "string") {
      return null;
    }
    const parsed = new Date(input.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

/**
 * `deliveryFeePending`, verbatim from the wire. `true` ONLY when the value is
 * the boolean `true`; absent, null or anything else yields `false`, which is the
 * pre-v6 meaning.
 *
 * NEVER derived. A quoted order and one with the delivery given away carry the
 * SAME `deliveryFee: "0.00"`, and this flag is the only thing that separates
 * them: reading the amounts, or `contact.address`, or comparing `total` with
 * `subtotal`, is right today and undercharges on the first free delivery.
 */
export const qabDeliveryFeePendingSchema: z.ZodType<boolean, unknown> = z
  .unknown()
  .transform((input) => input === true);

export const qabOrderContactSchema = z.object({
  name: z.string().max(QAB_ORDER_CONTACT_MAX_LENGTH).nullish(),
  phone: z.string().max(QAB_ORDER_CONTACT_MAX_LENGTH).nullish(),
  email: z.string().max(QAB_ORDER_CONTACT_MAX_LENGTH).nullish(),
  address: z.string().max(QAB_ORDER_CONTACT_MAX_LENGTH).nullish(),
});
export type IQabOrderContact = z.infer<typeof qabOrderContactSchema>;

export const qabOrderLineSchema = z.object({
  storeProductExternalId: z.string().min(1).nullish(),
  name: z.string().min(1).max(QAB_ORDER_LINE_NAME_MAX_LENGTH),
  unitPrice: qabAmountSchema,
  currencyCode: z.string().min(1).max(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
  quantity: qabQuantitySchema,
  lineTotal: qabAmountSchema,
  originalUnitPrice: qabAmountSchema.nullish(),
  originalCurrencyCode: z.string().min(1).max(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH).nullish(),
  originalLineTotal: qabAmountSchema.nullish(),
});
export type IQabOrderLine = z.infer<typeof qabOrderLineSchema>;

/** Present ONLY while status is AWAITING_CUSTOMER. `proposal.items` never travels. */
export const qabOrderProposalSchema = z.object({
  proposedAt: qabOrderTimestampSchema,
  expiresAt: qabOrderTimestampSchema,
  previousTotal: qabAmountSchema.nullish(),
  subtotal: qabAmountSchema.nullish(),
  discountTotal: qabAmountSchema.nullish(),
  deliveryFee: qabAmountSchema.nullish(),
  total: qabAmountSchema.nullish(),
  message: z.string().max(QAB_ORDER_TEXT_MAX_LENGTH).nullish(),
});
export type IQabOrderProposal = z.infer<typeof qabOrderProposalSchema>;

export const qabPulledOrderSchema = z.object({
  id: qabOrderIdSchema,
  /** Public credential of the buyer's page. Parsed, stored, NEVER logged. */
  code: z.string().min(1).max(QAB_ORDER_CODE_MAX_LENGTH),
  storeExternalId: z.string().min(1),
  /** Free text on purpose: a tenth enum value must never break the pull. */
  status: qabOrderStatusSchema,
  cancelledBy: qabCancelledBySchema,
  contact: qabOrderContactSchema.nullish(),
  currencyCode: z.string().min(1).max(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
  subtotal: qabAmountSchema,
  discountTotal: qabAmountSchema,
  deliveryFee: qabAmountSchema,
  total: qabAmountSchema,
  deliveryFeePending: qabDeliveryFeePendingSchema,
  /** Opaque. Stored verbatim, never recomputed and never rewritten. */
  rateSnapshot: z.unknown(),
  notes: z.string().max(QAB_ORDER_TEXT_MAX_LENGTH).nullish(),
  customerWhatsappUrl: z.string().max(QAB_ORDER_URL_MAX_LENGTH).nullish(),
  proposal: qabOrderProposalSchema.nullish(),
  createdAt: qabOrderTimestampSchema,
  items: z.array(qabOrderLineSchema).default([]),
});
export type IQabPulledOrder = z.infer<typeof qabPulledOrderSchema>;

/**
 * The incremental pull's page. `orders` is deliberately `unknown[]`: each order
 * is parsed on its own so one bad order cannot cost the whole page (ADR 0053).
 *
 * NOT `.strict()`, on purpose. `nextAfter` — the lateral reads' cursor (v8) —
 * never travels on this route, and this parser must neither expect it nor fail
 * the day it appears.
 */
export const qabOrdersPageSchema = z.object({
  orders: z.array(z.unknown()).default([]),
  nextCursor: qabNullableOrderIdSchema,
});
export type IQabOrdersPage = z.infer<typeof qabOrdersPageSchema>;

/**
 * PURE. The order id of a raw element, or `null` when it cannot be read. Used to
 * advance the cursor past an order the full schema refused (ADR 0053).
 */
export function readQabOrderId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const parsed = qabOrderIdSchema.safeParse((raw as { id?: unknown }).id);
  return parsed.success ? parsed.data : null;
}

/**
 * Scaled integer of an already-normalised amount. The scale is fixed by
 * `qabAmountSchema`, so dropping the point is exact; `BigInt(...)` and never the
 * literal form, because the target is ES2017 (E-003).
 */
function toScaledAmount(amount: string): bigint {
  const negative = amount.startsWith("-");
  const digits = (negative ? amount.slice(1) : amount).replace(".", "");
  const value = BigInt(digits);
  return negative ? -value : value;
}

/**
 * PURE. The two identities of § ③④, and there are TWO, not one:
 *   deliveryFeePending false -> total = subtotal - discountTotal + deliveryFee
 *   deliveryFeePending true  -> total = subtotal - discountTotal   (PARTIAL)
 *
 * Compared as scaled integers with BigInt, never as strings and never as
 * Numbers. `BigInt(0)`, never the literal `0n`: the target is ES2017 (E-003).
 *
 * `false` does NOT reject the order: it only feeds `inconsistentTotals`. ADR 0053.
 */
export function qabOrderTotalsAreConsistent(order: IQabPulledOrder): boolean {
  const subtotal = toScaledAmount(order.subtotal);
  const discountTotal = toScaledAmount(order.discountTotal);
  const deliveryFee = toScaledAmount(order.deliveryFee);
  const total = toScaledAmount(order.total);

  const net = subtotal - discountTotal;
  return total === (order.deliveryFeePending ? net : net + deliveryFee);
}
