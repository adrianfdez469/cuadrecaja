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

/* -------------------------------------------------------------------------- */
/* F-002 — Outbox drain and sync cron                                          */
/* -------------------------------------------------------------------------- */

/** Paths of the contract. Appended to QAB_API_BASE_URL; never written inline. */
export const QAB_CATALOG_SYNC_PATH = "/api/internal/sync/catalog";
export const QAB_ORDERS_PULL_PATH = "/api/internal/orders"; // reserved for F-010

/** Values of `results[].status` in the 207. For logs and typing only: NOT validated against. */
export const QAB_CATALOG_RESULT_STATUSES = [
  "processed",
  "duplicate",
  "skipped_not_published",
  "stale",
  "failed",
] as const;

/** Time budget of one run. The route's maxDuration is 60 s. */
export const QAB_HTTP_TIMEOUT_MS = 10_000;
export const QAB_SYNC_RUN_DEADLINE_MS = 35_000;
export const QAB_SYNC_TX_TIMEOUT_MS = 45_000;
export const QAB_SYNC_TX_MAX_WAIT_MS = 10_000;

/**
 * Size cap on the QAB response body that `postQabCatalogBatch` ever materialises
 * in memory. Security finding (security-guardian, F-002): a third party — or a
 * mispointed `QAB_API_BASE_URL` — can answer with an arbitrarily large body, and
 * a serverless function must not read it whole before discarding it.
 */
export const QAB_HTTP_MAX_RESPONSE_BYTES = 100_000;

/** Reason reported when the response body exceeds QAB_HTTP_MAX_RESPONSE_BYTES. */
export const QAB_HTTP_RESPONSE_TOO_LARGE_REASON = "RESPONSE_TOO_LARGE";

/** Order-poll slot (F-010 fills it in). */
export const QAB_ORDER_POLL_LOCK_NAMESPACE = "qab:order-poll:";
export const QAB_ORDER_POLL_TX_TIMEOUT_MS = 30_000;
export const QAB_ORDER_POLL_TX_MAX_WAIT_MS = 5_000;

/** Partial index covering the drain query. See ADR 0012. */
export const QAB_OUTBOX_PENDING_INDEX_NAME = "idx_outbox_pendiente";

/** `OutboxEvento.ultimoError`: maximum length and code prefixes. See ADR 0011. */
export const QAB_OUTBOX_ERROR_MAX_LENGTH = 500;
export const QAB_OUTBOX_ERROR_CODES = {
  transport: "TRANSPORT",
  http: "HTTP",
  event: "EVENT",
  missingInResponse: "MISSING_IN_RESPONSE",
  invalidResponseBody: "INVALID_RESPONSE_BODY",
  tokenMissing: "QAB_TOKEN_MISSING",
} as const;

/** Default size of the dedicated `qabPrisma` connection pool. See ADR 0015. */
export const QAB_SYNC_DB_CONNECTION_LIMIT_DEFAULT = 2;

/** Reported in `IQabSyncRunReport.skipped` when QAB_API_BASE_URL is unset. ADR 0014. */
export const QAB_SYNC_SKIPPED_NO_BASE_URL = "QAB_API_BASE_URL_NOT_SET" as const;

/** Error codes of the cron endpoint's 500 responses. */
export const QAB_SYNC_API_ERRORS = {
  configInvalid: "QAB_CONFIG_INVALID",
  syncFailed: "QAB_SYNC_FAILED",
} as const;
