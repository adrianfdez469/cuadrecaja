"use client";

import { useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { usePosPreferencesStore } from "@/store/posPreferencesStore";

/**
 * Whether a finished sale stops on "Cobro registrado" — change, what was
 * charged, "Nueva venta" — instead of going straight back to selling. Off by
 * default: with a good connection there is nothing left to do with that
 * screen most of the time, and a cashier who wants to check the change or
 * reprint can still open the receipt from the sale's own record.
 */
export function useShowSaleReceipt() {
  const { user } = useAppContext();
  const userId = user?.id ?? "";

  const show = usePosPreferencesStore((state) =>
    Boolean(state.showSaleReceiptByUser[userId]),
  );
  const toggleForUser = usePosPreferencesStore(
    (state) => state.toggleShowSaleReceipt,
  );

  const toggle = useCallback(() => {
    if (userId) toggleForUser(userId);
  }, [userId, toggleForUser]);

  return { show, toggle };
}
