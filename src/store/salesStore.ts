import { IProductoVenta } from "@/types/IProducto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SaleProduct extends IProductoVenta {
  name: string;
  ventaProductoId?: string; // Para ventas sincronizadas: ID en DB para eliminar producto
}

export interface Sale {
  dbId?: string;
  identifier: string;
  tiendaId: string;
  cierreId: string;
  usuarioId: string;
  total: number;
  totalcash: number;
  totaltransfer: number;
  productos: SaleProduct[];

  synced: boolean;
  syncState: "synced" | "syncing" | "not_synced" | "sync_err";
  transferDestinationId?: string;
  syncStartedAt?: number; // Timestamp cuando comenzó la sincronización
  
  // 🆕 NUEVOS CAMPOS
  createdAt: number; // Timestamp exacto de creación de la venta
  wasOffline: boolean; // Si la venta se creó sin conexión
  syncAttempts: number; // Contador de intentos de sincronización
  // 🆕 Códigos de descuento aplicados en la venta (para sincronización)
  discountCodes?: string[];
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
  removeProductFromSale: (
    saleIdentifier: string,
    productoTiendaId: string,
    productId: string,
    cantidad: number,
    ventaProductoId?: string,
    productIndex?: number
  ) => void;
  clearSales: () => void;
  synchronizeSales: (sales: Sale[]) => void;
  checkSyncTimeouts: () => void;
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      sales: [],
      productos: [],
      addSale: (sale) =>
        set((state) => {
         console.log('entra a agregar sale');
         
          
          const stateProds = state.productos;
          console.log(stateProds);
          console.log('sale',sale);
          
          
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
            sales: [...state.sales, { 
              ...sale, 
              synced: false,
              // 🆕 VALORES POR DEFECTO PARA NUEVOS CAMPOS
              createdAt: sale.createdAt || Date.now(),
              wasOffline: sale.wasOffline || false,
              syncAttempts: 0
            }],
            productos: [...stateProds, ...prodsToAdd],
          };
        }),
      markSynced: (id: string, idDb: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { 
                ...sale, 
                synced: true, 
                syncState: "synced", 
                dbId: idDb,
                syncStartedAt: undefined // Limpiar timestamp
                // 🆕 NO limpiar syncAttempts - se mantiene para guardar en DB
              };
            }
            return sale;
          }),
        })),
      markSyncError: (id: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { 
                ...sale, 
                synced: false, 
                syncState: "not_synced",
                syncStartedAt: undefined // Limpiar timestamp
              };
            }
            return sale;
          }),
        })),
      markSyncing: (id: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return { 
                ...sale, 
                synced: false, 
                syncState: "syncing",
                syncStartedAt: Date.now(), // Registrar cuando comenzó la sincronización
                syncAttempts: sale.syncAttempts + 1 // 🆕 Incrementar contador de intentos
              };
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
              const removePr = saleToRemove?.productos.find(
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
      removeProductFromSale: (
        saleIdentifier: string,
        productoTiendaId: string,
        productId: string,
        cantidad: number,
        ventaProductoId?: string,
        productIndexParam?: number
      ) =>
        set((state) => {
          const sale = state.sales.find((s) => s.identifier === saleIdentifier);
          if (!sale) return state;

          let productIndex: number;
          if (ventaProductoId) {
            productIndex = sale.productos.findIndex((p) => p.ventaProductoId === ventaProductoId);
          } else if (typeof productIndexParam === "number") {
            productIndex = productIndexParam;
          } else {
            productIndex = sale.productos.findIndex(
              (p) => p.productoTiendaId === productoTiendaId && p.productId === productId
            );
          }
          if (productIndex === -1) return state;

          const productToRemove = sale.productos[productIndex];
          const newProductos = sale.productos.filter((_, i) => i !== productIndex);
          const montoProducto = productToRemove.price * productToRemove.cantidad;

          const newSales = state.sales.map((s) => {
            if (s.identifier !== saleIdentifier) return s;
            const updated: Sale = {
              ...s,
              productos: newProductos,
              total: s.total - montoProducto,
            };
            return updated;
          });

          const prods = state.productos.map((prod) => {
            if (prod.id === productId) {
              return { ...prod, cantVendida: prod.cantVendida - productToRemove.cantidad };
            }
            return prod;
          }).filter((p) => p.cantVendida > 0);

          return { ...state, sales: newSales, productos: prods };
        }),
      synchronizeSales: (sales: Sale[]) =>
        set((state) => {

          const salesToKeep = state.sales
            .filter((s) => !sales.find((s2) => s2.identifier === s.identifier))
            .filter((s) => !s.synced);

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
      checkSyncTimeouts: () => {
        const state = get();
        const now = Date.now();
        const TIMEOUT_DURATION = 60000; // 60 segundos de timeout
        
        const hasTimeouts = state.sales.some(sale => 
          sale.syncState === "syncing" && 
          sale.syncStartedAt && 
          (now - sale.syncStartedAt) > TIMEOUT_DURATION
        );
        
        if (hasTimeouts) {
          set((state) => ({
            sales: state.sales.map((sale) => {
              if (sale.syncState === "syncing" && 
                  sale.syncStartedAt && 
                  (now - sale.syncStartedAt) > TIMEOUT_DURATION) {
                console.warn(`⚠️ Timeout detectado para venta ${sale.identifier}, marcando como error`);
                return { 
                  ...sale, 
                  synced: false, 
                  syncState: "sync_err",
                  syncStartedAt: undefined
                };
              }
              return sale;
            }),
          }));
        }
      },
    }),
    {
      name: "sales-storage", // nombre de la clave en localStorage
    }
  )
);
