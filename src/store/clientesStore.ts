import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CLIENTES_CACHE_OWNER_KEY,
  CLIENTES_CACHE_SIZE,
  CLIENTES_CACHE_STORAGE_KEY,
  CLIENTES_CACHE_VERSION,
  CLIENTES_LIST_LIMIT,
} from "@/constants/clientes";
import {
  rememberClientes,
  sanitizeClienteOptions,
  toClienteOption,
} from "@/lib/clientes/clienteCache";
import { shouldDiscardClienteCache } from "@/lib/clientes/clienteCacheOwner";
import { getClientes } from "@/services/clienteService";
import type {
  IClienteConSaldo,
  IClienteOption,
} from "@/schemas/clienteSaldo";

export interface IClientesCacheState {
  options: IClienteOption[];
  /**
   * Whether `syncOwner` has already run in this page load. NOT persisted, so it starts
   * false on every load and no surface can read a cache whose owner has not been checked.
   */
  ownerChecked: boolean;
  /** Prepends, de-duplicates by id and truncates to CLIENTES_CACHE_SIZE. */
  remember: (clientes: IClienteConSaldo[]) => void;
  /** Replaces the whole list. What a full refresh uses (ADR 0115). */
  replaceAll: (clientes: IClienteConSaldo[]) => void;
  forget: (clienteId: string) => void;
  clear: () => void;
  /**
   * Compares `owner` against the one recorded under CLIENTES_CACHE_OWNER_KEY with
   * `shouldDiscardClienteCache`, empties `options` when they differ, records the new owner
   * (removing the key when `owner` is null), and sets `ownerChecked` to true either way.
   */
  syncOwner: (owner: string | null) => void;
}

/** `localStorage` throws in a private window and does not exist on the server. */
function readStoredOwner(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLIENTES_CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeStoredOwner(owner: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (owner === null) {
      window.localStorage.removeItem(CLIENTES_CACHE_OWNER_KEY);
      return;
    }
    window.localStorage.setItem(CLIENTES_CACHE_OWNER_KEY, owner);
  } catch {
    // A browser that refuses to store simply keeps no owner: the next `syncOwner` reads
    // null and discards the cache, which is the safe side of this decision.
  }
}

function toOptions(clientes: IClienteConSaldo[]): IClienteOption[] {
  return (Array.isArray(clientes) ? clientes : []).map(toClienteOption);
}

export const useClientesStore = create<IClientesCacheState>()(
  persist(
    (set) => ({
      options: [],
      ownerChecked: false,

      remember: (clientes) =>
        set((state) => ({
          options: rememberClientes(
            state.options,
            toOptions(clientes),
            CLIENTES_CACHE_SIZE,
          ),
        })),

      replaceAll: (clientes) =>
        set({
          options: rememberClientes([], toOptions(clientes), CLIENTES_CACHE_SIZE),
        }),

      forget: (clienteId) =>
        set((state) => ({
          options: state.options.filter((option) => option.id !== clienteId),
        })),

      clear: () => set({ options: [] }),

      syncOwner: (owner) => {
        const discard = shouldDiscardClienteCache({
          storedOwner: readStoredOwner(),
          currentOwner: owner,
        });

        if (discard) set({ options: [] });
        writeStoredOwner(owner);
        set({ ownerChecked: true });
      },
    }),
    {
      name: CLIENTES_CACHE_STORAGE_KEY,
      version: CLIENTES_CACHE_VERSION,
      // Only `options` reaches the disk. `ownerChecked` is deliberately left out: it has to
      // start false on every load. What criterion 8 inspects is exactly this.
      partialize: (state) => ({ options: state.options }),
      // Any other version is discarded whole, in both directions. Nothing is converted field
      // by field: a cache is a rebuildable mirror of the server (criterion 9, ADR 0115).
      migrate: () => ({ options: [] }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A hand-written entry at the CURRENT version never reaches the render: the version
        // bump is not the only way to get junk in there.
        state.options = sanitizeClienteOptions(
          state.options,
          CLIENTES_CACHE_SIZE,
        );
      },
    },
  ),
);

/**
 * Fetches the list and REPLACES the cache with it. Returns how many options were stored.
 *
 * F-033 calls it from the selector's `refresh`. It is deliberately NOT wired into
 * `src/app/pos/**` here: that file belongs to F-034 (ADR 0113), which hooks it where
 * `syncPendingSales` is already scheduled, honouring `shouldDeferPosBackgroundOperations`.
 */
export async function refreshClientesCache(): Promise<number> {
  const clientes = await getClientes({ limit: CLIENTES_LIST_LIMIT });
  useClientesStore.getState().replaceAll(clientes);
  return useClientesStore.getState().options.length;
}
