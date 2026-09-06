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

/**
 * How one business's slot of a sync phase ended. Shared vocabulary of the drain
 * report and of the availability phase report (F-007).
 *
 * It is DECLARED here and re-exported by `src/schemas/qabSync.ts`, which stays
 * its import site for every consumer. Declaring it inside that schema module
 * would put a value edge from `qabAvailability.ts` back to `qabSync.ts`, which
 * already imports the availability phase report: the two modules would form a
 * cycle and whichever loaded first would evaluate a `z.enum(undefined)`.
 */
export const QAB_BUSINESS_OUTCOMES = ["ok", "error", "skipped_no_token", "skipped_deadline"] as const;

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

/* -------------------------------------------------------------------------- */
/* F-019 — Outbox purge cron                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How long a row that reached QAB is kept. Measured on `procesadoAt`.
 * See ADR 0039 for why this window and why the exhausted one is longer.
 */
export const QAB_OUTBOX_PROCESSED_TTL_DAYS = 30;

/**
 * How long an EXHAUSTED row is kept: `procesadoAt IS NULL` and
 * `intentos >= QAB_OUTBOX_MAX_ATTEMPTS`, which the drain never claims again.
 * Measured on `ocurridoAt`, the only timestamp such a row ever gets. ADR 0039.
 */
export const QAB_OUTBOX_EXHAUSTED_TTL_DAYS = 90;

/** Rows per DELETE statement. Same size as the drain's claim batch. */
export const QAB_OUTBOX_PURGE_BATCH_SIZE = 500;

/** Statements per phase and run: caps one run at 20 000 rows per phase. */
export const QAB_OUTBOX_PURGE_MAX_BATCHES_PER_RUN = 40;

/** Budget of a whole run. The route's maxDuration is 60 s. */
export const QAB_OUTBOX_PURGE_RUN_DEADLINE_MS = 45_000;

/** The two independent phases of one run, in the order they execute. ADR 0040. */
export const QAB_OUTBOX_PURGE_PHASES = ["exhausted", "processed"] as const;

/** Why the batch loop of a phase stopped. Closed vocabulary. */
export const QAB_OUTBOX_PURGE_STOP_REASONS = ["drained", "deadline", "batch_cap"] as const;

/** Partial index covering the purge's `processed` phase. See ADR 0041. */
export const QAB_OUTBOX_PURGABLE_INDEX_NAME = "idx_outbox_purgable";

/** Log prefix of the purge run. Counts and codes only: no ids, no negocioId. */
export const QAB_OUTBOX_PURGE_LOG = "qab.outboxPurge";

/** Error code of the cron endpoint's 500 response. */
export const QAB_OUTBOX_PURGE_API_ERRORS = {
  purgeFailed: "QAB_OUTBOX_PURGE_FAILED",
} as const;

/* -------------------------------------------------------------------------- */
/* F-006 — PRODUCT, CATEGORY, CURRENCY and EXCHANGE_RATE payloads              */
/* -------------------------------------------------------------------------- */

/**
 * `OutboxEvento.entidad` of each entity of this feature. Declared FROM
 * QAB_OUTBOX_ENTITIES with `satisfies`, never as loose literals: a rename in the
 * contract's vocabulary then fails the build instead of silently matching no
 * rows. Same shape as F-005's QAB_STORE_ENTITY, which stays where it is.
 */
export const QAB_PRODUCT_ENTITY = "PRODUCT" satisfies (typeof QAB_OUTBOX_ENTITIES)[number];
export const QAB_CATEGORY_ENTITY = "CATEGORY" satisfies (typeof QAB_OUTBOX_ENTITIES)[number];
export const QAB_CURRENCY_ENTITY = "CURRENCY" satisfies (typeof QAB_OUTBOX_ENTITIES)[number];
export const QAB_EXCHANGE_RATE_ENTITY = "EXCHANGE_RATE" satisfies (typeof QAB_OUTBOX_ENTITIES)[number];

