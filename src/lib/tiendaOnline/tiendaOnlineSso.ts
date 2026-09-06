import { randomUUID } from "crypto";
import type { Session } from "next-auth";
import { qabSsoAdminUrl, resolveQabSsoAvailability } from "@/lib/qab/qabSsoEnv";
import type { IQabSsoUnavailableReason } from "@/lib/qab/qabSsoEnv";
import {
  buildQabSsoClaims,
  isQabSsoIssuableEmail,
} from "@/lib/qab/qabSsoClaims";
import { signQabSsoToken } from "@/lib/qab/qabSsoToken";

/** The FOUR outcomes of an emission attempt. Closed union. */
export type ITiendaOnlineSsoOutcome =
  | { outcome: "issued"; url: string }
  | { outcome: "not_configured"; reason: IQabSsoUnavailableReason }
  | { outcome: "no_identity" }
  | { outcome: "user_not_email"; sub: string };

/**
 * Builds the one-time link. SYNCHRONOUS and with NO I/O: no database access, no
 * network call. The only impure thing in it is `randomUUID`.
 *
 * Order of evaluation, and it is the contract:
 *
 *   1. `resolveQabSsoAvailability(env)` -> not available: `not_configured`.
 *   2. `randomUUID()` -> the `jti`. A new one per emission, never reused.
 *   3. `buildQabSsoClaims({ session, jti })` -> null: `no_identity`.
 *   3b. `isQabSsoIssuableEmail(claims.email)` -> false: `user_not_email`.
 *   4. `signQabSsoToken(claims, secret)`.
 *   5. `qabSsoAdminUrl(baseUrl, token)` -> `issued`.
 *
 * The union has FOUR members, and step 3b is what added the fourth (ADR 0086).
 * It runs on `claims.email`, so it is only reached once step 3 handed back
 * claims: a blank `usuario` is caught by step 3 and stays `no_identity`, which
 * keeps its precedence untouched. `user_not_email` carries `claims.sub` and
 * NOTHING derived from the rejected value, and it returns BEFORE step 4, so the
 * secret never enters that branch (E-031).
 *
 * The environment is checked BEFORE the session on purpose: on a machine with no
 * QAB wired up, every caller gets the same `not_configured`, whoever they are.
 *
 * It DOES throw whatever step 4 throws — QabSsoSigningError — and whatever an
 * unknown failure of step 1 propagates. The route turns both into the module's
 * generic 500.
 *
 * `env` exists so the suite can drive the four environment states without
 * touching `process.env`. Production callers omit it.
 */
export function issueQabSsoLink(params: {
  session: Session | null;
  env?: NodeJS.ProcessEnv;
}): ITiendaOnlineSsoOutcome {
  const availability = resolveQabSsoAvailability(params.env);
  // `=== false` and not `!`: with `strict` off the compiler does not narrow a
  // boolean discriminant through a truthiness test.
  if (availability.available === false) {
    return { outcome: "not_configured", reason: availability.reason };
  }

  const jti = randomUUID();

  const claims = buildQabSsoClaims({ session: params.session, jti });
  if (claims === null) return { outcome: "no_identity" };

  // BEFORE the signature and not inside a `catch` around it: returning here is
  // what makes it structurally impossible for this branch to quote the secret,
  // because `signQabSsoToken` never runs (ADR 0086, E-031).
  if (isQabSsoIssuableEmail(claims.email) === false) {
    return { outcome: "user_not_email", sub: claims.sub };
  }

  const token = signQabSsoToken(claims, availability.secret);

  return { outcome: "issued", url: qabSsoAdminUrl(availability.baseUrl, token) };
}
