import {
  SALE_SYNC_TRACE_MIN_ATTEMPTS,
  type ISaleSyncTraceReason,
} from "@/constants/venta";

/**
 * The two sync-bookkeeping columns of a sale, as they arrive from the network.
 *
 * Both are optional because IVenta declares them optional, and IVenta declares
 * them optional because most producers of that type still do not copy them:
 * F-032 fixes exactly one endpoint (the period sales GET), not all of them.
 * An absent field therefore means "this producer says nothing", and the
 * predicate below reads that as NOT traced — never as unknown.
 */
export interface SaleSyncTrace {
  wasOffline?: boolean;
  syncAttempts?: number;
}

/**
 * PURE. WHICH reasons a sale's sync trace holds, in the fixed order declared by
 * SALE_SYNC_TRACE_REASONS: the connection one first, the retries one second.
 * An ordinary sale yields an empty array.
 *
 * The signal is wasOffline, and syncAttempts ONLY from
 * SALE_SYNC_TRACE_MIN_ATTEMPTS (2) upwards. It is NOT `syncAttempts > 0`, and
 * that is not a rounding choice: the online POS path sends the literal 1 for a
 * sale that synced on its first attempt (src/app/pos/page.tsx), so `> 0` would
 * fire on the ordinary majority of rows — the same defect as deriving the
 * signal from the gap between frontendCreatedAt and createdAt, which the POS
 * produces on every sale including the online ones. ADR 0112 has the counting
 * conventions written out.
 *
 * It is NOT derived from the two timestamps, under any threshold.
 *
 * BOTH reasons can hold at once and both are returned: they are two separate
 * facts about the same sale, and keeping only one hides the other.
 *
 * This function, and not the gate below, is where the rule is expressed ONCE.
 */
export function saleSyncTraceReasons(
  sale: SaleSyncTrace,
): ISaleSyncTraceReason[] {
  const reasons: ISaleSyncTraceReason[] = [];
  if (sale.wasOffline === true) reasons.push("OFFLINE");
  if ((sale.syncAttempts ?? 0) >= SALE_SYNC_TRACE_MIN_ATTEMPTS) {
    reasons.push("RETRIES");
  }
  return reasons;
}

/**
 * PURE. Whether a sale carries a sync trace worth showing at all: the gate the
 * detail dialog renders nothing behind.
 *
 * DERIVED from saleSyncTraceReasons, never re-expressed. The two symbols cannot
 * drift apart because there is only one rule and this one reads it: a caller
 * that re-stated the same condition here would be free to disagree with the
 * selector the day a third reason is added, and the dialog would then show a
 * section with zero reasons in it, or hide a reason that holds (E-014).
 */
export function hasSyncTrace(sale: SaleSyncTrace): boolean {
  return saleSyncTraceReasons(sale).length > 0;
}
