import { INegocio } from "@/types/INegocio";
import axios from "axios";

const API_URL = "/api/negocio"; // Ruta base del backend

export const getNegocios = async () => {
  const response = await axios.get<INegocio[]>(API_URL);
  return response.data;
}

export const createNegocio = async (nombre: string, locallimit: number, userlimit: number, productlimit: number, duracion: number, planId?: string) => {
  const response = await axios.post(API_URL, {
    nombre,
    locallimit,
    userlimit,
    productlimit,
    duracion,
    planId,
  });
  return response.data;
}

export const updateNegocio = async (id: string, nombre: string, locallimit: number, userlimit: number, productlimit: number, planId?: string) => {
  const response = await axios.put(`${API_URL}/${id}`, {
    nombre,
    locallimit,
    userlimit,
    productlimit,
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