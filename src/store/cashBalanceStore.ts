import { create } from "zustand";
import { CASH_BALANCE_TTL_MS } from "@/constants/pos";

/** Cash on hand per currency for one open period. */
export type CashBalance = Record<string, number>;

interface CachedBalance {
  balance: CashBalance;
  fetchedAt: number;
}

interface CashBalanceState {
  byPeriod: Record<string, CachedBalance>;
  /** Requests in flight, so N callers share one round-trip. */
  pending: Record<string, Promise<void>>;
  ensure: (tiendaId: string, cierreId: string) => Promise<void>;
  invalidate: (tiendaId: string, cierreId: string) => void;
}

const keyFor = (tiendaId: string, cierreId: string) =>
  `${tiendaId}:${cierreId}`;

/** Stable identity, so a period with no cached balance does not re-render. */
const EMPTY: CashBalance = {};

/**
 * Cash-drawer balance, cached per open period.
 *
 * The endpoint behind it aggregates every sale, expense and stock movement of
 * the period, and it used to run on every mount of the checkout — which the
 * POS remounts after each sale and on every switch of cart. All it feeds is
 * the "the drawer cannot cover this change" warning, so a balance a minute old
 * is fine; it never affects an amount.
 */
export const useCashBalanceStore = create<CashBalanceState>()((set, get) => ({
  byPeriod: {},
  pending: {},

  ensure: async (tiendaId, cierreId) => {
    if (!tiendaId || !cierreId) return;
    const key = keyFor(tiendaId, cierreId);
    const state = get();

    const inFlight = state.pending[key];
    if (inFlight) return inFlight;

    const cached = state.byPeriod[key];
    if (cached && Date.now() - cached.fetchedAt < CASH_BALANCE_TTL_MS) return;

    const request = fetch(`/api/cierre/${tiendaId}/${cierreId}/cash-balance`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((balance: CashBalance) => {
        set((s) => ({
          byPeriod: {
            ...s.byPeriod,
            [key]: { balance, fetchedAt: Date.now() },
          },
        }));
      })
      .catch(() => {
        // An unreachable balance must not block a sale: the warning it powers
        // simply does not appear.
        set((s) => ({
          byPeriod: {
            ...s.byPeriod,
            [key]: { balance: {}, fetchedAt: Date.now() },
          },
        }));
      })
      .finally(() => {
        set((s) => {
          const pending = { ...s.pending };
          delete pending[key];
          return { pending };
        });
      });

    set((s) => ({ pending: { ...s.pending, [key]: request } }));
    return request;
  },

  invalidate: (tiendaId, cierreId) => {
    if (!tiendaId || !cierreId) return;
    const key = keyFor(tiendaId, cierreId);
    set((s) => {
      const byPeriod = { ...s.byPeriod };
      delete byPeriod[key];
      return { byPeriod };
    });
  },
}));

/** The cached balance for a period, or an empty drawer while none is known. */
export const useCashBalance = (
  tiendaId: string,
  cierreId: string,
): CashBalance =>
  useCashBalanceStore(
    (state) => state.byPeriod[keyFor(tiendaId, cierreId)]?.balance ?? EMPTY,
  );