/**
 * Dependency order of ONE emission, and the ONE place it is written.
 * CATEGORY before the PRODUCTs that reference it; CURRENCY before the first
 * EXCHANGE_RATE of that currency. Both failures are silent on the other side.
 * See ADR 0043.
 */
export const QAB_CATALOG_EMISSION_ORDER = [
  QAB_CURRENCY_ENTITY,
  QAB_EXCHANGE_RATE_ENTITY,
  QAB_CATEGORY_ENTITY,
  QAB_PRODUCT_ENTITY,
] as const;

/** ISO 4217. The contract wants EXACTLY three characters and rejects anything else. */
export const QAB_CURRENCY_CODE_LENGTH = 3;

/** The anchor currency. An EXCHANGE_RATE of CUP against itself never travels. */
export const QAB_ANCHOR_CURRENCY_CODE = "CUP";

/**
 * `ExchangeRate.rate` is Decimal(18,6) on the other side: SIX decimals.
 * QAB_AMOUNT_DECIMALS (= 2) is the scale of `price` and does NOT apply here.
 */
export const QAB_EXCHANGE_RATE_DECIMALS = 6;

/**
 * Upper bound on the businesses one global mutation fans out to.
 *
 * The two caps mean DIFFERENT things and that is why they are two constants:
 * a truncated CURRENCY fan-out still fixes the row for everyone (the table is
 * global, one delivery is enough), while a truncated CATEGORY cascade leaves the
 * remaining businesses with the old name. See ADR 0044 and ADR 0046.
 */
export const QAB_CATEGORY_CASCADE_MAX_BUSINESSES = 200;
export const QAB_CURRENCY_FANOUT_MAX_BUSINESSES = 50;

/**
 * Why building a catalog payload refused. Closed vocabulary: these codes reach
 * the screen as the body of a 409, and never a third party's text.
 */
export const QAB_CATALOG_EMISSION_ERRORS = {
  priceInvalid: "QAB_PRICE_INVALID",
  currencyCodeInvalid: "QAB_CURRENCY_CODE_INVALID",
  exchangeRateTooSmall: "QAB_EXCHANGE_RATE_TOO_SMALL",
} as const;

/** Page size of the publishing screen's product listing. */
export const QAB_PRODUCT_PAGE_SIZE_DEFAULT = 50;
export const QAB_PRODUCT_PAGE_SIZE_MAX = 100;

/**
 * Hard cap on the products ONE bulk action may touch. Above it the route refuses
 * with 409 and writes nothing: a bulk action is all-or-nothing (criterion 6), and
 * half a category published is worse than none.
 */
export const QAB_PRODUCT_BULK_MAX = 500;

/** Cap on the listing's free-text search. An unbounded LIKE never leaves cuadrecaja. */
export const QAB_PRODUCT_SEARCH_MAX_LENGTH = 80;

/** Log prefix of one applied publish/unpublish. Ids and counts only, never a payload. */
export const QAB_PRODUCT_PUBLISH_AUDIT_LOG = "TIENDA_ONLINE_PRODUCTO_PUBLICADO" as const;

/* -------------------------------------------------------------------------- */
/* F-006 — hardening of the global `Moneda` text (criterion 20)                */
/* -------------------------------------------------------------------------- */

/**
 * Caps on `Moneda.nombre` and `Moneda.simbolo`, measured AFTER trimming.
 *
 * They are OURS, not the contract's: the QAB contract declares no limit for
 * `CURRENCY.name` or `CURRENCY.symbol`. We set them because that text lands in a
 * table that is GLOBAL to the platform and is shown in the public storefront of
 * OTHER businesses, which no tenant can opt out of. Two constants and not one,
 * because a symbol is a different kind of thing from a name.
 *
 * Sized against the real catalog, not guessed: the longest ISO 4217 names sit
 * around 30 characters, and the longest symbols in use are a handful of code
 * points. See ADR 0044.
 */
export const QAB_CURRENCY_NAME_MAX_LENGTH = 40;
export const QAB_CURRENCY_SYMBOL_MAX_LENGTH = 8;

