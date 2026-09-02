"use client";

import { useState } from "react";
import { useSalesStore } from "@/store/salesStore";
import { usePrintQueueStore } from "@/features/printing/store/printQueueStore";
import { useMessageContext } from "@/context/MessageContext";
import { useMonedasAlternativas } from "@/components/MultiCurrencyAmount/useMonedasAlternativas";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";
import { useShowSaleReceipt } from "@/hooks/useShowSaleReceipt";

const REFRESH_MSG_ID = "pos-refresh-msg";

/**
 * The POS's own actions — sync, my sales, starting point, print, catalog
 * refresh, alternate-currency display — shared by whichever UI presents
 * them: a bottom sheet on a phone, loose toolbar buttons on desktop. Neither
 * owns the state, so the badge counts, the refresh spinner and the currency
 * toggle stay identical between the two instead of drifting apart.
 */
export function usePosActionsController(onRefresh: () => Promise<void>) {
  const sales = useSalesStore((state) => state.sales);
  const pendingTickets = usePrintQueueStore((state) => state.getPendingCount());
  const { showMessage, removeMessage } = useMessageContext();
  const [refreshing, setRefreshing] = useState(false);
  const { hasAlternativas } = useMonedasAlternativas();
  const { show: showCurrencies, toggle: toggleCurrencies } =
    useShowAlternativeCurrencies();
  const { show: showSaleReceipt, toggle: toggleShowSaleReceipt } =
    useShowSaleReceipt();

  const pending = sales.filter((s) => !s.synced).length;

  // The catalog refresh reports into the app's own message rail, not into a
  // spinner that vanishes with the sheet: the cashier closes this and keeps
  // selling while it runs.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    showMessage("Actualizando el catálogo...", "info", true, REFRESH_MSG_ID);
    try {
      await onRefresh();
      removeMessage(REFRESH_MSG_ID);
      showMessage("Catálogo actualizado", "success");
    } catch {
      removeMessage(REFRESH_MSG_ID);
      showMessage("No se pudo actualizar el catálogo", "error");
    } finally {
      setRefreshing(false);
    }
  };

  return {
    salesCount: sales.length,
    pending,
    pendingTickets,
    refreshing,
    handleRefresh,
    hasAlternativas,
    showCurrencies,
    toggleCurrencies,
    showSaleReceipt,
    toggleShowSaleReceipt,
  };
}
