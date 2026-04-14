import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/transfer-destinations";

export const fetchTransferDestinations = async (tiendaId: string) => {
  const response = await axiosClient.get(`${API_URL}?tiendaId=${tiendaId}`);
  return response.data;
};

export const createTransferDestination = async (nombre: string, descripcion: string, isDefault: boolean, tiendaId: string) => {
  const response = await axiosClient.post(API_URL, { nombre, descripcion, default: isDefault, tiendaId });
  return response.data;
};

export const updateTransferDestination = async (id: string, nombre: string, descripcion: string, isDefault: boolean) => {
  const response = await axiosClient.put(`${API_URL}/${id}`, { nombre, descripcion, default: isDefault });
  return response.data;
};

export const deleteTransferDestination = async (id: string) => {
  await axiosClient.delete(`${API_URL}/${id}`);
};