/**
 * Characters `Moneda.nombre` and `Moneda.simbolo` may never contain. A DENY list
 * and not an allow list on purpose: currency names and symbols are legitimately
 * written in many scripts, and an allow list would reject correct data while
 * adding nothing this list does not already cover.
 *
 * What it denies, and why each group:
 *  - C0 and C1 control characters, and the BOM: invisible, and they survive into
 *    logs and into the other side's database.
 *  - Zero-width and bidirectional formatting characters (U+200B-U+200F,
 *    U+2028/U+2029, U+202A-U+202E, U+2066-U+2069): text that renders as
 *    something other than what it is.
 *  - Markup and quoting characters. The public storefront is not ours and we do
 *    not get to assume how it escapes what we send it.
 */
export const QAB_CURRENCY_TEXT_FORBIDDEN_PATTERN =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF<>&"'`\\]/u;

/* -------------------------------------------------------------------------- */
/* F-007 — Availability convergence                                            */
/* -------------------------------------------------------------------------- */

/** Second sync route of the contract. Appended to QAB_API_BASE_URL; never inline. */
export const QAB_AVAILABILITY_SYNC_PATH = "/api/internal/sync/availability";

/**
 * THE availability CASE. The one and only place this expression is written.
 *
 * Copied CHARACTER BY CHARACTER, indentation included, from the migration that
 * created QAB_DIVERGENCE_INDEX_NAME (QAB_DIVERGENCE_INDEX_MIGRATION_PATH). The
 * planner matches a partial index by comparing NORMALISED expression trees, not
 * text, so whitespace is free and operand types are not — but an identical copy
 * is the only thing an automated check can verify without reimplementing that
 * normalisation. Divergence between the two makes the index unusable and turns
 * the query into a full scan of the catalog, with no error of any kind.
 *
 * Interpolated with `Prisma.raw` in the two places of ONE statement that need
 * it. Never rewritten anywhere else. See ADR 0048.
 */
export const QAB_AVAILABILITY_CASE_SQL = `CASE WHEN existencia <= 0             THEN 'OUT_OF_STOCK'
            WHEN existencia <= "umbralBajo"  THEN 'LOW_STOCK'
            ELSE                                  'AVAILABLE' END`;

/** Repository-relative. Read by the drift test, never at runtime. */
export const QAB_DIVERGENCE_INDEX_MIGRATION_PATH =
  "prisma/migrations/20260901225538_qab_idx_disp_divergente/migration.sql";

/**
 * Items per request. The contract's own cap; a page is never empty and never
 * larger. Sending fewer is allowed — the contract tolerates up to 2000, it does
 * not require them.
 *
 * NEVER change this number without recomputing
 * QAB_AVAILABILITY_MAX_RESPONSE_BYTES below: a full confirmation of one page is
 * a response of BATCH_SIZE entries, and a cap smaller than that page stalls the
 * business FOREVER. See ADR 0051.
 */
export const QAB_AVAILABILITY_BATCH_SIZE = 2_000;

/**
 * Upper bound, in bytes, of ONE entry of `confirmed`: the pair
 * `["<ProductoTienda.id>","<Tienda.id>"]` plus its separating comma. A pair of
 * uuids measures 80 bytes; this budget covers ids of about 60 characters each,
 * so it does not depend on every id being a uuid.
 */
export const QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES = 128;

/** Everything of the response that is not a `confirmed` entry, with slack. */
export const QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES = 1_024;

/**
 * Response cap of the availability client. COMPUTED, not chosen: it is exactly
 * what a full confirmation of one page can measure, so the two constants can
 * never again be set independently.
 *
 * Availability does NOT reuse QAB_HTTP_MAX_RESPONSE_BYTES (100 000), the cap of
 * the catalog and provisioning clients. That number bounds a response whose size
 * WE do not determine; here the well-formed response is bounded by the page we
 * ourselves sent, and 100 000 bytes cuts a page off at ~1250 confirmations. See
 * ADR 0051.
 */
