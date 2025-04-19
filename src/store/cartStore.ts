import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ICartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  productoTiendaId: string;
}
interface CartState {
  items: ICartItem[];
  total: number;
  addToCart: (product: Omit<ICartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set/*, get*/) => ({
      items: [],
      total: 0,

      addToCart: (product, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find((item) => item.id === product.id);

          let updatedItems;
          if (existingItem) {
            updatedItems = state.items.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
            );
          } else {
            updatedItems = [...state.items, { ...product, quantity }];
          }

          return {
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
          };
        });
      },

      updateQuantity: (id, quantity) => {
        set((state) => {
          const updatedItems = state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          );

          return {
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
          };
        });
      },

      removeFromCart: (id) => {
        set((state) => {
          const updatedItems = state.items.filter((item) => item.id !== id);
          return {
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
          };
        });
      },

      clearCart: () => set({ items: [], total: 0 }),
    }),
    {
      name: "cart-storage",
    }
  )
);
