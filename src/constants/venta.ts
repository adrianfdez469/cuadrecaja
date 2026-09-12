/**
 * Sale constants.
 */

/**
 * Largest difference, in base currency, tolerated between the total a client
 * reports for a sale and the total the server recomputes from the persisted
 * lines and exchange rates before the server's figure silently replaces it.
 *
 * Both sides run the same conversion on the same prices, so a legitimate gap
 * is floating-point noise well under a cent. Anything larger means the client
 * priced the basket with different rates — or none — and its total is not a
 * figure the books can carry.
 */
export const SALE_TOTAL_TOLERANCE_BASE = 0.01;

/**
 * Where a sale came from. TIENDA_ONLINE <=> it landed from an online order.
 *
 * It lives here and not in `@/constants/tiendaOnline` because the origin of a
 * sale is a SALES concept: `src/lib/reports/**` consumes it and must not depend
 * on the online-store module (ADR 0075).
 */
export const SALE_ORIGINS = ["POS", "TIENDA_ONLINE"] as const;
export type ISaleOrigin = (typeof SALE_ORIGINS)[number];

/**
 * Lowest syncAttempts a row must hold to evidence a retry WHEN THE ROW DOES NOT
 * DECLARE WHAT ITS COUNTER COUNTS — that is, when syncAttemptsAreFailures is
 * absent.
 *
 * 2 and not 1, and this is NOT a rounding choice: before F-050 the online POS
 * path stored a literal 1 for a sale that synced on its first try, so a stored
 * 1 on an undeclared row is indistinguishable — FOREVER, that datum is gone —
 * between "no retry at all" and "one real retry". 2 is the lowest value no
 * first attempt of THIS REPO'S POS OR THE APK could have produced; a client
 * that counted from 2 would still light the section on its first try, and that
 * caveat is ADR 0148's, kept here on purpose. ADR 0148, ADR 0149.
 */
export const SALE_SYNC_TRACE_MIN_ATTEMPTS = 2;

/**
 * Lowest syncAttempts a row must hold to evidence a retry WHEN THE ROW DECLARES
 * that its counter counts failed attempts (syncAttemptsAreFailures === true).
 *
 * 1, because under that convention one stored unit IS one failed attempt: there
 * is nothing to discount. ADR 0149.
 */
export const SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS = 1;

/**
 * What every sale POSTed by THIS bundle declares about its own counter.
 *
 * It is a property of the code that sends, not of the sale: every write path in
 * this repository counts failed attempts after F-050, so the value is fixed and
 * lives in one place instead of being typed at each call site.
 */
export const SALE_SYNC_ATTEMPTS_ARE_FAILURES = true;

/**
 * The closed vocabulary of reasons a sale carries a sync trace, IN THE ORDER
 * they are presented: the connection one before the retries one.
 *
 * Same shape as SALE_ORIGINS above, which is this file's existing way of
 * declaring a closed vocabulary. The order is part of the declaration and not
 * an accident of the selector: the dialog prints them in it.
 */
export const SALE_SYNC_TRACE_REASONS = ["OFFLINE", "RETRIES"] as const;
export type ISaleSyncTraceReason = (typeof SALE_SYNC_TRACE_REASONS)[number];

/**
 * The closed vocabulary of reasons the sales history shows no rows.
 *
 * The ORDER of this array carries no meaning: unlike SALE_SYNC_TRACE_REASONS
 * above, nothing prints these in sequence. Which one applies is decided by
 * saleHistoryEmptyReason, and its precedence lives in that function alone.
 *
 * The screen maps every value to its own wording, so the four are four
 * distinct messages and never a fallback of one another.
 */
export const SALE_HISTORY_EMPTY_REASONS = [
  "NO_SALES_IN_PERIOD",
  "NO_SALES_FOR_SEARCH",
  "NO_SALES_WITH_SYNC_TRACE",
  "NO_TRACED_SALES_FOR_SEARCH",
] as const;
export type ISaleHistoryEmptyReason =
  (typeof SALE_HISTORY_EMPTY_REASONS)[number];
