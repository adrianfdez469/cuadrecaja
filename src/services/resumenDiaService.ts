import axiosClient from "@/lib/axiosClient";
import { IResumenDiaResponse } from "@/schemas/resumenDia";

export const getResumenDia = async (
  tiendaId: string,
  cierreId: string,
  soloConMovimientos = true
): Promise<IResumenDiaResponse> => {
  const response = await axiosClient.get<IResumenDiaResponse>(
    `/api/resumen-dia/${tiendaId}`,
    { params: { cierreId, soloConMovimientos } }
  );
  return response.data;
};
