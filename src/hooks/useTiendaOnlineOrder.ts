"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import type { ITiendaOnlineOrder } from "@/schemas/tiendaOnline";
import {
  TiendaOnlineForbiddenError,
  TiendaOnlineOrderNotFound,
  fetchTiendaOnlineOrder,
} from "@/services/tiendaOnlineService";

/**
 * One order, for the detail route.
 *
 * There is NO automatic refresh here, and that is the design contract's
 * decision: an open order is being read, not watched, and reloading it under
 * somebody's finger would move the text they are reading.
 */

export type ITiendaOnlineOrderStatus =
  | "loading"
  | "ready"
  | "error"
  | "offline"
  | "forbidden"
  | "not-found";

export interface IUseTiendaOnlineOrder {
  status: ITiendaOnlineOrderStatus;
  order: ITiendaOnlineOrder | null;
  retry: () => void;
}

/** `true` when the request never got an answer: no network, a timeout, DNS. */
function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export function useTiendaOnlineOrder(
  pedidoId: string,
  enabled: boolean,
): IUseTiendaOnlineOrder {
  const [status, setStatus] = useState<ITiendaOnlineOrderStatus>("loading");
  const [order, setOrder] = useState<ITiendaOnlineOrder | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    setStatus("loading");
    fetchTiendaOnlineOrder(pedidoId)
      .then((detail) => {
        if (!active) return;
        setOrder(detail.order);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        // The same 404 for an order of another business, one of a store you are
        // not assigned to, one with no store, and one that does not exist.
        if (error instanceof TiendaOnlineOrderNotFound) {
          setStatus("not-found");
          return;
        }
        if (error instanceof TiendaOnlineForbiddenError) {
          setStatus("forbidden");
          return;
        }
        setStatus(isNetworkFailure(error) ? "offline" : "error");
      });

    return () => {
      active = false;
    };
  }, [enabled, pedidoId, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return useMemo(() => ({ status, order, retry }), [status, order, retry]);
}
