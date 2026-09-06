"use client";

import { useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { usePosPreferencesStore } from "@/store/posPreferencesStore";

/**
 * Whether this cashier keeps selling a product the catalog says is gone, while
 * there is a connection. Off by default: online the catalog is fresh, so what
 * the POS shows is what can be sold.
 *
 * Offline the POS allows it regardless of this setting — the cached catalog is
 * a snapshot of an unknown age and the server cannot be asked. The rule that
 * combines the two is `allowsSellingWithoutStock`.
 */
export function useSellWithoutStock() {
  const { user } = useAppContext();
  const userId = user?.id ?? "";

  const enabled = usePosPreferencesStore((state) =>
    Boolean(state.sellWithoutStockByUser[userId]),
  );
  const toggleForUser = usePosPreferencesStore(
    (state) => state.toggleSellWithoutStock,
  );

  const toggle = useCallback(() => {
    if (userId) toggleForUser(userId);
  }, [userId, toggleForUser]);

  return { enabled, toggle };
}
