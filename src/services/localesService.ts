import axios from "axios";
import { ILocal } from "@/types/ILocal";

const API_URL = '/api/locales';

interface ILocalPayload {
  nombre: string;
  tipo: string;
  usuariosRoles: { usuarioId: string; rolId?: string }[];
}

export const getLocales = async (): Promise<ILocal[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const createLocal = async (payload: ILocalPayload): Promise<ILocal> => {
  const response = await axios.post(API_URL, payload);
  return response.data;
};

export const updateLocal = async (id: string, payload: ILocalPayload): Promise<ILocal> => {
  const response = await axios.put(`${API_URL}/${id}`, payload);
  return response.data;
};

export const deleteLocal = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};

