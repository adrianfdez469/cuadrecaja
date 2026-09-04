"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import {
  TiendaOnlineForbiddenError,
  getTiendaOnlineConfiguracion,
  updateTiendaOnlineLocal,
} from "@/services/tiendaOnlineService";
import type {
  ITiendaOnlineLocal,
  ITiendaOnlineLocalUpdate,
} from "@/schemas/tiendaOnline";

/**
 * Five states, so the screen can tell «not yet» from «no» from «no network».
 * `offline` is a separate one on purpose: this application sells without a
 * connection, so losing it is a normal state and not a fault.
 */
export type ITiendaOnlineConfigStatus =
  | "loading"
  | "ready"
  | "error"
  | "offline"
  | "forbidden";

export interface IUseTiendaOnlineConfiguracion {
  status: ITiendaOnlineConfigStatus;
  locales: ITiendaOnlineLocal[];
  online: boolean;
  reload: () => void;
  /** Applies one local's block and returns the local as it ended up. */
  save: (
    tiendaId: string,
    body: ITiendaOnlineLocalUpdate,
  ) => Promise<ITiendaOnlineLocal>;
}

/** `true` when the request never got an answer: no network, a timeout, DNS. */
function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export function useTiendaOnlineConfiguracion(
  enabled: boolean,
): IUseTiendaOnlineConfiguracion {
  const [status, setStatus] = useState<ITiendaOnlineConfigStatus>("loading");
  const [locales, setLocales] = useState<ITiendaOnlineLocal[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(window.navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    setStatus("loading");
    getTiendaOnlineConfiguracion()
      .then((configuracion) => {
        if (!active) return;
        setLocales(configuracion.locales);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        // A 403 renders the shared denied screen. Its body is unreadable — the
        // axios interceptor replaces it (E-009) — and this screen never needed
        // it: it must not assert which of the three causes applies, and it
        // never signs the user out (E-007).
        if (error instanceof TiendaOnlineForbiddenError) {
          setStatus("forbidden");
          return;
        }
        setStatus(isNetworkFailure(error) ? "offline" : "error");
      });

    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const save = useCallback(
    async (tiendaId: string, body: ITiendaOnlineLocalUpdate) => {
      const result = await updateTiendaOnlineLocal(tiendaId, body);
      setLocales((current) =>
        current.map((local) =>
          local.id === result.local.id ? result.local : local,
        ),
      );
      return result.local;
    },
    [],
  );

  return { status, locales, online, reload, save };
}
