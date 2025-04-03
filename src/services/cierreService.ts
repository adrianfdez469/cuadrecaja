import { ICierreData } from "@/types/ICierre";
import axios from "axios";

const API_URL = (tiendaId: string, cierreId: string) => `/api/cierre/${tiendaId}/${cierreId}`; // Ruta base del backend

export const fetchCierreData = async (tiendaId: string, cierreId: string) => {
  const response = await axios.get<ICierreData>(API_URL(tiendaId, cierreId));
  return response.data;
};