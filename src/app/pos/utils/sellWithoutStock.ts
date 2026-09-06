/**
 * Selling what the shelf says is gone.
 *
 * The POS caps every quantity at what the store holds, and hides whatever it
 * has run out of. That is right while the catalog is fresh, and wrong the rest
 * of the time: stock arrives before anyone books the purchase, a count is off,
 * or the device has been offline long enough for its copy to have aged. In all
 * three the product is physically there and the sale cannot be made.
 *
 * These rules lift that cap under two conditions, and only those:
 *
 * - **Offline**, always. The cached catalog is a snapshot of an unknown age and
 *   the server cannot be asked, so refusing the sale would be guessing against
 *   the cashier, who is looking at the product.
 * - **Online**, only when the cashier turned the setting on. Here the catalog is
 *   fresh, so the default stays: what the POS shows is what can be sold.
 *
 * Either way the server remains the arbiter — it rejects a sale it cannot
 * cover, at once when online and on sync when the sale was queued — so this
 * never books stock out of nothing. It only decides what the POS lets the
 * cashier *attempt*.
 */

/** No ceiling: what the store holds stops being the limit. */
export const UNLIMITED_QUANTITY = Number.POSITIVE_INFINITY;

/**
 * Whether the POS may sell past its stock right now.
 *
 * [enabled] is the cashier's own "Vender sin existencias" setting, which only
 * has a say while there is a connection: without one the answer is yes
 * regardless, because nothing on the device can tell what the real stock is.
 */
export function allowsSellingWithoutStock(
  isOnline: boolean,
  enabled: boolean,
): boolean {
  return !isOnline || enabled;
}

/**
 * Whether a catalog entry belongs on screen.
 *
 * `disponible` already includes what is inside unopened parent packs for a
 * fraction (see `buildProductIndex`), so a loose cigarette stays listed while
 * there are boxes left. Price is not checked here: the catalog endpoint only
 * ever sends products with one.
 */
export function isVisibleInPos(
  entry: { disponible: number },
  allowWithoutStock: boolean,
): boolean {
  return allowWithoutStock || entry.disponible > 0;
}

/**
 * How much of a product may still be added to the sale.
 *
 * Selling without stock is unlimited on purpose rather than capped at some
 * invented figure: once the device's count is not the truth, no number derived
 * from it is either, and the server is what says no.
 */
export function getMaxSellableQuantity(
  disponible: number,
  cartQuantity: number,
  allowWithoutStock: boolean,
): number {
  if (allowWithoutStock) return UNLIMITED_QUANTITY;
  return Math.max(0, disponible - cartQuantity);
}

/** Whether a quantity may be added without the catalog backing it. */
export function isSellingWithoutStock(
  disponible: number,
  cartQuantity: number,
): boolean {
  return disponible - cartQuantity <= 0;
}
