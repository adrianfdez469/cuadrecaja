import { IProductoVenta } from "@/schemas/producto";
import { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { ITasaSnapshot } from "@/schemas/tasaCambio";
import { IFaltanteExistencia } from "@/schemas/venta";
import type { IVentaCreditoResumen } from "@/schemas/ventaCredito";
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
  // Multimoneda — se persisten para poder reenviar en sync offline
  monedaCobro?: string;
  pagosDetalle?: IPagoLinea[];
  vueltoDetalle?: IVueltoLinea[];
  tasaSnapshot?: ITasaSnapshot;
  discountTotal?: number;
  // Propina — persistida como el resto del pago para poder reenviarla en el
  // sync offline. El servidor no la puede recalcular.
  tipTotal?: number;
  tipDetail?: IPagoLinea[];
  /**
   * Credit sale — persisted like the rest of the payment so the offline queue can re-send
   * it. `creditoBase` is the part of `total` left as debt, in base currency; the server
   * cannot recompute it (ADR 0104).
   *
   * The three are optional, so a sale queued before this feature rehydrates without them and
   * reads as 0/undefined, which is correct: the persist version and its `migrate` are NOT
   * touched.
   */
  creditoBase?: number;
  clienteId?: string;
  /**
   * The debtor's name. Present even when `clienteId` is, so a queued sale is readable with
   * no catalogue at hand and its ticket prints without going to the network.
   */
  clienteNombre?: string;
  /**
   * The debt of this sale as the server serialized it, or null when it has none. Optional like
   * the three credit fields above, and for the same reason: the `persist` version and its
   * `migrate` are NOT touched, so a sale queued before this feature rehydrates without the field
   * and reads as "no account" — which is correct, because its account does not exist yet.
   */
  credito?: IVentaCreditoResumen | null;
  /**
   * Las líneas que el servidor no pudo cubrir la última vez que se intentó
   * enviar esta venta.
   *
   * Se guarda lo que dijo el servidor en vez de recalcularlo contra el
   * catálogo local: al registrar la venta el POS ya descontó su stock, así que
   * comparar ahora marcaría como problemáticas justo las líneas que sí
   * estaban bien.
   */
  stockShortages?: IFaltanteExistencia[];
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
  /** Aparca la venta: no se reintenta sola, solo a mano. */
  markSyncError: (id: string) => void;
  /** Devuelve la venta a la cola automática tras un fallo pasajero. */
  markSyncRetry: (id: string) => void;
  /** Anota qué líneas rechazó el servidor por existencias. */
  setStockShortages: (id: string, shortages: IFaltanteExistencia[]) => void;
  markSyncing: (id: string) => void;
  deleteSale: (id: string) => void;
  removeProductFromSale: (
    saleIdentifier: string,
    productoTiendaId: string,
    productId: string,
    cantidad: number,
    ventaProductoId?: string,
    productIndex?: number,
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
          const stateProds = state.productos;

          const prodsToAdd: Products[] = [];

          sale.productos.forEach((prod) => {
            const index = state.productos.findIndex(
              (stProd) => stProd.id === prod.productId,
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
            sales: [
              ...state.sales,
              {
                ...sale,
                synced: false,
                // 🆕 VALORES POR DEFECTO PARA NUEVOS CAMPOS
                createdAt: sale.createdAt || Date.now(),
                wasOffline: sale.wasOffline || false,
                syncAttempts: 0,
              },
            ],
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
                syncStartedAt: undefined, // Limpiar timestamp
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
                // `sync_err`, no `not_synced`: esta acción es la que usan los
                // rechazos que el servidor no va a cambiar de opinión (sin
                // existencias, período ajeno, 4xx), y `not_synced` es
                // justamente la cola automática. Devolverla ahí era un bucle:
                // el barrido la recogía, fallaba, la volvía a marcar y vuelta
                // a empezar cada dos segundos, sin tope de intentos posible.
                // Aparcada sigue contando como pendiente y el cajón de ventas
                // la reenvía a mano.
                syncState: "sync_err",
                syncStartedAt: undefined, // Limpiar timestamp
              };
            }
            return sale;
          }),
        })),
      markSyncRetry: (id: string) =>
        set((state) => ({
          sales: state.sales.map((sale) => {
            if (sale.identifier === id) {
              return {
                ...sale,
                synced: false,
                // De vuelta a la cola automática: el fallo fue pasajero (red,
                // timeout, 5xx) y todavía queda margen de intentos.
                syncState: "not_synced",
                syncStartedAt: undefined,
              };
            }
            return sale;
          }),
        })),
      setStockShortages: (id: string, shortages: IFaltanteExistencia[]) =>
        set((state) => ({
          sales: state.sales.map((sale) =>
            sale.identifier === id
              ? { ...sale, stockShortages: shortages }
              : sale,
          ),
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
                syncAttempts: sale.syncAttempts + 1, // 🆕 Incrementar contador de intentos
                // El veredicto anterior deja de valer en cuanto se vuelve a
                // preguntar: puede que ya hayan repuesto.
                stockShortages: undefined,
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
                (removePr) => removePr.productId === prod.id,
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
        productIndexParam?: number,
      ) =>
        set((state) => {
          const sale = state.sales.find((s) => s.identifier === saleIdentifier);
          if (!sale) return state;

          let productIndex: number;
          if (ventaProductoId) {
            productIndex = sale.productos.findIndex(
              (p) => p.ventaProductoId === ventaProductoId,
            );
          } else if (typeof productIndexParam === "number") {
            productIndex = productIndexParam;
          } else {
            productIndex = sale.productos.findIndex(
              (p) =>
                p.productoTiendaId === productoTiendaId &&
                p.productId === productId,
            );
          }
          if (productIndex === -1) return state;

          const productToRemove = sale.productos[productIndex];
          const newProductos = sale.productos.filter(
            (_, i) => i !== productIndex,
          );
          const montoProducto =
            productToRemove.price * productToRemove.cantidad;

          const newSales = state.sales.map((s) => {
            if (s.identifier !== saleIdentifier) return s;
            const updated: Sale = {
              ...s,
              productos: newProductos,
              total: s.total - montoProducto,
            };
            return updated;
          });

          const prods = state.productos
            .map((prod) => {
              if (prod.id === productId) {
                return {
                  ...prod,
                  cantVendida: prod.cantVendida - productToRemove.cantidad,
                };
              }
              return prod;
            })
            .filter((p) => p.cantVendida > 0);

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
                (stProd) => stProd.id === prod.productId,
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

        const hasTimeouts = state.sales.some(
          (sale) =>
            sale.syncState === "syncing" &&
            sale.syncStartedAt &&
            now - sale.syncStartedAt > TIMEOUT_DURATION,
        );

        if (hasTimeouts) {
          set((state) => ({
            sales: state.sales.map((sale) => {
              if (
                sale.syncState === "syncing" &&
                sale.syncStartedAt &&
                now - sale.syncStartedAt > TIMEOUT_DURATION
              ) {
                console.warn(
                  `⚠️ Timeout detectado para venta ${sale.identifier}, marcando como error`,
                );
                return {
                  ...sale,
                  synced: false,
                  syncState: "sync_err",
                  syncStartedAt: undefined,
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
    },
  ),
);
