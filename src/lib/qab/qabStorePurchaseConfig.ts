import type { Prisma } from "@prisma/client";

import {
  QAB_CHECKOUT_MODE_DEFAULT,
  QAB_DELIVERY_FEE_MODE_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_DEFAULT,
  QAB_STORE_PURCHASE_CONFIG_KEYS,
} from "@/constants/qab";
import type { ITiendaOnlineLocalRow } from "@/lib/tiendaOnline/tiendaOnlineStore";
import {
  isQabOrderExpiryHours,
  qabCheckoutModeSchema,
  qabDeliveryFeeModeSchema,
} from "@/schemas/qabStorePurchaseConfig";
import type {
  IQabStorePurchaseConfig,
  IQabStorePurchaseConfigChanges,
} from "@/schemas/qabStorePurchaseConfig";

/**
 * The server half of the purchase configuration: the ONLY module of this feature
 * that knows `Prisma.Decimal` exists.
 *
 * The import of `ITiendaOnlineLocalRow` is TYPE-ONLY on purpose: it is erased at
 * compile time, so the two modules do not form a runtime cycle even though
 * `tiendaOnlineStore.ts` imports the functions below.
 */

/** The five columns as read from a Tienda row. Derived, never re-declared. */
export type IQabStorePurchaseConfigRow = Pick<
  ITiendaOnlineLocalRow,
  (typeof QAB_STORE_PURCHASE_CONFIG_KEYS)[number]
>;

/**
 * PURE. The stored amount as a wire number. Returns `null` for `null` AND for
 * `undefined` (`value == null` covers the three reachable shapes, E-079), and
 * accepts a plain number so a caller that already converted is not punished.
 */
export function toQabDeliveryFee(
  value: Prisma.Decimal | number | null,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  return value.toNumber();
}

/**
 * PURE. A row projection -> the five values in wire shape.
 *
 * TOLERANT ON READ, like `toTiendaOnlineLocal` is with a calendar stored before
 * its format existed: a vocabulary value the enum does not contain, or an hour
 * count outside the range, reads as the DEFAULT instead of taking the screen
 * down. A row written by hand with SQL is then corrected by the first save,
 * because the delta will see it as a change.
 *
 * `deliveryFee` has NO default to fall back on — the column is nullable and
 * `null` is a meaning, not a gap — so it is carried through as stored. Its shape
 * is already guaranteed by `Decimal(14, 2)`.
 */
export function toQabStorePurchaseConfig(
  row: IQabStorePurchaseConfigRow,
): IQabStorePurchaseConfig {
  const checkoutMode = qabCheckoutModeSchema.safeParse(row.checkoutMode);
  const deliveryFeeMode = qabDeliveryFeeModeSchema.safeParse(row.deliveryFeeMode);
  const orderExpiryHours = row.orderExpiryHours;

  return {
    checkoutMode: checkoutMode.success
      ? checkoutMode.data
      : QAB_CHECKOUT_MODE_DEFAULT,
    deliveryEnabled: row.deliveryEnabled === true,
    deliveryFee: toQabDeliveryFee(row.deliveryFee),
    deliveryFeeMode: deliveryFeeMode.success
      ? deliveryFeeMode.data
      : QAB_DELIVERY_FEE_MODE_DEFAULT,
    orderExpiryHours: isQabOrderExpiryHours(orderExpiryHours)
      ? orderExpiryHours
      : QAB_ORDER_EXPIRY_HOURS_DEFAULT,
  };
}

/**
 * `true` when the key has to travel: the two persisted states differ AND the
 * value it would carry is a real one.
 *
 * A caller that violated the type and handed an `undefined` writes NOTHING here:
 * `Object.keys` counts a present-but-undefined key, so such a key would answer
 * the opposite of what it looks like — and on the wire it would be a key that
 * disappears from the JSON while the delta claims it changed.
 */
function hasChanged(before: unknown, after: unknown): boolean {
  return after !== undefined && before !== after;
}

/**
 * PURE. What changed between two PERSISTED states of the same row.
 *
 * Compares the five with `===` over the WIRE shape — never over the row, where
 * two `Prisma.Decimal` are two objects and `===` is always false, which would
 * put `deliveryFee` in every single delta (ADR ADRIAN-0152 (d), E-008).
 *
 * The returned object holds ONLY the keys that changed, with the value from
 * `after`. It never holds a key whose value is `undefined`: the criterion is
 * checked with `Object.keys`, and a present-but-undefined key answers the
 * opposite of what it looks like — hence five explicit assignments instead of a
 * loop that would write the key before testing it.
 */
export function collectQabStorePurchaseConfigChanges(
  before: IQabStorePurchaseConfig,
  after: IQabStorePurchaseConfig,
): IQabStorePurchaseConfigChanges {
  const changes: IQabStorePurchaseConfigChanges = {};

  if (hasChanged(before.checkoutMode, after.checkoutMode)) {
    changes.checkoutMode = after.checkoutMode;
  }
  if (hasChanged(before.deliveryEnabled, after.deliveryEnabled)) {
    changes.deliveryEnabled = after.deliveryEnabled;
  }
  if (hasChanged(before.deliveryFee, after.deliveryFee)) {
    changes.deliveryFee = after.deliveryFee;
  }
  if (hasChanged(before.deliveryFeeMode, after.deliveryFeeMode)) {
    changes.deliveryFeeMode = after.deliveryFeeMode;
  }
  if (hasChanged(before.orderExpiryHours, after.orderExpiryHours)) {
    changes.orderExpiryHours = after.orderExpiryHours;
  }

  return changes;
}
