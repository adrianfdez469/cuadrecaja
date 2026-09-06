import jwt from "jsonwebtoken";
import {
  QAB_SSO_ALGORITHM,
  QAB_SSO_SIGNING_FAILED,
  QAB_SSO_TOKEN_TTL_SECONDS,
} from "@/constants/qabSso";
import { qabSsoClaimsSchema } from "@/schemas/qabSso";
import type { IQabSsoClaims } from "@/schemas/qabSso";

/**
 * The ONE failure this module reports. Its `message` is the fixed constant
 * QAB_SSO_SIGNING_FAILED and nothing is interpolated into it.
 */
export class QabSsoSigningError extends Error {
  constructor() {
    super(QAB_SSO_SIGNING_FAILED);
    this.name = "QabSsoSigningError";
  }
}

/**
 * Signs the assertion. The ONLY consumer of the secret in this repository: it
 * hands the value to `jwt.sign` and forgets it.
 *
 * Two things it does, in this order:
 *
 *   1. `qabSsoClaimsSchema.safeParse(claims)`. On failure it throws
 *      QabSsoSigningError and DISCARDS the issues array — a ZodError serialises
 *      its issues into `message`, and those issues carry the values being
 *      validated, `email` among them (E-031).
 *   2. `jwt.sign(parsed, secret, { algorithm, expiresIn })` inside a try/catch.
 *      EVERY value thrown from inside the call is replaced by a
 *      QabSsoSigningError. The caught value is not read, not inspected, not
 *      logged, and NOT chained as `cause`: `logRouteError` prints only `name`
 *      and `message` today, but a future logger that serialises the whole object
 *      would find an intact `cause` (ADR 0068).
 *
 * This function DOES throw QabSsoSigningError. It is not a "never throws": its
 * caller has to handle it, and the route turns it into the module's generic 500.
 *
 * `jti` travels in the PAYLOAD and `expiresIn` in the OPTIONS, never the other
 * way round and never both: `jsonwebtoken` throws when a claim is given in the
 * options and is already present in the payload.
 *
 * `exp - iat` is exactly QAB_SSO_TOKEN_TTL_SECONDS.
 */
export function signQabSsoToken(claims: IQabSsoClaims, secret: string): string {
  const parsed = qabSsoClaimsSchema.safeParse(claims);
  if (!parsed.success) {
    // `parsed.error` is deliberately left unread: see the note above.
    throw new QabSsoSigningError();
  }

  try {
    return jwt.sign(parsed.data, secret, {
      algorithm: QAB_SSO_ALGORITHM,
      expiresIn: QAB_SSO_TOKEN_TTL_SECONDS,
    });
  } catch {
    // No binding on purpose: there is no value in scope that could be read,
    // logged or chained.
    throw new QabSsoSigningError();
  }
}
