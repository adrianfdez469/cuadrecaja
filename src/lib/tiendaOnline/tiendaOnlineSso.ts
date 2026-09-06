import { randomUUID } from "crypto";
import type { Session } from "next-auth";
import { qabSsoAdminUrl, resolveQabSsoAvailability } from "@/lib/qab/qabSsoEnv";
import type { IQabSsoUnavailableReason } from "@/lib/qab/qabSsoEnv";
import { buildQabSsoClaims } from "@/lib/qab/qabSsoClaims";
import { signQabSsoToken } from "@/lib/qab/qabSsoToken";

/** The three outcomes of an emission attempt. Closed union. */
export type ITiendaOnlineSsoOutcome =
  | { outcome: "issued"; url: string }
  | { outcome: "not_configured"; reason: IQabSsoUnavailableReason }
  | { outcome: "no_identity" };

/**
 * Builds the one-time link. SYNCHRONOUS and with NO I/O: no database access, no
 * network call. The only impure thing in it is `randomUUID`.
 *
 * Order of evaluation, and it is the contract:
 *
 *   1. `resolveQabSsoAvailability(env)` -> not available: `not_configured`.
 *   2. `randomUUID()` -> the `jti`. A new one per emission, never reused.
 *   3. `buildQabSsoClaims({ session, jti })` -> null: `no_identity`.
 *   4. `signQabSsoToken(claims, secret)`.
 *   5. `qabSsoAdminUrl(baseUrl, token)` -> `issued`.
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

  const token = signQabSsoToken(claims, availability.secret);

  return { outcome: "issued", url: qabSsoAdminUrl(availability.baseUrl, token) };
}
