import { create } from "zustand";
import { getMovimientosProductosEnviados } from "@/services/movimientoService";
import { IMovimientoProductoEnviado } from "@/schemas/movimiento";

interface PendingReceptionState {
  tiendaId: string | null;
  items: IMovimientoProductoEnviado[];
  loading: boolean;
  fetch: (tiendaId: string) => Promise<void>;
}

// Compartido entre el badge del tab, el cintillo y el modal de aceptación en
// MovimientosView, para no triplicar el fetch de pendientes de recepción.
export const usePendingReceptionStore = create<PendingReceptionState>(
  (set) => ({
    tiendaId: null,
    items: [],
    loading: false,
    fetch: async (tiendaId: string) => {
      set({ loading: true });
      try {
        const items = await getMovimientosProductosEnviados(tiendaId);
        set({ tiendaId, items: items || [], loading: false });
      } catch (error) {
        console.error(
          "Error al cargar movimientos pendientes de recepción:",
          error,
        );
        set({ loading: false });
      }
    },
  }),
);
