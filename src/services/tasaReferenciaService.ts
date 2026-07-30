import axiosClient from "@/lib/axiosClient";
import type { ITasasReferenciaResponse } from "@/schemas/tasaReferencia";

/**
 * @param force refresco pedido explícitamente por el usuario; permite traer un dato más
 *   nuevo que el TTL normal de la caché (ver `src/constants/eltoque.ts`).
 */
export const getTasasReferencia = async (
  force = false,
): Promise<ITasasReferenciaResponse> => {
  const res = await axiosClient.get("/api/tasas-referencia", {
    params: force ? { force: 1 } : undefined,
  });
  return res.data;
};
