import axios from "axios";

export interface IUsuarioBasico {
  id: string;
  nombre: string;
  usuario: string;
  rol?: string;
}

const API_URL = "/api/usuarios";

export const getUsuarios = async (): Promise<IUsuarioBasico[]> => {
  const response = await axios.get<IUsuarioBasico[]>(API_URL);
  return response.data;
}; 