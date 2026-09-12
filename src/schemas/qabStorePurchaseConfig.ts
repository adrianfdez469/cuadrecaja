import { z } from "zod";

import {
  QAB_AMOUNT_DECIMALS,
  QAB_CHECKOUT_MODES,
  QAB_DELIVERY_FEE_MAX_EXCLUSIVE,
  QAB_DELIVERY_FEE_MODES,
  QAB_DELIVERY_FEE_MODE_FLAT_RATE,
  QAB_ORDER_EXPIRY_HOURS_MAX,
  QAB_ORDER_EXPIRY_HOURS_MIN,
  QAB_PURCHASE_CONFIG_ISSUE_CODES,
  QAB_STORE_PURCHASE_CONFIG_KEYS,
} from "@/constants/qab";
import { hasQabScale } from "@/schemas/qabDecimals";

/**
 * The purchase configuration of one store (contract v7), and the ONE place its
 * rules are written.
 *
 * CLIENT-SAFE: the screen, the PATCH body and the payload builder all import
 * from here, so nothing of Prisma and nothing of `src/lib/` may enter this
 * module. Turning a stored `Prisma.Decimal` into a wire number is the job of
 * `src/lib/qab/qabStorePurchaseConfig.ts`, which is the only module of this
 * feature that knows that type exists.
 */

/** The wire vocabularies, and the ONE place the two enums are declared as Zod. */
export const qabCheckoutModeSchema = z.enum(QAB_CHECKOUT_MODES);
export type IQabCheckoutMode = z.infer<typeof qabCheckoutModeSchema>;

export const qabDeliveryFeeModeSchema = z.enum(QAB_DELIVERY_FEE_MODES);
export type IQabDeliveryFeeMode = z.infer<typeof qabDeliveryFeeModeSchema>;

/* -- The rules, written ONCE and reused by every border. ------------------ */

/** PURE. Finite, >= 0, at most QAB_AMOUNT_DECIMALS decimals, below the column cap. */
export function isQabDeliveryFee(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < QAB_DELIVERY_FEE_MAX_EXCLUSIVE &&
    // The two-decimal rule already has ONE definition (ADR 0047): it is reused,
    // never rewritten.
    hasQabScale(value, QAB_AMOUNT_DECIMALS)
  );
}

/** PURE. Integer within [QAB_ORDER_EXPIRY_HOURS_MIN, QAB_ORDER_EXPIRY_HOURS_MAX]. */
export function isQabOrderExpiryHours(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= QAB_ORDER_EXPIRY_HOURS_MIN &&
    value <= QAB_ORDER_EXPIRY_HOURS_MAX
  );
}

/**
 * PURE. The ONE place the contradiction is written: delivery offered, flat rate,
 * and no amount to charge. Deliberately shaped so the SAME function answers for
 * a full configuration (every key present) and for a partial payload (a key that
 * is not there is `undefined`, and `undefined === null` is false), which is
 * exactly the border the other side's schema refine can see.
 */
export function isQabPurchaseConfigInconsistent(input: {
  deliveryEnabled?: boolean;
  deliveryFeeMode?: string;
  deliveryFee?: number | null;
}): boolean {
  return (
    input.deliveryEnabled === true &&
    input.deliveryFeeMode === QAB_DELIVERY_FEE_MODE_FLAT_RATE &&
    input.deliveryFee === null
  );
}

/* -- The field schemas, built ON those predicates. ------------------------- */

/**
 * `number | null`. The `z.unknown().transform()` shape is the repository's
 * (`qabProductPriceSchema`), and it is what keeps the annotation honest under
 * `strict: false` — where a `.nullable()` inside an object silently collapses
 * into an OPTIONAL key with no `| null` (E-079). Whether `null` is accepted is
 * verified by PARSING, never by reading the inferred type.
 */
export const qabDeliveryFeeSchema: z.ZodType<number, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (input === null) return null;
    if (!isQabDeliveryFee(input)) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB delivery fee" });
      return z.NEVER;
    }
    return input as number;
  });

/** `number`. Rejects `null`, a fractional value and anything out of range. */
export const qabOrderExpiryHoursSchema: z.ZodType<number, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (!isQabOrderExpiryHours(input)) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB order expiry hours" });
      return z.NEVER;
    }
    return input as number;
  });

/** The five, together. STRICT. */
export const qabStorePurchaseConfigSchema = z
  .object({
    checkoutMode: qabCheckoutModeSchema,
    deliveryEnabled: z.boolean(),
    deliveryFee: qabDeliveryFeeSchema,
    deliveryFeeMode: qabDeliveryFeeModeSchema,
    orderExpiryHours: qabOrderExpiryHoursSchema,
  })
  .strict();
export type IQabStorePurchaseConfig = z.infer<typeof qabStorePurchaseConfigSchema>;

/**
 * What changed in ONE operation: only the keys that did, carrying the value they
 * ended up with. A key that did not change is NOT here — not even as
 * `undefined`. See ADR ADRIAN-0152 (b).
 */
export const qabStorePurchaseConfigChangesSchema = qabStorePurchaseConfigSchema.partial();
export type IQabStorePurchaseConfigChanges = z.infer<
  typeof qabStorePurchaseConfigChangesSchema
>;

/** One broken rule, ready for the screen. Same shape as F-005's opening-hours issue. */
export const qabPurchaseConfigIssueSchema = z
  .object({
    code: z.enum(QAB_PURCHASE_CONFIG_ISSUE_CODES),
    field: z.enum(QAB_STORE_PURCHASE_CONFIG_KEYS),
  })
  .strict();
export type IQabPurchaseConfigIssue = z.infer<typeof qabPurchaseConfigIssueSchema>;
export type IQabPurchaseConfigIssueCode = IQabPurchaseConfigIssue["code"];
