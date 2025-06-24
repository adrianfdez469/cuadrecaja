import { INegocio } from "@/types/INegocio";
import axios from "axios";

const API_URL = "/api/negocio"; // Ruta base del backend

export const getNegocios = async () => {
  const response = await axios.get<INegocio[]>(API_URL);
  return response.data;
}

export const createNegocio = async (nombre: string, locallimit: number, userlimit: number, productlimit: number) => {
  const response = await axios.post(API_URL, {
    nombre, 
    locallimit, 
    userlimit,
    productlimit
  });
  return response.data;
}

export const updateNegocio = async (id: string, nombre: string, locallimit: number, userlimit: number, productlimit: number) => {
  const response = await axios.put(`${API_URL}/${id}`, {
    nombre,
    locallimit,
    userlimit,
    productlimit
  });
  return response.data;
}

export const deleteNegocio = async (id: string) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
}