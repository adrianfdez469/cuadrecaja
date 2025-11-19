import { ISummaryCierre } from "@/types/ICierre";
import axios from "axios";

const API_URL = (tiendaId) => `/api/cierre/${tiendaId}/summary`; // Ruta base del backend

export const getResumenCierres = async (tiendaId, take: number, skip: number, intervalo?: {fechaInicio?: Date, fechaFin?: Date}) => {
  
  const response = await axios.get<ISummaryCierre>(`${API_URL(tiendaId)}`, {
    params: {
      take, 
      skip,
      ...(intervalo?.fechaInicio && {fechaInicio: intervalo.fechaInicio}),
      ...(intervalo?.fechaFin && {fechaFin: intervalo.fechaFin})
    }
  });

  return response.data;
}