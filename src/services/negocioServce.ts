import { INegocio } from "@/types/INegocio";
import axios from "axios";

const API_URL = "/api/negocio"; // Ruta base del backend

export const getNegocios = async () => {
  const response = await axios.get<INegocio[]>(API_URL);
  return response.data;
}

export const createNegocio =  async (nombre, locallimit, userlimit) => {
  const response = await axios.post(API_URL, {
    nombre, locallimit, userlimit
  });
  return response.data;
}