export const QAB_AVAILABILITY_MAX_RESPONSE_BYTES =
  QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES +
  QAB_AVAILABILITY_BATCH_SIZE * QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES;

/**
 * Divergent rows ONE run reads, across every eligible business. Above
 * QAB_AVAILABILITY_BATCH_SIZE on purpose: a single business with more than one
 * page has to produce more than one request in the same run (criterion 10).
 * What does not fit stays divergent and is read by the next run.
 */
export const QAB_AVAILABILITY_MAX_ROWS_PER_RUN = 6_000;

/** Phase budget, clamped again by QAB_SYNC_RUN_DEADLINE_MS of the whole run. */
export const QAB_AVAILABILITY_DEADLINE_MS = 10_000;

/** Log prefix of the phase. Ids and counts only: never a payload, never a body. */
export const QAB_AVAILABILITY_LOG = "qab.availability";

/* -------------------------------------------------------------------------- */
/* F-010 — Incoming order pull                                                 */
/* -------------------------------------------------------------------------- */

/** Orders asked for in ONE request. The contract's own page size (§ ③④). */
export const QAB_ORDER_PULL_PAGE_SIZE = 100;

/**
 * Page sizes the pull walks down, and ONLY on a RESPONSE_TOO_LARGE, always over
 * the SAME `since`. Any other failure ends the business instead: shrinking the
 * page does not fix a 401. See ADR 0055.
 */
export const QAB_ORDER_PULL_PAGE_SIZE_LADDER = [100, 10, 1] as const;

/**
 * Requests one run issues for ONE business, ladder retries included. Bounds the
 * WRITES of one transaction; the time budget below bounds its DURATION. Two
 * constants because they cover cases the other one does not see. ADR 0054.
 */
export const QAB_ORDER_PULL_MAX_PAGES_PER_RUN = 5;

/**
 * Per-business budget INSIDE the locked transaction, well under
 * QAB_ORDER_POLL_TX_TIMEOUT_MS (30 000): blowing that timeout rolls the whole
 * transaction back, so nothing is written AND the cursor does not advance.
 */
export const QAB_ORDER_PULL_BUDGET_MS = 15_000;

/** Budget of the whole poll loop, clamped again by QAB_SYNC_RUN_DEADLINE_MS. */
export const QAB_ORDER_POLL_PHASE_DEADLINE_MS = 20_000;

/* -- Caps of ONE order. Ours, not the contract's: it declares none. --------- */

export const QAB_ORDER_CODE_MAX_LENGTH = 64;
export const QAB_ORDER_CONTACT_MAX_LENGTH = 300;
export const QAB_ORDER_TEXT_MAX_LENGTH = 1_000;
export const QAB_ORDER_URL_MAX_LENGTH = 2_048;
export const QAB_ORDER_LINE_NAME_MAX_LENGTH = 120;
export const QAB_ORDER_CURRENCY_CODE_MAX_LENGTH = 8;
export const QAB_ORDER_MAX_LINES = 100;
export const QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES = 4_096;

/**
 * The only scheme `customerWhatsappUrl` may carry. Anything else is stored as
 * NULL, never rejected: F-011 renders that value as a link.
 */
export const QAB_ORDER_URL_REQUIRED_PREFIX = "https://";

/* -- Response budget. COMPUTED, never chosen. See ADR 0055. ---------------- */

/** Everything of the page that is not an order, with slack. */
export const QAB_ORDER_PULL_RESPONSE_ENVELOPE_MAX_BYTES = 1_024;

/** Everything of ONE order that is not a line, with slack for multi-byte text. */
export const QAB_ORDER_ENVELOPE_MAX_BYTES = 20_480;

/** Upper bound of ONE serialised line. */
export const QAB_ORDER_LINE_MAX_BYTES = 1_024;

