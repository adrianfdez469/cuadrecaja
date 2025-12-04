import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ICartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  productoTiendaId: string;
}

export interface ICart {
  id: string;
  name: string;
  items: ICartItem[];
  total: number;
}

interface CartState {
  // Backward-compatible selectors for existing UI
  items: ICartItem[];
  total: number;
  // Multi-cart state
  carts: ICart[];
  activeCartId: string;
  // Item operations (act on active cart)
  addToCart: (product: Omit<ICartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void; // clears active cart (kept for compatibility)
  // Multi-cart operations
  createCart: (name?: string) => void;
  setActiveCart: (id: string) => void;
  renameActiveCart: (name: string) => void;
  renameCart: (id: string, name: string) => void;
  removeActiveCart: () => void;
}

// Helpers
const calcTotal = (items: ICartItem[]) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const createEmptyCart = (index: number): ICart => ({
  id: String(index),
  name: `Cuenta #${index}`,
  items: [],
  total: 0,
});

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Default: one empty cart active
      carts: [createEmptyCart(1)],
      activeCartId: "1",
      // mirror of active cart for backward compatibility
      items: [],
      total: 0,

      // Ensure root items/total mirrors the active cart
      setActiveCart: (id) => {
        const state = get();
        const cart = state.carts.find(c => c.id === id) ?? state.carts[0];
        if (!cart) return;
        set({
          activeCartId: cart.id,
          items: cart.items,
          total: cart.total,
        });
      },

      
      createCart: (name) => {
        const state = get();
        const nextIndex = state.carts.length ? Math.max(...state.carts.map(c => Number(c.id))) + 1 : 1;
        const newCart: ICart = { id: String(nextIndex), name: name ?? `Cuenta #${nextIndex}`, items: [], total: 0 };
        const carts = [...state.carts, newCart];
        set({ carts, activeCartId: newCart.id, items: [], total: 0 });
      },

      renameActiveCart: (name) => {
        set((state) => {
          const carts = state.carts.map(c => c.id === state.activeCartId ? { ...c, name } : c);
          return { carts } as Partial<CartState>;
        });
      },

      renameCart: (id: string, name: string) => {
        set((state) => {
          const carts = state.carts.map(c => c.id === id ? { ...c, name } : c);
          return { carts } as Partial<CartState>;
        });
      },

      removeActiveCart: () => {
        set((state) => {
          const idx = state.carts.findIndex(c => c.id === state.activeCartId);
          if (idx === -1) return {} as Partial<CartState>;
          const carts = state.carts.filter(c => c.id !== state.activeCartId);
          if (carts.length === 0) {
            const first = createEmptyCart(1);
            return { carts: [first], activeCartId: first.id, items: first.items, total: first.total } as Partial<CartState>;
          }
          const newActive = carts[Math.min(idx, carts.length - 1)];
          return { carts, activeCartId: newActive.id, items: newActive.items, total: newActive.total } as Partial<CartState>;
        });
      },

      addToCart: (product, quantity = 1) => {
        set((state) => {
          const carts = state.carts.map(c => {
            if (c.id !== state.activeCartId) return c;
            const existingItem = c.items.find((item) => item.id === product.id);
            let updatedItems: ICartItem[];
            if (existingItem) {
              updatedItems = c.items.map((item) =>
                item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
              );
            } else {
              updatedItems = [...c.items, { ...product, quantity }];
            }
            const total = calcTotal(updatedItems);
            return { ...c, items: updatedItems, total };
          });
          const active = carts.find(c => c.id === state.activeCartId)!;
          return {
            carts,
            items: active.items,
            total: active.total,
          } as Partial<CartState>;
        });
      },

      updateQuantity: (id, quantity) => {
        set((state) => {
          const carts = state.carts.map(c => {
            if (c.id !== state.activeCartId) return c;
            const updatedItems = c.items.map((item) => (item.id === id ? { ...item, quantity } : item));
            const total = calcTotal(updatedItems);
            return { ...c, items: updatedItems, total };
          });
          const active = carts.find(c => c.id === state.activeCartId)!;
          return { carts, items: active.items, total: active.total } as Partial<CartState>;
        });
      },

      removeFromCart: (id) => {
        set((state) => {
          const carts = state.carts.map(c => {
            if (c.id !== state.activeCartId) return c;
            const updatedItems = c.items.filter((item) => item.id !== id);
            const total = calcTotal(updatedItems);
            return { ...c, items: updatedItems, total };
          });
          const active = carts.find(c => c.id === state.activeCartId)!;
          return { carts, items: active.items, total: active.total } as Partial<CartState>;
        });
      },

      clearCart: () => {
        // For compatibility: clear the active cart contents but keep the cart
        set((state) => {
          const carts = state.carts.map(c => (c.id === state.activeCartId ? { ...c, items: [], total: 0 } : c));
          return { carts, items: [], total: 0 } as Partial<CartState>;
        });
      },
    }),
    {
      name: "cart-storage",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        // If coming from legacy single-cart structure
        if (version < 2) {
          // persistedState may be undefined initially
          const legacy = (persistedState as { items?: ICartItem[]; total?: number } | undefined);
          const items: ICartItem[] = legacy?.items ?? [];
          const total: number = legacy?.total ?? 0;
          const first: ICart = { id: "1", name: "Cuenta #1", items, total };
          return {
            carts: [first],
            activeCartId: "1",
            items,
            total,
          } satisfies Partial<CartState> & { carts: ICart[]; activeCartId: string };
        }
        return persistedState as Partial<CartState>;
      },
      // Ensure partialize keeps full state for now to not break across sessions
    }
  )
);
