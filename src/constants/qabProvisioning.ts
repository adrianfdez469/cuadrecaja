/**
 * Vocabulary and limits of the eighth QAB route, `POST /api/provisioning/credential`
 * (§ "Aprovisionamiento de negocios" of `sync-contract.md`, v10).
 *
 * Kept in a file of its OWN, apart from `src/constants/qab.ts`: this route has its
 * own authentication subject and its own error vocabulary, and neither is the one
 * of the seven sync routes. Two files is what makes that visible at a glance.
 * See ADR 0026.
 */

/** Path of the eighth route. Appended to QAB_API_BASE_URL; never written inline. */
export const QAB_PROVISIONING_CREDENTIAL_PATH = "/api/provisioning/credential";

/** Time budget of the call. The route declares `maxDuration = 30`. */
export const QAB_PROVISIONING_TIMEOUT_MS = 15_000;

/** Body limits, from the v10 contract. */
export const QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH = 128;
export const QAB_PROVISIONING_NAME_MAX_LENGTH = 200;
export const QAB_PROVISIONING_REQUEST_MAX_BYTES = 4_096;

/** Minimum QAB's own `readBearerToken` enforces (`despliegue.md` § 8.1). */
export const QAB_PROVISIONING_SECRET_MIN_LENGTH = 32;

/** Admissible shape of a secret or of a token: one line of printable ASCII, no spaces. */
export const QAB_BEARER_VALUE_PATTERN = /^[\x21-\x7E]+$/;

/** Limits of a hand-pasted `qabToken` (rescue path, acceptance criterion 13). */
export const QAB_TOKEN_MIN_LENGTH = 32;
export const QAB_TOKEN_MAX_LENGTH = 512;

/**
 * Failure vocabulary of the call to QAB. The FIRST SIX are the ones of criterion 8,
 * one per row of the contract's table; the last four are failures the contract does
 * not describe because they are not its own.
 */
export const QAB_PROVISIONING_UPSTREAM_CODES = [
  "INVALID_BODY", // 400
  "UNAUTHORIZED", // 401  <- NEVER re-exposed as a 401. See ADR 0022.
  "BUSINESS_INACTIVE", // 403  <- NEVER re-exposed as a 403. See ADR 0022.
  "METHOD_NOT_ALLOWED", // 405
  "PROVISIONING_NOT_CONFIGURED", // 503
  "TOKEN_COLLISION", // 503
  "TRANSPORT", // no HTTP response at all
  "INVALID_RESPONSE_BODY", // a response that does not satisfy the schema
  "UNEXPECTED_STATUS", // a status the contract does not document
  "EXTERNAL_ID_MISMATCH", // the response's `externalId` is not the one sent
] as const;

/** The ones worth retrying. TOKEN_COLLISION is the only one criterion 8 demands. */
export const QAB_PROVISIONING_RETRYABLE_CODES = [
  "TOKEN_COLLISION",
  "TRANSPORT",
  "INVALID_RESPONSE_BODY",
  "UNEXPECTED_STATUS",
] as const;

/** cuadrecaja's OWN codes. None mirrors QAB's HTTP status (ADR 0022). */
export const QAB_PROVISIONING_API_ERRORS = {
  forbidden: "FORBIDDEN", // 403 - not a SUPER_ADMIN
  negocioNotFound: "NEGOCIO_NOT_FOUND", // 404
  secretNotSet: "PROVISIONING_SECRET_NOT_SET", // 503 - criterion 9
  baseUrlNotSet: "QAB_API_BASE_URL_NOT_SET", // 503
  configInvalid: "QAB_CONFIG_INVALID", // 500
  upstream: "QAB_PROVISIONING_UPSTREAM", // 502 - the ten above
  tokenOrphaned: "QAB_TOKEN_ORPHANED", // 500 - criterion 6
  invalidToken: "INVALID_TOKEN", // 400 - hand-pasted
  invalidBody: "INVALID_BODY", // 400 - toggle
} as const;

/**
 * The unexpected 500 of the two settings routes (`GET /api/negocio/qab` and
 * `PATCH /api/negocio/[id]/qab`). Their tables read `500 {error:"..."}` and none
 * of the codes above describes "the QAB block could not be read or written".
 */
export const QAB_SETTINGS_UNAVAILABLE = "QAB_SETTINGS_UNAVAILABLE";

/**
 * Outcome of a provisioning call that got as far as talking to QAB.
 *
 * `CONFIRMED_ORPHANED` is NOT an edge case: it is what the ordinary retry returns
 * after a `PERSIST_FAILED` or a `RESPONSE_LOST`. QAB confirms the token exists on
 * its side (`200`, `token: null`) and cuadrecaja confirms it does not have it
 * (`qabTokenConfigurado: false`). It is NEVER presented as `ALREADY_MINTED`.
 */
export const QAB_PROVISIONING_RESULTS = [
  "MINTED",
  "ALREADY_MINTED",
  "CONFIRMED_ORPHANED",
] as const;

/**
 * Why automatic provisioning is not offered. A code, never a configuration value.
 *
 * THE DECLARATION ORDER IS THE PRECEDENCE, and it is the only place that order is
 * written: `resolveAutoProvisioningAvailability` walks this array and returns the
 * first reason that holds, so the two cannot drift apart.
 *
 * The secret wins over the origin because that is the order in which the
 * provisioning route checks them (secret in step 2, origin in step 3): the reason
 * the list shows has to be the one that would fail on pressing the button. If the
 * list said BASE_URL_INVALID and the POST failed on the secret, the operator would
 * fix the wrong variable and still be stuck.
 */
export const QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS = [
  "SECRET_NOT_SET",
  "SECRET_INVALID",
  "BASE_URL_NOT_SET",
  "BASE_URL_INVALID",
] as const;

/** Prefix of the criterion 6 record. This is what is grepped for in the logs. */
export const QAB_PROVISIONING_ORPHAN_LOG = "QAB_PROVISIONING_TOKEN_ORPHANED";
export const QAB_PROVISIONING_ORPHAN_REASONS = [
  "PERSIST_FAILED", // QAB answered 201 and the write in cuadrecaja failed
  "RESPONSE_LOST", // the request went out and no usable response could be read
  // The response - 201 or 200, both carry it - came back with an externalId that is
  // not the one sent. It does NOT claim a token was minted: it claims the response
  // CANNOT BE ATTRIBUTED to this business, so its state is left unestablished.
  "EXTERNAL_ID_MISMATCH",
  "CONFIRMED_ORPHANED", // QAB says it already has a token and cuadrecaja does not
] as const;
