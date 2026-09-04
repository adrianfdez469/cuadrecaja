import axiosClient from "@/lib/axiosClient";
import { TIENDA_ONLINE_API_BASE } from "@/constants/tiendaOnline";
import { tiendaOnlineEstadoSchema } from "@/schemas/tiendaOnline";
import type { ITiendaOnlineEstado } from "@/schemas/tiendaOnline";

/**
 * GET /api/tienda-online/estado
 *
 * The only function of this file in F-004: the other three routes have no UI
 * caller yet, and a service wrapper without a caller is dead code. F-005 and
 * F-011 add theirs when they have a screen to feed.
 */
export const getTiendaOnlineEstado = async (): Promise<ITiendaOnlineEstado> => {
  const response = await axiosClient.get(`${TIENDA_ONLINE_API_BASE}/estado`);
  return tiendaOnlineEstadoSchema.parse(response.data);
};
