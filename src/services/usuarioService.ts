import axiosClient from "@/lib/axiosClient";
import type { IUsuarioListItem, IUsuarioPayload } from "@/schemas/usuario";
export type { IUsuarioBasico, IUsuarioListItem } from "@/schemas/usuario";

const API_URL = "/api/usuarios";

export const getUsuarios = async (): Promise<IUsuarioListItem[]> => {
  const response = await axiosClient.get<IUsuarioListItem[]>(API_URL);
  return response.data;
};

export const createUsuario = async (payload: IUsuarioPayload): Promise<IUsuarioListItem> => {
  const response = await axiosClient.post<IUsuarioListItem>(API_URL, payload);
  return response.data;
};

export const updateUsuario = async (id: string, payload: IUsuarioPayload): Promise<IUsuarioListItem> => {
  const response = await axiosClient.put<IUsuarioListItem>(`${API_URL}/${id}`, payload);
  return response.data;
};

export const reenviarInvitacionUsuario = async (id: string): Promise<void> => {
  await axiosClient.post(`${API_URL}/${id}/reinvitar`);
};

export const deleteUsuario = async (id: string): Promise<void> => {
  await axiosClient.delete(`${API_URL}/${id}`);
};