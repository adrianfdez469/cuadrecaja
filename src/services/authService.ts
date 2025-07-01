import axios from "axios";

const API_URL = "/api/auth"; // Ruta base del backend

export const cambiarLocal = async (newTiendaId: string) => {
  const response = await axios.post(`${API_URL}/cambiar-tienda`, {
    tiendaId: newTiendaId
  });

  return response;
};

export const cambiarNegocio = async (newNegocioId: string) => {
  const response = await axios.post(`${API_URL}/cambiar-negocio`, {
    negocioId: newNegocioId
  });

  return response;
};

export const getLocalesDisponibles = async () => {
  const response = await axios.get("/api/locales-disponibles");
  return response.data;
};