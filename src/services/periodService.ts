import { ICierrePeriodo } from "@/types/ICierre";
import axios from "axios";

const API_URL = (tiendaId) => `/api/cierre/${tiendaId}`; // Ruta base del backend

export const fetchLastPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.get<ICierrePeriodo>(`${API_URL(tiendaId)}/last`);
  console.log(response.data);
  
  return response.data;
};

export const closePeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/close`);
  return response.data;
}

export const openPeriod = async (tiendaId): Promise<ICierrePeriodo|undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/open`);
  console.log(response); 
  return response.data;
}