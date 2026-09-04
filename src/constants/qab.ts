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

/* -------------------------------------------------------------------------- */
/* F-005 — STORE payload, opening hours and slug forecast                      */
/* -------------------------------------------------------------------------- */

/** Opening-hours format of contract v9. `days` has EXACTLY these seven keys. */
export const QAB_OPENING_HOURS_VERSION = 1;
export const QAB_OPENING_HOURS_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export const QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY = 4;
/** Serialised size cap, in bytes of UTF-8 JSON. */
export const QAB_OPENING_HOURS_MAX_BYTES = 2_048;
/** The only value of `to` that is not an "HH:MM" clock time. Never valid in `from`. */
export const QAB_OPENING_HOURS_END_OF_DAY = "24:00";
export const QAB_OPENING_HOURS_END_OF_DAY_MINUTES = 1_440;

/**
 * Every way an opening-hours value can be wrong. Closed vocabulary: the screen
 * maps each one to its own sentence, so acceptance criterion 8 can name the rule
 * that was broken instead of showing a generic message.
 */
export const QAB_OPENING_HOURS_ISSUE_CODES = [
  "SIZE_EXCEEDED", // serialised JSON over QAB_OPENING_HOURS_MAX_BYTES
  "NOT_AN_OBJECT", // null, an array or a primitive at the root
  "UNKNOWN_KEY", // any key the format does not declare, at any level
  "VERSION_INVALID", // `version` is not QAB_OPENING_HOURS_VERSION
  "DAYS_NOT_AN_OBJECT", // `days` missing, null, an array or a primitive
  "DAY_MISSING", // one of the seven day keys is absent
  "DAY_UNKNOWN", // a key inside `days` that is not one of the seven
  "DAY_NOT_AN_ARRAY", // a day whose value is not an array
  "TOO_MANY_WINDOWS", // more than QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY
  "WINDOW_NOT_AN_OBJECT", // an entry of a day that is not an object
  "TIME_FORMAT_INVALID", // not "HH:MM" 24h (and not "24:00" in `to`)
  "END_OF_DAY_IN_FROM", // "24:00" used as `from`
  "EMPTY_WINDOW", // `from` equals `to`: ambiguous, rejected
  "WINDOWS_UNORDERED", // windows of a day not strictly ascending by `from`
  "WINDOWS_OVERLAP", // a window starts before the previous one ends
  "OVERNIGHT_NOT_LAST", // a window with `to` < `from` that is not the last one
  "MULTIPLE_OVERNIGHT", // more than one window of the day crosses midnight
] as const;

/** cuadrecaja's own caps on the nine contact fields. The contract sets none. */
export const QAB_STORE_DESCRIPTION_MAX_LENGTH = 500;
export const QAB_STORE_ADDRESS_MAX_LENGTH = 200;
export const QAB_STORE_CITY_MAX_LENGTH = 100;
export const QAB_STORE_PROVINCE_MAX_LENGTH = 100;
export const QAB_STORE_PHONE_MAX_LENGTH = 40;
export const QAB_STORE_EMAIL_MAX_LENGTH = 254;

/** Sixth route of the contract. Appended to QAB_API_BASE_URL; never written inline. */
export const QAB_SLUG_AVAILABILITY_PATH = "/api/internal/slug-availability";

/**
 * Upper bound on the two free-text query parameters the slug forecast forwards
 * to QAB. Not a format check on purpose: an unusable candidate has to reach QAB
 * so it can answer `reason: "invalid"`, which is the only way the screen can
 * tell the merchant to pick another one. It IS a cap, so an unbounded string
 * never leaves cuadrecaja (security-guardian, F-005).
 */
export const QAB_SLUG_QUERY_MAX_LENGTH = 120;

/** The six documented values of `reason`. Parsed as an OPEN string: see ADR 0033. */
export const QAB_SLUG_REASONS = [
  "free",
  "own",
  "taken",
  "reserved",
  "retired",
  "invalid",
] as const;

