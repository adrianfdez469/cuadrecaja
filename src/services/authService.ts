import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/auth"; // Ruta base del backend

export const cambiarLocal = async (newTiendaId: string) => {
  const response = await axiosClient.post(`${API_URL}/cambiar-tienda`, {
    tiendaId: newTiendaId
  });

  return response;
};

export const cambiarNegocio = async (newNegocioId: string) => {
  const response = await axiosClient.post(`${API_URL}/cambiar-negocio`, {
    negocioId: newNegocioId
  });

  return response;
};

export const getLocalesDisponibles = async () => {
  const response = await axiosClient.get("/api/locales-disponibles");
  return response.data;
};