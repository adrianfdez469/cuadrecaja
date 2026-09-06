/**
 * Server-side sale constants.
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
