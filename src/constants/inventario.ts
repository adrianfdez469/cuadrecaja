/**
 * Tuning constants for the inventory view.
 */

/**
 * Row count from which the inventory list renders only what is on screen.
 *
 * Below it, mounting the whole list is cheap and nothing about the view
 * changes. Above it the cost is not optional: a shop with 2000 products put
 * roughly 47.000 nodes in the DOM and took seconds to paint the table.
 */
export const INVENTARIO_VIRTUALIZATION_MIN_ROWS = 100;

/**
 * First guess at a table row's height, in pixels, before it is measured.
 *
 * Only affects the scrollbar while rows are still unmeasured — every visible
 * row reports its real height through the virtualizer's `measureElement`.
 */
export const INVENTARIO_ROW_ESTIMATED_HEIGHT = 63;

/**
 * First guess at a mobile card's height, before it is measured.
 */
export const INVENTARIO_CARD_ESTIMATED_HEIGHT = 132;

/** Columns of the desktop table, for the spacer rows that hold the scroll. */
export const INVENTARIO_TABLE_COLUMNS = 8;
