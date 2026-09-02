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
  /** userId → show the "Cobro registrado" screen after a sale instead of
   * skipping straight to the next one. Off by default — the receipt is
   * still one tap away (reprint), and most sales don't need the screen. */
  showSaleReceiptByUser: Record<string, boolean>;
  toggleShowSaleReceipt: (userId: string) => void;
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
      showSaleReceiptByUser: {},
      toggleShowSaleReceipt: (userId: string) =>
        set((state) => ({
          showSaleReceiptByUser: {
            ...state.showSaleReceiptByUser,
            [userId]: !state.showSaleReceiptByUser[userId],
          },
        })),
    }),
    {
      name: "pos-preferences",
      version: 2,
      // v1 → v2 renamed the aborted "confirm before charging" toggle into
      // "show the receipt screen" — a different setting, not a rename, so it
      // resets to its own default rather than inheriting the old flag's
      // value. The currency toggle survives untouched.
      migrate: (persisted) => {
        const prior = (persisted ?? {}) as Partial<
          Pick<PosPreferencesState, "showAlternativeCurrenciesByUser">
        >;
        return {
          showAlternativeCurrenciesByUser:
            prior.showAlternativeCurrenciesByUser ?? {},
          showSaleReceiptByUser: {},
        } as PosPreferencesState;
      },
    },
  ),
);
