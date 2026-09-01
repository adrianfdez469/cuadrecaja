"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store/cartStore";
import { useDiscountRulesStore } from "@/store/discountRulesStore";
import { applyDiscounts } from "@/lib/discounts";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

export interface CartTotals {
  /** Sum of the lines, before any discount. */
  total: number;
  discountTotal: number;
  /** What the cashier is actually going to charge. */
  finalTotal: number;
  applied: DiscountApplicationResultItem[];
  /** Units in the basket, not lines. */
  unitCount: number;
  discountCodes: string[];
}

/**
 * The one place the active basket's numbers are worked out.
 *
 * This used to live inside the cart drawer, which is why nothing outside it
 * could show an amount you could trust: the codes the cashier had typed were
 * component state in there. Now they belong to the cart, so the charge bar and
 * the drawer read the same figures and cannot drift apart.
 *
 * Discounts are priced locally and synchronously from rules loaded with the
 * catalog. The server recomputes them when the sale is confirmed and remains
 * the authority; what happens here is what the cashier sees while deciding.
 */
export function useCartTotals(): CartTotals {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const discountCodes = useCartStore(
    (state) =>
      state.carts.find((c) => c.id === state.activeCartId)?.discountCodes,
  );
  const rules = useDiscountRulesStore((state) => state.rules);
  const productMeta = useDiscountRulesStore((state) => state.productMeta);

  // Stable identity for the empty case: a `?? []` inline would hand the memo
  // below a brand-new array on every render and recompute the whole basket.
  const codes = discountCodes ?? EMPTY_CODES;

  const discountResult = useMemo(
    () =>
      applyDiscounts({
        rules,
        products: items.map((item) => ({
          productoTiendaId: item.productoTiendaId,
          cantidad: item.quantity,
          precio: item.priceBase ?? item.price,
        })),
        productMeta,
        discountCodes: codes,
      }),
    [rules, productMeta, items, codes],
  );

  const unitCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  return {
    total,
    discountTotal: discountResult.discountTotal,
    finalTotal: Math.max(0, total - discountResult.discountTotal),
    applied: discountResult.applied,
    unitCount,
    discountCodes: codes,
  };
}

const EMPTY_CODES: string[] = [];
