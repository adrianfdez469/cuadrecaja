import {
  QAB_SSO_ADMIN_PATH,
  QAB_SSO_SECRET_MIN_LENGTH,
  QAB_SSO_TOKEN_QUERY_KEY,
  QAB_SSO_UNAVAILABLE_REASONS,
} from "@/constants/qabSso";
import { QabConfigError, resolveQabBaseUrl } from "@/lib/qab/qabEnv";

/**
 * This module is the ONLY reader of SSO_JWT_SECRET in the whole repository. It
 * reads neither the per-business `qabToken` nor the integrator secret: no module
 * reads two of the three (ADR 0006, ADR 0026, ADR 0068).
 */
const SSO_SECRET_ENV_KEY = "SSO_JWT_SECRET";

export type IQabSsoUnavailableReason = (typeof QAB_SSO_UNAVAILABLE_REASONS)[number];

/** Thrown when SSO_JWT_SECRET is present but unusable. */
export class QabSsoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QabSsoConfigError";
  }
}

/**
 * PURE (takes the environment as an argument, like `resolveQabBaseUrl`).
 *
 *   absent, or blank after trimming            -> null
 *   present and shorter than the minimum       -> throws QabSsoConfigError
 *   otherwise                                  -> the trimmed secret
 *
 * The exception message names the variable and the minimum length. It NEVER
 * contains the value, a fragment of it, or its actual length.
 */
export function resolveQabSsoSecret(env?: NodeJS.ProcessEnv): string | null {
  const source = env ?? process.env;
  const raw = source[SSO_SECRET_ENV_KEY];
  if (raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length < QAB_SSO_SECRET_MIN_LENGTH) {
    throw new QabSsoConfigError(
      `${SSO_SECRET_ENV_KEY} must be at least ${QAB_SSO_SECRET_MIN_LENGTH} characters long`,
    );
  }

  return trimmed;
}

/**
 * PURE. Resolves BOTH variables and says whether a link can be issued at all.
 * Does not throw: it converts QabSsoConfigError and QabConfigError into reasons.
 *
 * The precedence between reasons is NOT an `if` chain here: it is the
 * declaration order of QAB_SSO_UNAVAILABLE_REASONS, which this function walks.
 * With both variables broken, the secret's reason wins.
 *
 * Anything else thrown by either resolver PROPAGATES: swallowing an unknown
 * failure would hide a real fault behind a 503 that says "not wired up yet".
 *
 * On the `available: true` branch it returns the secret. That value travels as a
 * local of ONE call in `issueQabSsoLink` and reaches only `signQabSsoToken`; it
 * is never returned to a handler, never logged and never serialised.
 */
export function resolveQabSsoAvailability(
  env?: NodeJS.ProcessEnv,
):
  | { available: true; secret: string; baseUrl: string }
  | { available: false; reason: IQabSsoUnavailableReason } {
  const source = env ?? process.env;

  let secret: string | null = null;
  let secretInvalid = false;
  try {
    secret = resolveQabSsoSecret(source);
  } catch (error) {
    if (!(error instanceof QabSsoConfigError)) throw error;
    secretInvalid = true;
  }

  let baseUrl: string | null = null;
  let baseUrlInvalid = false;
  try {
    baseUrl = resolveQabBaseUrl(source);
  } catch (error) {
    if (!(error instanceof QabConfigError)) throw error;
    baseUrlInvalid = true;
  }

  // The four conditions of the contract's table, one per reason and no fifth.
  // The ORDER in which they are consulted is the constant's, never this map's.
  const holds: Record<IQabSsoUnavailableReason, boolean> = {
    SECRET_NOT_SET: !secretInvalid && secret === null,
    SECRET_INVALID: secretInvalid,
    BASE_URL_NOT_SET: !baseUrlInvalid && baseUrl === null,
    BASE_URL_INVALID: baseUrlInvalid,
  };

  const reason = QAB_SSO_UNAVAILABLE_REASONS.find((candidate) => holds[candidate]);
  if (reason !== undefined) return { available: false, reason };

  return { available: true, secret, baseUrl };
}

/**
 * PURE. `resolveQabBaseUrl` output + QAB_SSO_ADMIN_PATH + the token as a query
 * parameter, built with URLSearchParams. Nothing is concatenated by hand.
 */
export function qabSsoAdminUrl(baseUrl: string, token: string): string {
  const query = new URLSearchParams();
  query.set(QAB_SSO_TOKEN_QUERY_KEY, token);
  return `${baseUrl}${QAB_SSO_ADMIN_PATH}?${query.toString()}`;
}
