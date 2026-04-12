import { INegocio } from "@/types/INegocio";
import axios from "axios";

const API_URL = "/api/negocio"; // Ruta base del backend

export const getNegocios = async (options?: { soloActivacionLanding?: boolean }) => {
  const response = await axios.get<INegocio[]>(API_URL, {
    params:
      options?.soloActivacionLanding === true
        ? { soloActivacionLanding: 'true' }
        : undefined,
  });
  return response.data;
}

export const createNegocio = async (nombre: string, duracion: number, planId?: string) => {
  const response = await axios.post(API_URL, {
    nombre,
    duracion,
    planId,
  });
  return response.data;
}

export const updateNegocio = async (id: string, nombre: string, planId?: string) => {
  const response = await axios.put(`${API_URL}/${id}`, {
    nombre,
    planId,
  });
  return response.data;
}

export const deleteNegocio = async (id: string) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
}

export const getNegocioStats = async () => {
  const response = await axios.get(`${API_URL}/stats`);
  return response.data;
}