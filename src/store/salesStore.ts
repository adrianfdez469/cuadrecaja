import { IProductoVenta } from "@/types/IProducto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Sale {
  identifier: string;
  tiendaId: string; 
  cierreId: string;
  usuarioId: string;
  total: number;
  totalcash: number;
  totaltransfer: number;
  productos:  (IProductoVenta & {name: string})[] 
  
  synced: boolean;
}

interface Products {
  id: string;
  nombre: string;
  cantVendida: number;
}

interface SalesState {
  sales: Sale[];
  productos: Products[]; 
  addSale: (sale: Omit<Sale, 'synced'>) => void;
  markSynced: (id: string) => void;
  clearSales: () => void;
}

export const useSalesStore = create<SalesState>()(
  
  persist(
    (set) => ({
      sales: [],
      productos: [],
      addSale: (sale) => set((state) => {
        const stateProds = state.productos;
        const prodsToAdd:Products[] = [];
        sale.productos.forEach((prod) => {
          const index = state.productos.findIndex(stProd => stProd.id === prod.productId);
          if(index >= 0) {
            stateProds[index].cantVendida += prod.cantidad;
          } else {
            prodsToAdd.push({
              id: prod.productId,
              cantVendida: prod.cantidad, 
              nombre: prod.name
            });
          }
        });
        return {
        fullySynced: false,
        sales: [...state.sales, {...sale, synced: false}],
        productos: [...stateProds, ...prodsToAdd]
      }}),
      markSynced: (id: string) => set((state) => ({
        sales: state.sales.map(sale => {
          if(sale.identifier === id) {
            return {...sale, synced: true};
          }
          return sale;
        })
      })),
      clearSales: () => set({ sales: [], productos: [] }),
    }),
    {
      name: 'sales-storage', // nombre de la clave en localStorage
    }
  )
)