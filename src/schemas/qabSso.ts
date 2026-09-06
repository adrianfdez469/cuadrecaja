import { z } from "zod";

/**
 * The SIX claims QAB demands, and no seventh.
 *
 * Ids and names are `min(1)` and NOT `.uuid()` on purpose: these values come out
 * of our own session, and a `.uuid()` here would turn a legacy non-uuid id into a
 * 500 at the exact moment a merchant presses the button. What this schema is for
 * is CLOSEDNESS, not re-validating our own database (ADR 0067).
 *
 * `email` is `min(1)` and NOT `.email()` for the same reason: accounts created
 * before EMAIL_REGEX reached `POST /api/usuarios` may carry a `usuario` that is
 * not one, and QAB publishes no format requirement for the claim.
 */
const qabSsoClaimsShape = {
  jti: z.string().min(1),
  sub: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  businessId: z.string().min(1),
  storeIds: z.array(z.string().min(1)),
};

/**
 * What is signed. `.strict()` is the point of this schema and it is what makes
 * acceptance criterion 5 structural: no seventh key can reach the payload, so
 * there is no path by which a password hash could travel in it.
 */
export const qabSsoClaimsSchema = z.object(qabSsoClaimsShape).strict();
export type IQabSsoClaims = z.infer<typeof qabSsoClaimsSchema>;

/**
 * What comes back out of a decoded token: the six claims plus the two
 * `jsonwebtoken` adds. Also `.strict()`, so a test that decodes an emitted token
 * fails if anything else slipped in.
 *
 * NOT used by production code: it exists so the suite and the `qa` have one
 * exact target to assert against.
 */
export const qabSsoDecodedTokenSchema = z
  .object({
    ...qabSsoClaimsShape,
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .strict();
export type IQabSsoDecodedToken = z.infer<typeof qabSsoDecodedTokenSchema>;
