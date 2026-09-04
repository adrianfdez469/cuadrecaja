import { timingSafeEqual } from "node:crypto";

/**
 * The gate of every machine route driven by a Vercel cron. Fail-closed: without
 * the variable, `Bearer undefined` must not be a valid credential (ADR 0014).
 * Extracted from the sync-tienda route so it has one definition and unit tests
 * (ADR 0042).
 */
export function isValidCronAuth(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader ?? "");
  // Lengths first: timingSafeEqual requires buffers of the same size and would
  // throw instead of simply returning `false`.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
