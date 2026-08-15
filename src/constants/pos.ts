/**
 * Tuning constants for the sale POS view.
 *
 * The POS is the one screen a cashier uses continuously, often on a low-end
 * phone, so every value here trades a little freshness for input latency.
 */

/**
 * How long the search box waits after the last keystroke before the product
 * list is recomputed.
 *
 * The field itself stays fully controlled, so typing is always instant; this
 * only delays the expensive part — filtering the whole catalog and rebuilding
 * the grid. 200ms is below the ~250ms at which a pause starts to feel like a
 * lag, and above the interval between keystrokes of a fast typist.
 */
export const POS_SEARCH_DEBOUNCE_MS = 200;

/**
 * How long the cart waits before asking the server to re-price the basket.
 *
 * Adding several products in a row used to fire one request per tap, all on
 * the critical path of a sale. Longer than the search debounce because the
 * result is a total the cashier only reads once they stop adding.
 */
export const DISCOUNT_PREVIEW_DEBOUNCE_MS = 400;

/**
 * How many times an offline sale may be re-sent before it is parked as a
 * permanent error for the cashier to resolve by hand.
 *
 * A sale rejected for a reason the client does not recognize used to retry
 * forever: the sync-timeout sweep returns it to "not synced" after a minute,
 * and every attempt can spend up to ~94s in axios retries. Five attempts is
 * comfortably past any transient outage.
 */
export const MAX_SYNC_ATTEMPTS = 5;

/**
 * HTTP statuses that mean "retry later" rather than "this will never work":
 * request timeout and rate limiting. Every other 4xx is the server saying the
 * request itself is wrong, and resending it unchanged cannot help.
 */
export const RETRYABLE_CLIENT_ERROR_STATUSES = [408, 429];

/**
 * How long a cached cash-drawer balance is considered fresh.
 *
 * The endpoint aggregates every sale, expense and stock movement of the open
 * period, and it used to run on every mount of the checkout — which the POS
 * remounts after each sale and on every switch of cart. The value only powers
 * the "the drawer cannot cover this change" warning, never an amount, so a
 * minute of staleness costs nothing.
 */
export const CASH_BALANCE_TTL_MS = 60_000;

/**
 * How long cart writes to `localStorage` are batched for.
 *
 * `localStorage.setItem` is synchronous, and the cart used to serialize its
 * entire state — every account, plus a duplicate copy of the active one — on
 * every `+` and `−`. The window is closed early on `pagehide`, on the tab
 * being hidden, and right before a sale is charged, so the cart survives the
 * app being killed from the switcher.
 */
export const CART_PERSIST_DEBOUNCE_MS = 300;

/**
 * Catalog size from which the product grid renders only what is on screen.
 *
 * Below it the whole catalog is cheap to mount, and the plain layout keeps
 * behaviours the virtualized path would have to reimplement — pinning a short
 * search result to the bottom of the screen, above all. Above it the cost is
 * not optional: a shop with 2000 products would otherwise put roughly sixty
 * thousand DOM nodes on a cashier's phone.
 */
export const POS_VIRTUALIZATION_MIN_ITEMS = 80;

/**
 * First guess at a product card's height, in pixels, before it is measured.
 *
 * Only affects the scrollbar while rows are still unmeasured — every visible
 * row reports its real height through the virtualizer's `measureElement`.
 */
export const POS_CARD_ESTIMATED_HEIGHT = 116;
