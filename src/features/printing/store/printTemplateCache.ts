import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRINT_TEMPLATE_CACHE_KEY } from "@/constants/ticket";
import { ITicketPlantilla } from "@/schemas/ticketPlantilla";
import { getTicketPlantilla } from "@/services/ticketPlantillaService";

interface CachedTemplate {
  plantilla: ITicketPlantilla;
  fetchedAt: number;
}

interface PrintTemplateCacheState {
  byTienda: Record<string, CachedTemplate>;
  setPlantilla: (tiendaId: string, plantilla: ITicketPlantilla) => void;
  getPlantilla: (tiendaId: string) => ITicketPlantilla | null;
  fetchAndCache: (tiendaId: string, force?: boolean) => Promise<ITicketPlantilla>;
}

export const usePrintTemplateCache = create<PrintTemplateCacheState>()(
  persist(
    (set, get) => ({
      byTienda: {},
      setPlantilla: (tiendaId, plantilla) =>
        set((state) => ({
          byTienda: {
            ...state.byTienda,
            [tiendaId]: { plantilla, fetchedAt: Date.now() },
          },
        })),
      getPlantilla: (tiendaId) => get().byTienda[tiendaId]?.plantilla ?? null,
      fetchAndCache: async (tiendaId, force = false) => {
        const cached = get().byTienda[tiendaId];
        if (cached && !force) {
          return cached.plantilla;
        }
        try {
          const plantilla = await getTicketPlantilla(tiendaId);
          get().setPlantilla(tiendaId, plantilla);
          return plantilla;
        } catch {
          if (cached) return cached.plantilla;
          throw new Error("No se pudo cargar la plantilla de ticket");
        }
      },
    }),
    { name: PRINT_TEMPLATE_CACHE_KEY },
  ),
);
