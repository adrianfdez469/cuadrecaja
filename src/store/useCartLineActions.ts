"use client";

import { useCallback } from "react";
import { useCartStore } from "@/store/cartStore";

interface CartLineActionsOptions {
  /** Validated against available stock by the POS page before it reaches here. */
  updateQuantity?: (id: string, quantity: number) => void;
  /** Absent where the caller is not allowed to drop a line. */
  removeItem?: (id: string) => void;
  /** Called instead of removing when `removeItem` is not available. */
  onRemoveUnavailable?: () => void;
}

export interface CartLineActions {
  decrease: (id: string) => void;
  increase: (id: string) => void;
}

/**
 * «−» and «+» on a basket line, wherever that line is drawn.
 *
 * The basket now appears in two places — the drawer and the charge bar's own
 * line list — and both have to answer the same way, including the part that is
 * easy to get wrong: «−» on the last unit removes the line rather than leaving
 * a zero behind.
 *
 * The current quantity is read through `getState()` instead of being closed
 * over, which keeps these two identities stable across every `+` and `−`. That
 * matters because they are the props of memoized line components: recreating
 * them would re-render the whole basket on each tap.
 */
export function useCartLineActions({
  updateQuantity,
  removeItem,
  onRemoveUnavailable,
}: CartLineActionsOptions): CartLineActions {
  const decrease = useCallback(
    (id: string) => {
      const item = useCartStore.getState().items.find((p) => p.id === id);
      if (!item) return;
      if (item.quantity === 1) {
        if (removeItem) {
          removeItem(id);
        } else {
          onRemoveUnavailable?.();
        }
        return;
      }
      updateQuantity?.(id, item.quantity - 1);
    },
    [removeItem, updateQuantity, onRemoveUnavailable],
  );

  const increase = useCallback(
    (id: string) => {
      const item = useCartStore.getState().items.find((p) => p.id === id);
      if (!item) return;
      updateQuantity?.(id, item.quantity + 1);
    },
    [updateQuantity],
  );

  return { decrease, increase };
}
