import { RETRYABLE_CLIENT_ERROR_STATUSES } from "@/constants/pos";

/** Shape of what `createSell` rejects with; only the status matters here. */
interface SyncErrorLike {
  response?: { status?: number };
}

/**
 * Whether re-sending this sale unchanged could ever succeed.
 *
 * A 4xx is the server rejecting the request itself — a malformed payload, a
 * closed period, a sale that no longer belongs anywhere. Resending it byte for
 * byte will be rejected again, so the sale is parked instead of retried. The
 * two exceptions are timeouts and rate limits, which say "later", not "never".
 *
 * 5xx and network failures are deliberately not permanent: those are exactly
 * the outages the offline queue exists for.
 */
export function isPermanentSyncError(error: unknown): boolean {
  const status = (error as SyncErrorLike)?.response?.status;
  if (typeof status !== "number") return false;
  if (status < 400 || status >= 500) return false;
  return !RETRYABLE_CLIENT_ERROR_STATUSES.includes(status);
}
