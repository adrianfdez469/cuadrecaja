/**
 * Constants of the administrator SSO towards the QAB panel (F-009).
 *
 * The shape of the assertion is NOT designed here: it is dictated by QAB
 * (`$QAB_DOCS_PATH/despliegue.md` § 8.4) and this file only transcribes it.
 * Nothing here is translated on the way out.
 *
 * It imports nothing, so no cycle is possible (E-028).
 */

/** The page of the QAB panel that redeems the assertion. Appended to QAB_API_BASE_URL. */
export const QAB_SSO_ADMIN_PATH = "/admin/sso";

/** Query key the token travels in. Written through URLSearchParams, never by hand. */
export const QAB_SSO_TOKEN_QUERY_KEY = "token";

/**
 * Lifetime of the assertion, in seconds. `exp - iat` is exactly this number.
 *
 * QAB verifies with 30 s of clock tolerance because the two machines do not
 * share a clock. That tolerance is THEIRS: cuadrecaja does not widen the window
 * to anticipate it, and does not shorten it to compensate for it either.
 */
export const QAB_SSO_TOKEN_TTL_SECONDS = 60;

/**
 * Seconds the SCREEN counts down, deliberately FEWER than the 60 above.
 *
 * Added in step 4b at the design's request (`.agents/designs/F-009.md`), not
 * invented by whoever implements this: the token is signed on the server and the
 * response takes time to arrive, so counting 60 from the moment it lands would
 * keep offering the link some hundreds of milliseconds AFTER its own `exp`. Five
 * seconds of useful life are given up so the screen can never hand out a link
 * that is already dead.
 *
 * It is NOT the 30 s of clock tolerance stretched into a margin: that tolerance
 * belongs to QAB, and cuadrecaja neither widens nor compensates for it
 * (ADR 0068). Do not "fix" this number to 60.
 */
export const QAB_SSO_LINK_UI_TTL_SECONDS = 55;

/** The signing algorithm, pinned. Never taken from a header or from the payload. */
export const QAB_SSO_ALGORITHM = "HS256" as const;

/**
 * Minimum length accepted for SSO_JWT_SECRET. It is OURS, not QAB's: their
 * deployment document publishes no minimum for this variable. 32 is what
 * NEXTAUTH_SECRET and QAB_PROVISIONING_SECRET_MIN_LENGTH already demand, and an
 * HS256 key below that is the weakest link of the whole chain. See ADR 0068.
 */
export const QAB_SSO_SECRET_MIN_LENGTH = 32;

/**
 * Why the link cannot be issued because of the environment. CLOSED vocabulary.
 *
 * DECLARATION ORDER IS THE PRECEDENCE: `resolveQabSsoAvailability` walks this
 * array in order and returns the first reason that holds, so an `if` chain can
 * never drift away from the constant. Same mechanism as
 * QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS.
 */
export const QAB_SSO_UNAVAILABLE_REASONS = [
  "SECRET_NOT_SET",
  "SECRET_INVALID",
  "BASE_URL_NOT_SET",
  "BASE_URL_INVALID",
] as const;

/**
 * Prefix of the ONE line written when the environment cannot issue a link. The
 * only thing appended to it is one member of QAB_SSO_UNAVAILABLE_REASONS.
 *
 * No interpolation of anything else, ever: not the value of a variable, not its
 * length, not the message of an exception. This is E-031 by the configuration
 * route — `jsonwebtoken` and friends quote the datum that broke them.
 */
export const QAB_SSO_NOT_CONFIGURED_LOG = "QAB_SSO_NOT_CONFIGURED" as const;

/**
 * The FIXED message of QabSsoSigningError. A constant and not a template: the
 * value thrown from inside `jwt.sign` is never read, never inspected, never
 * logged and never chained as `cause` (E-031, ADR 0068).
 */
export const QAB_SSO_SIGNING_FAILED = "QAB_SSO_SIGNING_FAILED" as const;

/**
 * The WHOLE prefix of the ONE line written when the session's `usuario` has no
 * address shape. What follows it is the internal `sub` and NOTHING else.
 *
 * The rejected `usuario` is never logged: it is the personal datum of the case,
 * and it is exactly what E-031 forbids. `sub` is cuadrecaja's own id, the same
 * precedent F-012 set when it logged `pedidoId` and never the public code.
 */
export const QAB_SSO_USER_NOT_EMAIL_LOG = "QAB_SSO_USER_NOT_EMAIL" as const;
