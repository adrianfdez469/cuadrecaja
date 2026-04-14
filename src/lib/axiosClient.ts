import axios, { AxiosRequestConfig } from "axios";
import { signOut } from "next-auth/react";

export interface RetryConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

const axiosClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Retry interceptor — network errors and timeouts only, max 2 retries
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryConfig;

    if (
      (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") &&
      config &&
      (config._retryCount ?? 0) < 2
    ) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      console.log(`🔄 Reintentando petición (intento ${config._retryCount}/2)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return axiosClient(config);
    }

    const status = error.response?.status;

    if (status === 401) {
      await signOut({ callbackUrl: "/login" });
      return Promise.reject(error);
    }

    if (status === 403) {
      const url = error.config?.url ?? "recurso desconocido";
      return Promise.reject(
        new Error(`Acceso denegado a ${url}. Por favor asigne los permisos necesarios.`)
      );
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