/** Failure vocabulary of the slug forecast. None of these is ever an HTTP status here. */
export const QAB_SLUG_UPSTREAM_CODES = [
  "NOT_CONFIGURED", // QAB_API_BASE_URL unset, or the business has no token
  "MISSING_QUERY", // 400 from QAB: neither `slug` nor `name`
  "UNAUTHORIZED", // 401 from QAB
  "BUSINESS_INACTIVE", // 403 from QAB
  "SYNC_NOT_CONFIGURED", // 503 from QAB
  "TRANSPORT", // no HTTP response at all
  "INVALID_RESPONSE_BODY", // a response that does not satisfy the schema
  "UNEXPECTED_STATUS", // a status the contract does not document
] as const;
export const QAB_SLUG_RETRYABLE_CODES = [
  "SYNC_NOT_CONFIGURED",
  "TRANSPORT",
  "INVALID_RESPONSE_BODY",
  "UNEXPECTED_STATUS",
] as const;

/**
 * Failures that fail identically on all QAB_OUTBOX_MAX_ATTEMPTS retries because
 * nothing changes between them: the data has to be fixed in cuadrecaja first.
 */
export const QAB_OUTBOX_PERMANENT_ERROR_CODES = [
  "STORE_OPENING_HOURS_INVALID",
  "STORE_TIMEZONE_INVALID",
  "STORE_DELIVERY_CONFIG_INCONSISTENT",
] as const;

/** What the configuration screen is allowed to be told about a failed sync. */
export const QAB_STORE_SYNC_STATES = ["SYNCED", "PENDING", "FAILED", "BLOCKED"] as const;
export const QAB_STORE_SYNC_CODES = [
  "STORE_OPENING_HOURS_INVALID",
  "STORE_TIMEZONE_INVALID",
  "STORE_DELIVERY_CONFIG_INCONSISTENT",
  "BUSINESS_MISMATCH",
  "BUSINESS_INACTIVE",
  "UNAUTHORIZED",
  "INVALID_BATCH",
  "TOKEN_MISSING",
  "TRANSPORT",
  "UNKNOWN",
] as const;
/** Hard cap on the rows the sync-state query reads. Keeps the GET O(1). */
export const QAB_STORE_SYNC_STATE_MAX_ROWS = 200;

/**
 * The public storefront domain. It is the ONE place the brand is named in the
 * UI, because there the domain IS the datum: the slug field's prefix and the
 * published local's link. Everywhere else the copy says «la tienda online».
 */
export const QAB_PUBLIC_STORE_DOMAIN = "queandabuscando.com";
export const QAB_PUBLIC_STORE_URL_PREFIX = `https://${QAB_PUBLIC_STORE_DOMAIN}/`;

/* -------------------------------------------------------------------------- */
/* F-020 — Learning the slug QAB actually assigned                             */
/* -------------------------------------------------------------------------- */

/**
 * The ONLY `reason` that makes `resolvedSlug` this store's own address (ADR 0037).
 * Declared FROM the contract's vocabulary, never as a loose literal.
 */
export const QAB_SLUG_LEARNED_REASON = "own" satisfies (typeof QAB_SLUG_REASONS)[number];

/**
 * Closed vocabulary of what one learning target ended up as. Nothing from the
 * third party's body is ever mirrored here: no `reason`, no `url`, no slug.
 */
export const QAB_SLUG_LEARN_OUTCOMES = [
  "learned", // reason "own" + valid slug + updateMany count === 1
  "not_own", // reason !== "own"
  "invalid_slug", // resolvedSlug does not satisfy qabSlugSchema
  "upstream_error", // fetchQabSlugAvailability returned { kind: "error" }
  "not_written", // updateMany count !== 1 (already learned, or gone)
  "tenant_mismatch", // QabTenantMismatchError: never happens, always reported
  "skipped_no_token", // the business has no qabToken
  "skipped_deadline", // out of phase budget; recovered next run
] as const;

/** Targets attempted per run. A target left out loses NOTHING (ADR 0036c). */
export const QAB_SLUG_LEARN_MAX_PER_RUN = 20;

/** Phase budget, clamped again by QAB_SYNC_RUN_DEADLINE_MS of the whole run. */
export const QAB_SLUG_LEARN_DEADLINE_MS = 10_000;

/** Hard cap on the `Tienda` rows the backlog query reads. Documented cost of ADR 0036b. */
export const QAB_SLUG_LEARN_CANDIDATE_MAX_ROWS = 200;

/** Log prefix of the phase. Ids and codes only. */
export const QAB_SLUG_LEARN_LOG = "qab.slugLearn";
