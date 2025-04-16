import { ICierreData } from "@/types/ICierre";
import { ICierrePeriodo } from "@/types/ICierre";
import axios from "axios";

const API_URL = (tiendaId) => `/api/cierre/${tiendaId}`; // Ruta base del backend

export const fetchLastPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.get<ICierrePeriodo>(`${API_URL(tiendaId)}/last`);
  return response.data;
};

export const openPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/open`);
  console.log(response); 
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