import {
  SALE_SYNC_TRACE_MIN_ATTEMPTS,
  SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS,
  type ISaleSyncTraceReason,
} from "@/constants/venta";

/**
 * The sync-bookkeeping columns of a sale, as they arrive from the network.
 *
 * All are optional because IVenta declares them optional, and IVenta declares
 * them optional because most producers of that type still do not copy them:
 * F-032 fixes exactly one endpoint (the period sales GET), not all of them.
 * An absent field therefore means "this producer says nothing", and the
 * predicate below reads that as NOT traced — never as unknown.
 */
export interface SaleSyncTrace {
  wasOffline?: boolean;
  syncAttempts?: number;
  /**
   * Whether the syncAttempts of THIS row counts failed attempts.
   *
   * Three inhabitants reach this field and only one of them is affirmative:
   * `true` (a client declared it), `false` and `null` (a Prisma row that has
   * nothing declared) and `undefined` (a payload that omits it). The predicate
   * reads ONLY `=== true` as affirmative, so the other three collapse into a
   * single "undeclared" branch — there is no three-state logic anywhere.
   *
   * `null` is admitted in the type so a Prisma row can be passed straight in
   * without a cast; the schema types it `boolean | undefined` because the GET
   * mapper normalises it at the boundary.
   */
  syncAttemptsAreFailures?: boolean | null;
}

/**
 * PURE. The lowest syncAttempts value THIS sale must hold for its counter to
 * evidence at least one failed attempt.
 *
 * The threshold is a function of the row, not a constant, because two
 * populations share the column and only one of them declares what it counted.
 * The rule is still written ONCE: this is the only place either constant is
 * read, and saleSyncTraceReasons below is the only place a comparison happens.
 *
 * An undeclared row gets the conservative threshold: a stored 1 with no
 * declaration is NOT read as a retry, which is exactly today's classification
 * and the only reading that invents nothing. ADR 0113.
 */
export function saleSyncTraceMinAttempts(sale: SaleSyncTrace): number {
  return sale.syncAttemptsAreFailures === true
    ? SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS
    : SALE_SYNC_TRACE_MIN_ATTEMPTS;
}

/**
 * PURE. WHICH reasons a sale's sync trace holds, in the fixed order declared by
 * SALE_SYNC_TRACE_REASONS: the connection one first, the retries one second.
 * An ordinary sale yields an empty array.
 *
 * The signal is wasOffline, and syncAttempts ONLY from the threshold
 * saleSyncTraceMinAttempts gives for THIS row upwards. It is NOT
 * `syncAttempts > 0`, and that is not a rounding choice: a row that declares
 * nothing may carry a stored 1 that no longer distinguishes "one real retry"
 * from "synced on the first try", because before F-034 the online POS path
 * wrote that literal. The undeclared branch therefore keeps the conservative 2
 * — the same defect as deriving the signal from the gap between
 * frontendCreatedAt and createdAt, which the POS produces on every sale
 * including the online ones. ADR 0112 has the original threshold; ADR 0113 has
 * why it became a function of the row.
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
  if ((sale.syncAttempts ?? 0) >= saleSyncTraceMinAttempts(sale)) {
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
