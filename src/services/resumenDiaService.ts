import axios from "axios";
import { IResumenDiaResponse } from "@/schemas/resumenDia";

export const getResumenDia = async (
  tiendaId: string,
  cierreId: string
): Promise<IResumenDiaResponse> => {
  const response = await axios.get<IResumenDiaResponse>(
    `/api/resumen-dia/${tiendaId}`,
    { params: { cierreId } }
  );
  return response.data;
};
