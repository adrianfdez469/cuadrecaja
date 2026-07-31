/**
 * Standard header (IETF draft, popularised by Stripe) marking a request as
 * safe to replay: the server recognises the resend and does not apply it twice.
 *
 * Lives here, free of dependencies, because both sides need it — the browser
 * axios client and the API routes — and neither should pull the other's imports
 * (next-auth on one side, Prisma on the other).
 */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
