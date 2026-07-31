import axios, { AxiosRequestConfig } from "axios";
import { signOut } from "next-auth/react";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";

export interface RetryConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

export { IDEMPOTENCY_KEY_HEADER };

const MAX_RETRIES = 2;

// Idempotent by HTTP semantics: repeating them does not change the outcome, so
// retrying needs no coordination with the server.
// NOTE: PUT and DELETE only qualify if the handler is written that way — a
// DELETE that applies a delta (reverting stock, recording an adjustment) is not
// idempotent no matter what the verb promises. See docs/idempotencia.md.
const IDEMPOTENT_METHODS = new Set(["get", "head", "options", "put", "delete"]);

/**
 * Blindly retrying a POST duplicates data: the client times out, but the server
 * cancels nothing, so the original request stays alive and commits anyway (this
 * caused duplicated stock movements on slow networks).
 *
 * Hence the safe-by-default policy: POST/PATCH are retried only when they carry
 * an idempotency key, meaning the endpoint knows how to recognise the resend
 * and not apply it twice.
 */
const canRetry = (config: RetryConfig): boolean => {
  const method = (config.method ?? "get").toLowerCase();
  if (IDEMPOTENT_METHODS.has(method)) return true;

  const headers = config.headers ?? {};
  return Boolean(
    headers[IDEMPOTENCY_KEY_HEADER] ??
    headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()],
  );
};

/**
 * Exponential backoff with jitter. Without the jitter, several tills coming back
 * from the same outage retry in lockstep and hammer each other.
 */
const retryDelayMs = (attempt: number): number => {
  const base = 1000 * 2 ** (attempt - 1); // 1s, 2s
  return base + Math.random() * 500;
};

const axiosClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Retry interceptor — network errors and timeouts only, and only when repeating
// the request is safe (see canRetry).
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryConfig;

    if (
      (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") &&
      config &&
      (config._retryCount ?? 0) < MAX_RETRIES &&
      canRetry(config)
    ) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      console.log(
        `🔄 Reintentando petición (intento ${config._retryCount}/${MAX_RETRIES})...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs(config._retryCount)),
      );
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
        new Error(
          `Acceso denegado a ${url}. Por favor asigne los permisos necesarios.`,
        ),
      );
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
