"use client";

import { create } from "zustand";
import type { ICierrePeriodo } from "@/schemas/cierre";

interface PosPeriodState {
  /** The open period of the store being sold from, or null when there is none. */
  periodo: ICierrePeriodo | null;
  setPeriodo: (periodo: ICierrePeriodo | null) => void;
}

/**
 * The open period, published for the app bar to read.
 *
 * The redesign puts the period pill in the top bar next to the store name, but
 * the period is a POS concept: it is loaded by the sale view, from the store
 * the cashier is standing in, and no other screen has a reason to ask the
 * server for it. So the POS keeps owning the query and leaves the answer here;
 * the bar shows the pill only while something has published one, which is
 * exactly the screens that have a period at all.
 *
 * Not persisted: a period read from the last session could be closed by now,
 * and a stale date in the bar is worse than no date.
 */
export const usePosPeriodStore = create<PosPeriodState>((set) => ({
  periodo: null,
  setPeriodo: (periodo) => set({ periodo }),
}));
