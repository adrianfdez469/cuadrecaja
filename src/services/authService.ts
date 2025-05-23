import axios from "axios";

const API_URL = "/api/auth"; // Ruta base del backend

export const cambierTienda = async (newTiendaId: string) => {
  const response = await axios.post(`${API_URL}/cambiar-tienda`, {
    tiendaId: newTiendaId
  });

  return response;
};

export const cambierNegocio = async (newNegocioId: string) => {
  const response = await axios.post(`${API_URL}/cambiar-negocio`, {
    negocioId: newNegocioId
  });

  return response;
};