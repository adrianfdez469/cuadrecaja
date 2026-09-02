/**
 * Shared constants of the queandabuscando (QAB) online store integration.
 *
 * Wire values are stored verbatim, in English, exactly as the contract publishes
 * them: nothing here is translated on the way in or on the way out.
 */

/** The nine order states of the contract (v5). The enum already grew once: see ADR 0004. */
export const QAB_ORDER_STATUSES = [
  "PENDING",
  "PULLED",
  "CONFIRMED",
  "AWAITING_CUSTOMER",
  "READY",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "REJECTED_BY_STORE",
] as const;

export const QAB_ORDER_CANCELLED_BY = ["CUSTOMER", "EXPIRY", "STORE"] as const;

export const QAB_AVAILABILITY = ["OUT_OF_STOCK", "LOW_STOCK", "AVAILABLE"] as const;

export const QAB_OUTBOX_ENTITIES = [
  "STORE",
  "CATEGORY",
  "PRODUCT",
  "CURRENCY",
  "EXCHANGE_RATE",
] as const;

export const QAB_OUTBOX_OPERATIONS = ["CREATE", "UPDATE", "DELETE"] as const;

/** Head-of-line blocking guard from the contract's drain query. */
export const QAB_OUTBOX_MAX_ATTEMPTS = 6;
export const QAB_OUTBOX_BATCH_SIZE = 500;

export const QAB_DIVERGENCE_INDEX_NAME = "idx_disp_divergente";
export const QAB_UNPUBLISH_REASON_MAX_LENGTH = 160;
export const QAB_AMOUNT_DECIMALS = 2;
export const QAB_QUANTITY_DECIMALS = 3;