/**
 * WORST case of one order, DERIVED from the caps this contract already enforces
 * while parsing. It is the FLOOR of the response cap, so an order that respects
 * our own caps always fits — even asked for one at a time, which is what makes
 * the ladder of ADR 0055 an actual escape instead of a smaller failure.
 */
export const QAB_ORDER_MAX_BYTES =
  QAB_ORDER_ENVELOPE_MAX_BYTES + QAB_ORDER_MAX_LINES * QAB_ORDER_LINE_MAX_BYTES;

/** Roomy upper bound of a NORMAL order. What sizes a page. */
export const QAB_ORDER_TYPICAL_MAX_BYTES = 16_384;

/* -- Column ranges. The border where an absurd wire amount is refused. ----- */

/** Decimal(14, 2): 14 - QAB_AMOUNT_DECIMALS integer digits. */
export const QAB_AMOUNT_MAX_INTEGER_DIGITS = 12;
/** Decimal(14, 3): 14 - QAB_QUANTITY_DECIMALS integer digits. */
export const QAB_QUANTITY_MAX_INTEGER_DIGITS = 11;

/* -- Closed vocabularies. ------------------------------------------------- */

/** How ONE business's pull ended. Declared HERE, never inside a schema module. */
export const QAB_ORDER_PULL_OUTCOMES = [
  "ok", // every page attempted answered 200 and was written
  "error", // a transport, status or body failure; nothing written for it this run
  "skipped_no_token", // the business has no token
  "skipped_locked", // another run held the advisory lock
  "skipped_deadline", // the phase ran out of budget before its turn
] as const;

/** State of the advisory lock for one business of the loop. */
export const QAB_ORDER_POLL_LOCK_STATES = [
  "acquired",
  "skipped_locked",
  "not_attempted", // out of phase budget: the lock is never taken in vain
  /**
   * The slot threw. Whether pg_try_advisory_xact_lock ever ran is NOT knowable
   * from outside: a pool failure before that statement and a rollback in the
   * middle of the writes both surface as an exception, and a P2028 covers both
   * "maxWait expired, the transaction never started" and "the timeout fired
   * while `run` was executing". Reporting "acquired" here would be a guess
   * dressed as a fact, so the report says it does not know.
   */
  "unknown",
] as const;

/** Why ONE order was refused. Closed: these codes reach a log, nothing else. */
export const QAB_ORDER_REJECT_REASONS = [
  "INVALID_ORDER", // does not satisfy qabPulledOrderSchema
  "AMOUNT_OUT_OF_RANGE", // an amount does not fit Decimal(14, 2)
  "QUANTITY_OUT_OF_RANGE", // a quantity does not fit Decimal(14, 3)
  "TOO_MANY_LINES", // over QAB_ORDER_MAX_LINES
  "RATE_SNAPSHOT_TOO_LARGE", // over QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES
] as const;

/** Log prefix of the pull. Ids and counts only: NEVER an Order.code, never a body. */
export const QAB_ORDER_PULL_LOG = "qab.orderPull";
export const QAB_ORDER_PULL_REJECTED_LOG = "qab.orderPull.rejected";
/** One business's slot threw. Carries an id and a code, NEVER the error text. */
export const QAB_ORDER_PULL_FAILED_LOG = "qab.orderPull.failed";

/** Reported when the thrown error is not a Prisma error with a `code`. */
export const QAB_ORDER_PULL_UNKNOWN_ERROR_CODE = "UNKNOWN";

/* -------------------------------------------------------------------------- */
/* F-012 — Reporting an order's progress back to QAB                           */
/* -------------------------------------------------------------------------- */

/** Status-report route of the contract. Appended to QAB_API_BASE_URL; never inline. */
export const QAB_ORDER_STATUS_PATH = "/api/internal/orders/status";

/**
 * The SIX values `POST /api/internal/orders/status` accepts (contract v10.1,
 * § ③④). Declared FROM QAB_ORDER_STATUSES with `satisfies`, never as loose
 * literals: a rename in the contract's vocabulary then fails the build.
 *
 * The three that are NOT here are not an oversight. `AWAITING_CUSTOMER` is set
 * by `POST /orders/proposal` alone and answers 400 on this route; `PENDING` and
 * `PULLED` are states QAB owns, and the POS never reports them.
 */
