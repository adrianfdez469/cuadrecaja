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
  /** userId → keep selling a product the catalog says is gone. Off by
   * default, and only consulted while there is a connection: offline the POS
   * allows it regardless, because nothing on the device can tell what the real
   * stock is. See `allowsSellingWithoutStock`. */
  sellWithoutStockByUser: Record<string, boolean>;
  toggleSellWithoutStock: (userId: string) => void;
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
      sellWithoutStockByUser: {},
      toggleSellWithoutStock: (userId: string) =>
        set((state) => ({
          sellWithoutStockByUser: {
            ...state.sellWithoutStockByUser,
            [userId]: !state.sellWithoutStockByUser[userId],
          },
        })),
    }),
    {
      name: "pos-preferences",
      version: 3,
      migrate: (persisted, version) => {
        const prior = (persisted ?? {}) as Partial<PosPreferencesState>;
        return {
          showAlternativeCurrenciesByUser:
            prior.showAlternativeCurrenciesByUser ?? {},
          // v1 → v2 renamed the aborted "confirm before charging" toggle into
          // "show the receipt screen" — a different setting, not a rename, so
          // anything stored before v2 resets to its own default rather than
          // inheriting the old flag's value.
          showSaleReceiptByUser:
            version >= 2 ? (prior.showSaleReceiptByUser ?? {}) : {},
          // v2 → v3 only added "sell without stock"; nothing to carry over.
          sellWithoutStockByUser: prior.sellWithoutStockByUser ?? {},
        } as PosPreferencesState;
      },
    },
  ),
);
