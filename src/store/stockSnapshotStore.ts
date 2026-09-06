import { create } from "zustand";

/**
 * Cuánto se puede vender de cada producto, según el último catálogo cargado.
 *
 * Existe para que cualquier pantalla pueda señalar una línea que la tienda no
 * cubre —el carrito, el detalle de una venta— sin recibir el catálogo entero
 * por props a través de tres componentes que no lo necesitan para nada más.
 *
 * No se persiste: se deriva del catálogo, que ya tiene su propia caché, y una
 * copia guardada aparte solo podría contradecirla.
 */
interface StockSnapshotState {
  /** productoTiendaId → unidades vendibles, incluidas las de paquetes sin abrir. */
  disponiblePorProductoTienda: Record<string, number>;
  setSnapshot: (snapshot: Record<string, number>) => void;
}

export const useStockSnapshotStore = create<StockSnapshotState>((set) => ({
  disponiblePorProductoTienda: {},
  setSnapshot: (snapshot) => set({ disponiblePorProductoTienda: snapshot }),
}));

/**
 * Lo que queda de este producto, o `undefined` si el catálogo no lo conoce
 * —todavía no ha cargado, o la venta es de un producto que ya no está—. Sin
 * dato no se afirma nada: quien lo use no debe marcar la línea.
 *
 * Devuelve un número y no un objeto a propósito: un selector que construye su
 * resultado en cada llamada vuelve a renderizar con cualquier cambio del
 * store, aunque su producto no se haya movido.
 */
export function useDisponibleLocal(
  productoTiendaId: string,
): number | undefined {
  return useStockSnapshotStore(
    (state) => state.disponiblePorProductoTienda[productoTiendaId],
  );
}

/** Unidades que le faltan a una línea. 0 cuando el catálogo la cubre o la desconoce. */
export function faltanteDeLinea(
  cantidad: number,
  disponible: number | undefined,
): number {
  if (disponible === undefined) return 0;
  return Math.max(0, cantidad - disponible);
}
