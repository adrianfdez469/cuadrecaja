import { ICierreData } from "@/schemas/cierre";
import { ICierrePeriodo } from "@/schemas/cierre";
import axios from "@/lib/axiosClient";

const API_URL = (tiendaId) => `/api/cierre/${tiendaId}`; // Ruta base del backend

export const fetchLastPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.get<ICierrePeriodo>(`${API_URL(tiendaId)}/last`);
  return response.data;
};

export const openPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/open`);
  return response.data;
}

export const fetchCierreData = async (tiendaId: string, cierreId: string) => {
  const response = await axios.get<ICierreData>(`${API_URL(tiendaId)}/${cierreId}`);
  return response.data;
};

export const closePeriod = async (tiendaId: string, cierreId: string): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/${cierreId}/close`);
  return response.data;
}