import axiosClient from "@/lib/axiosClient";
import { ILocal } from "@/types/ILocal";

const API_URL = '/api/locales';

interface ILocalPayload {
  nombre: string;
  tipo: string;
  usuariosRoles: { usuarioId: string; rolId?: string }[];
}

export const getLocales = async (): Promise<ILocal[]> => {
  const response = await axiosClient.get(API_URL);
  return response.data;
};

export const createLocal = async (payload: ILocalPayload): Promise<ILocal> => {
  const response = await axiosClient.post(API_URL, payload);
  return response.data;
};

export const updateLocal = async (id: string, payload: ILocalPayload): Promise<ILocal> => {
  const response = await axiosClient.put(`${API_URL}/${id}`, payload);
  return response.data;
};

export const deleteLocal = async (id: string): Promise<void> => {
  await axiosClient.delete(`${API_URL}/${id}`);
};

