import axiosClient from "@/lib/axiosClient";

export interface IUsuarioBasico {
  id: string;
  nombre: string;
  usuario: string;
  rol?: string;
}

interface IUsuarioPayload {
  nombre: string;
  usuario: string;
  password?: string;
}

const API_URL = "/api/usuarios";

export const getUsuarios = async (): Promise<IUsuarioBasico[]> => {
  const response = await axiosClient.get<IUsuarioBasico[]>(API_URL);
  return response.data;
};

export const createUsuario = async (payload: IUsuarioPayload): Promise<IUsuarioBasico> => {
  const response = await axiosClient.post<IUsuarioBasico>(API_URL, payload);
  return response.data;
};

export const updateUsuario = async (id: string, payload: IUsuarioPayload): Promise<IUsuarioBasico> => {
  const response = await axiosClient.put<IUsuarioBasico>(`${API_URL}/${id}`, payload);
  return response.data;
};

export const deleteUsuario = async (id: string): Promise<void> => {
  await axiosClient.delete(`${API_URL}/${id}`);
};