export const QAB_ORDER_STATUS_REPORTABLE = [
  "CONFIRMED",
  "READY",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "REJECTED_BY_STORE",
] as const satisfies ReadonlyArray<(typeof QAB_ORDER_STATUSES)[number]>;

/**
 * The forward sequence a store-driven order walks, and the ONLY place it is
 * written. Feeds `offerOrderStatusTransitions`; nothing else rebuilds it.
 *
 * `AWAITING_CUSTOMER` is deliberately absent: it is a branch off this line, not
 * a step along it. See ADR 0065.
 */
export const QAB_ORDER_STATUS_SEQUENCE = [
  "PULLED",
  "CONFIRMED",
  "READY",
  "IN_TRANSIT",
  "DELIVERED",
] as const satisfies ReadonlyArray<(typeof QAB_ORDER_STATUSES)[number]>;

/**
 * Why reporting a status failed. CLOSED vocabulary: these codes are the only
 * thing that ever crosses back from the QAB call, and nothing from the other
 * side's body is ever mirrored here. See ADR 0064.
 */
export const QAB_ORDER_STATUS_FAILURE_CODES = [
  "NOT_CONFIGURED", // QAB_API_BASE_URL unset, or the business has no token
  "INVALID_BODY", // 400 from QAB
  "UNAUTHORIZED", // 401 from QAB
  "BUSINESS_INACTIVE", // 403 from QAB
  "UNKNOWN_ORDER", // 404 from QAB
  "ORDER_DELIVERY_NOT_QUOTED", // 409 from QAB
  "SYNC_NOT_CONFIGURED", // 503 from QAB
  "UNEXPECTED_STATUS", // a status the contract does not document for this route
  "TRANSPORT", // no HTTP response at all
  "INVALID_RESPONSE_BODY", // a 200 whose body is not `{ ok: true }`
] as const;

/**
 * The three failures a person may usefully try again. The other seven fail the
 * same way every time until something outside this request changes.
 *
 * ORDER_DELIVERY_NOT_QUOTED is OUT on purpose, and that is acceptance criterion
 * 4 in executable form: what unblocks it is a quote, not a repetition. F-015
 * inherits this frontier and does not move the code into this list.
 *
 * `true` here NEVER means the server retried. Nothing in this feature retries.
 */
export const QAB_ORDER_STATUS_RETRYABLE_CODES = [
  "TRANSPORT",
  "INVALID_RESPONSE_BODY",
  "UNEXPECTED_STATUS",
] as const satisfies ReadonlyArray<(typeof QAB_ORDER_STATUS_FAILURE_CODES)[number]>;

/**
 * Cap on the ONLY body this client ever reads: the 200, whose documented shape
 * is a single boolean field. It is not derived from a page size because there is
 * no page here — the size of a well-formed response does not depend on anything
 * the caller sends, so there is no way for our own answer not to fit (E-029).
 *
 * The bodies of the error responses are NOT read at all: the stream is cancelled
 * and the outcome comes from the status. No cap governs them.
 */
export const QAB_ORDER_STATUS_MAX_RESPONSE_BYTES = 1_024;

/**
 * The ONE host `customerWhatsappUrl` may point at.
 *
 * Read from contract v10.1 § ③④, where both examples of the field are
 * `https://wa.me/<digits>?text=...` and no other host appears anywhere in the
 * document.
 *
 * It is a SEPARATE constant from QAB_ORDER_URL_REQUIRED_PREFIX and does not
 * replace it: that one guards what the pull WRITES, this one guards what the
 * detail response HANDS THE BROWSER TO FOLLOW. `https://` alone is satisfied by
 * every address on the internet (ADR 0066).
 */
export const QAB_ORDER_WHATSAPP_HOST = "wa.me";
