import axios from "axios";
import { signOut } from "next-auth/react";

const axiosClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;


    if (status === 401) {
      await signOut({ callbackUrl: "/login" });
      return Promise.reject(error);
    }

    if (status === 403) {
      const url = error.config?.url ?? "recurso desconocido";
      const error403 = new Error(`Acceso denegado a ${url}. Por favor asigne los permisos necesarios.`);
      return Promise.reject(error403);
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
