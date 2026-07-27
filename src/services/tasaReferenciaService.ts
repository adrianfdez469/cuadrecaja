import axiosClient from "@/lib/axiosClient";
import type { ITasasReferenciaResponse } from "@/schemas/tasaReferencia";

export const getTasasReferencia =
  async (): Promise<ITasasReferenciaResponse> => {
    const res = await axiosClient.get("/api/tasas-referencia");
    return res.data;
  };
