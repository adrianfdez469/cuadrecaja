import { IProductoVenta } from "@/types/IProducto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Sale {
  dbId?: string;
  identifier: string;
  tiendaId: string;
  cierreId: string;
  usuarioId: string;
  total: number;
  totalcash: number;
  totaltransfer: number;
  productos: (IProductoVenta & { name: string })[];

  synced: boolean;
  syncState: "synced" | "syncing" | "not_synced" | "sync_err";
}

export interface Products {
  id: string;
  nombre: string;
  cantVendida: number;
}

interface SalesState {
  sales: Sale[];
  productos: Products[];
  addSale: (sale: Omit<Sale, "synced">) => void;
  markSynced: (id: string, idDb: string) => void;
  markSyncError: (id: string) => void;
  markSyncing: (id: string) => void;
  deleteSale: (id: string) => void;
  clearSales: () => void;
  synchronizeSales: (sales: Sale[]) => void;
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set) => ({
      sales: [],
      productos: [],
      addSale: (sale) =>
        set((state) => {
         console.log('entra a agregar sale');
         
          
          const stateProds = state.productos;
          console.log(stateProds);
          console.log(sale);
          
          
          const prodsToAdd: Products[] = [];
          
          sale.productos.forEach((prod) => {
            const index = state.productos.findIndex(
              (stProd) => stProd.id === prod.productId
            );
            if (index >= 0) {
              stateProds[index].cantVendida += prod.cantidad;
            } else {
              prodsToAdd.push({
                id: prod.productId,
                cantVendida: prod.cantidad,
                nombre: prod.name,
              });
            }
          });
          return {
            fullySynced: false,
            sales: [...state.sales, { ...sale, synced: false }],
            productos: [...stateProds, ...prodsToAdd],
          };
        }),
      markSynced: (id: string, idDb: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { ...sale, synced: true, syncState: "synced", dbId: idDb };
            }
            return sale;
          }),
        })),
      markSyncError: (id: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { ...sale, synced: false, syncState: "not_synced" };
            }
            return sale;
          }),
        })),
      markSyncing: (id: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { ...sale, synced: false, syncState: "syncing" };
            }
            return sale;
          }),
        })),
      clearSales: () => set({ sales: [], productos: [] }),
      deleteSale: (id: string) =>
        set((state) => {
          const saleToRemove = state.sales.find((s) => s.identifier === id);
          const sales = state.sales.filter((s) => s.identifier !== id);

          const prods = state.productos
            .map((prod) => {
              const removePr = saleToRemove.productos.find(
                (removePr) => removePr.productId === prod.id
              );
              if (removePr) {
                return {
                  ...prod,
                  cantVendida: prod.cantVendida - removePr.cantidad,
                };
              }
              return prod;
            })
            .filter((p) => p.cantVendida > 0);
          return {
            ...state,
            productos: prods,
            sales: sales,
          };
        }),
      synchronizeSales: (sales: Sale[]) =>
        set((state) => {

          console.log(sales);
          

          const salesToKeep = state.sales.filter((s) => !s.synced);
          const newSales = [...salesToKeep, ...sales];

          const prods: Products[] = [];

          newSales.forEach((sale) => {
            sale.productos.forEach((prod) => {
              const index = prods.findIndex(
                (stProd) => stProd.id === prod.productId
              );
              if (index >= 0) {
                prods[index].cantVendida += prod.cantidad;
              } else {
                prods.push({
                  id: prod.productId,
                  cantVendida: prod.cantidad,
                  nombre: prod.name,
                });
              }
            });
          });
          state.clearSales();
          return {
            ...state,
            sales: newSales,
            productos: prods,
          };
        }),
    }),
    {
      name: "sales-storage", // nombre de la clave en localStorage
    }
  )
);
