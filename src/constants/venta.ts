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
 * Lowest syncAttempts value that, on its own, means a sale needed more than
 * one try to reach the server.
 *
 * 2 and not 1, because two clients count differently into the same column:
 * the online POS path sends a literal 1 for a first-attempt sale, while the
 * offline queue and the manual resend send the counter as it stood BEFORE the
 * attempt, so a first-try success stores 0. Both 0 and 1 are therefore
 * produced by sales that needed no retry; 2 is not produced by any first
 * attempt of this repo's POS. ADR 0112.
 */
export const SALE_SYNC_TRACE_MIN_ATTEMPTS = 2;

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
