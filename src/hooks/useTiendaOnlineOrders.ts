"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { ITiendaOnlineOrderListItem } from "@/schemas/tiendaOnline";
import {
  TiendaOnlineForbiddenError,
  fetchTiendaOnlineOrders,
} from "@/services/tiendaOnlineService";

/**
 * The state of the orders inbox.
 *
 * Four rules it has to keep, and they are the design contract's: ONE listing
 * request in flight at a time, the pages already loaded are never replaced by a
 * skeleton while paginating, the automatic refresh obeys its four conditions,
 * and everything painted comes from the last body the server returned.
 */

export type ITiendaOnlineOrdersStatus =
  | "loading"
  | "ready"
  | "error"
  | "offline"
  | "forbidden";

export interface IUseTiendaOnlineOrders {
  status: ITiendaOnlineOrdersStatus;
  orders: ITiendaOnlineOrderListItem[];
  nextCursor: string | null;
  unattendedCount: number;
  unassignedCount: number;
  online: boolean;
  /** A listing request is in flight, whatever started it. */
  busy: boolean;
  /**
   * More than one page is loaded. ONE fact with two consequences: the automatic
   * refresh is paused, and the end of the listing is worth saying out loud.
   */
  multiplePagesLoaded: boolean;
  /** When the last successful load landed, or `null` before the first one. */
  lastLoadedAt: Date | null;
  /** Back to the first page, with a skeleton. Also the retry of the error states. */
  refresh: () => void;
  loadMore: () => void;
}

/** `true` when the request never got an answer: no network, a timeout, DNS. */
function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export function useTiendaOnlineOrders(
  enabled: boolean,
): IUseTiendaOnlineOrders {
  const [status, setStatus] = useState<ITiendaOnlineOrdersStatus>("loading");
  const [orders, setOrders] = useState<ITiendaOnlineOrderListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unattendedCount, setUnattendedCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const { isOnline } = useNetworkStatus();

  // The guard of "one request in flight": a ref and not the state, because two
  // callbacks firing in the same tick would both read a stale `busy`.
  const inFlight = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  nextCursorRef.current = nextCursor;
  const pagesLoadedRef = useRef(0);
  pagesLoadedRef.current = pagesLoaded;

  /* The first page, with a skeleton. Runs on mount and on every `refresh`. */
  useEffect(() => {
    if (!enabled) return;
    let active = true;

    inFlight.current = true;
    setBusy(true);
    setStatus("loading");

    fetchTiendaOnlineOrders({})
      .then((page) => {
        if (!active) return;
        setOrders(page.orders);
        setNextCursor(page.nextCursor);
        setUnattendedCount(page.unattendedCount);
        setUnassignedCount(page.unassignedCount);
        setPagesLoaded(1);
        setLastLoadedAt(new Date());
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        // A 403 renders the shared denied screen. Its body is unreadable — the
        // axios interceptor replaces it (E-009) — and this screen never needed
        // it, and never signs the user out (E-007).
        if (error instanceof TiendaOnlineForbiddenError) {
          setStatus("forbidden");
          return;
        }
        setStatus(isNetworkFailure(error) ? "offline" : "error");
      })
      .finally(() => {
        inFlight.current = false;
        if (active) setBusy(false);
      });

    return () => {
      active = false;
      inFlight.current = false;
    };
  }, [enabled, attempt]);

  /**
   * The automatic refresh: the FIRST page again, silently.
   *
   * It does not run when the tab is hidden, when there is no connection, when a
   * request is already in flight, or when more than one page has been loaded —
   * replacing the first page under an accumulated list would duplicate or lose
   * rows as the cursor moves. Never a skeleton: the list stays where it is.
   */
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!window.navigator.onLine) return;
      if (inFlight.current) return;
      if (pagesLoadedRef.current !== 1) return;

      inFlight.current = true;
      setBusy(true);
      fetchTiendaOnlineOrders({})
        .then((page) => {
          setOrders(page.orders);
          setNextCursor(page.nextCursor);
          setUnattendedCount(page.unattendedCount);
          setUnassignedCount(page.unassignedCount);
          setPagesLoaded(1);
          setLastLoadedAt(new Date());
          setStatus("ready");
        })
        .catch(() => {
          // A failed silent refresh leaves the list and the clock untouched:
          // there is nothing to announce about a request nobody asked for.
        })
        .finally(() => {
          inFlight.current = false;
          setBusy(false);
        });
    }, TIENDA_ONLINE_UI.ordersRefreshMs);

    return () => window.clearInterval(timer);
  }, [enabled]);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    setAttempt((current) => current + 1);
  }, []);

  const loadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (cursor === null || inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    fetchTiendaOnlineOrders({ cursor })
      .then((page) => {
        // The pages already loaded stay where they are: paginating never
        // replaces the list with a skeleton.
        setOrders((current) => [...current, ...page.orders]);
        setNextCursor(page.nextCursor);
        setUnattendedCount(page.unattendedCount);
        setUnassignedCount(page.unassignedCount);
        setPagesLoaded((current) => current + 1);
        setLastLoadedAt(new Date());
      })
      .catch(() => {
        // A failed page leaves the list untouched; the button stays available.
      })
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }, []);

  return useMemo(
    () => ({
      status,
      orders,
      nextCursor,
      unattendedCount,
      unassignedCount,
      online: isOnline,
      busy,
      multiplePagesLoaded: pagesLoaded > 1,
      lastLoadedAt,
      refresh,
      loadMore,
    }),
    [
      status,
      orders,
      nextCursor,
      unattendedCount,
      unassignedCount,
      isOnline,
      busy,
      pagesLoaded,
      lastLoadedAt,
      refresh,
      loadMore,
    ],
  );
}
