"use client";

import { useEffect } from "react";
import { usePrintQueueStore } from "../store/printQueueStore";
import { usePrinter } from "./usePrinter";

/**
 * Drains the pending ticket queue whenever something lands in it.
 *
 * This used to be an effect inside the toolbar's printer icon, which meant a
 * queue that only flushed while that icon happened to be rendered. Retrying a
 * ticket is not a property of a button, so the POS page owns it now and the
 * printer row in the actions sheet is free to be just a row.
 */
export function useAutoFlushPrintQueue(tiendaId?: string) {
  const pendingCount = usePrintQueueStore((s) => s.getPendingCount());
  const { flushQueue } = usePrinter(tiendaId);

  useEffect(() => {
    if (pendingCount > 0 && tiendaId) {
      void flushQueue().catch(() => {});
    }
  }, [pendingCount, tiendaId, flushQueue]);
}
