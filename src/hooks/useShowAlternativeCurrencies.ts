"use client";

import { useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { usePosPreferencesStore } from "@/store/posPreferencesStore";

/**
 * Whether the price cards show their foreign-currency equivalents on screen,
 * for the cashier currently logged in. Off by default: most sales are in the
 * base currency, and a second line under every price is noise until the
 * cashier decides otherwise.
 *
 * When off, the equivalents are still one tap away in each card's popover —
 * this only decides whether they are also shown up front.
 */
export function useShowAlternativeCurrencies() {
  const { user } = useAppContext();
  const userId = user?.id ?? "";

  const show = usePosPreferencesStore((state) =>
    Boolean(state.showAlternativeCurrenciesByUser[userId]),
  );
  const toggleForUser = usePosPreferencesStore(
    (state) => state.toggleAlternativeCurrencies,
  );

  const toggle = useCallback(() => {
    if (userId) toggleForUser(userId);
  }, [userId, toggleForUser]);

  return { show, toggle };
}
