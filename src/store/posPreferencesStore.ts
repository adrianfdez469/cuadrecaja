import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-cashier POS preferences, kept on the device.
 *
 * Keyed by user id rather than stored as a single flag: a POS terminal is
 * shared, and the cashier who turns a display option on should not be
 * turning it on for whoever logs in next on the same machine.
 */
interface PosPreferencesState {
  /** userId → show foreign-currency equivalents on the price cards. */
  showAlternativeCurrenciesByUser: Record<string, boolean>;
  toggleAlternativeCurrencies: (userId: string) => void;
}

export const usePosPreferencesStore = create<PosPreferencesState>()(
  persist(
    (set) => ({
      showAlternativeCurrenciesByUser: {},
      toggleAlternativeCurrencies: (userId: string) =>
        set((state) => ({
          showAlternativeCurrenciesByUser: {
            ...state.showAlternativeCurrenciesByUser,
            [userId]: !state.showAlternativeCurrenciesByUser[userId],
          },
        })),
    }),
    { name: "pos-preferences", version: 1 },
  ),
);
