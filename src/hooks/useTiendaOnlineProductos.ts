"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import {
  TiendaOnlineForbiddenError,
  fetchTiendaOnlineProductos,
  updateCategoriaPublicacionMasiva,
  updateProductoPublicacion,
} from "@/services/tiendaOnlineService";
import type {
  ITiendaOnlineBulkResult,
  ITiendaOnlineProducto,
} from "@/schemas/tiendaOnline";

/**
 * The state of the publishing tab.
 *
 * It is called from the PAGE and not from the tab body: switching to Locales
 * unmounts the tab body — the other tab's markup must not be in the DOM — and a
 * hook living there would lose the filter and every page already loaded on every
 * round trip.
 */

export type ITiendaOnlineProductosStatus =
  | "loading"
  | "ready"
  | "error"
  | "offline"
  | "forbidden";

export interface IUseTiendaOnlineProductos {
  status: ITiendaOnlineProductosStatus;
  productos: ITiendaOnlineProducto[];
  nextCursor: string | null;
  /** Products matching the filter. Only ever a number when a category is chosen. */
  total: number | null;
  puedePublicar: boolean;
  online: boolean;
  loadingMore: boolean;
  /** What the merchant typed, before the debounce. */
  search: string;
  categoriaId: string;
  /** Products with a request of their own in flight. One at a time, each. */
  pendingProductoIds: ReadonlySet<string>;
  bulkPending: boolean;
  setSearch: (next: string) => void;
  setCategoriaId: (next: string) => void;
  clearFilters: () => void;
  reload: () => void;
  loadMore: () => void;
  publicarProducto: (
    productoId: string,
    publicarEnTienda: boolean,
  ) => Promise<ITiendaOnlineProducto>;
  publicarCategoria: (
    categoriaId: string,
    publicarEnTienda: boolean,
  ) => Promise<ITiendaOnlineBulkResult>;
}

/** `true` when the request never got an answer: no network, a timeout, DNS. */
function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export function useTiendaOnlineProductos(
  enabled: boolean,
): IUseTiendaOnlineProductos {
  const [status, setStatus] = useState<ITiendaOnlineProductosStatus>("loading");
  const [productos, setProductos] = useState<ITiendaOnlineProducto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [puedePublicar, setPuedePublicar] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [online, setOnline] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoriaId, setCategoriaId] = useState("");

  const [pendingProductoIds, setPendingProductoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkPending, setBulkPending] = useState(false);

  // Read once per render of the query, so a stale closure cannot fetch with an
  // old filter after a reload.
  const queryRef = useRef({ categoriaId: "", search: "" });
  queryRef.current = { categoriaId, search: debouncedSearch };

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

  // One request after the typing stops, never one per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      TIENDA_ONLINE_UI.productSearchDebounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    setStatus("loading");
    fetchTiendaOnlineProductos({
      ...(categoriaId ? { categoriaId } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
      .then((page) => {
        if (!active) return;
        setProductos(page.productos);
        setNextCursor(page.nextCursor);
        setTotal(page.total);
        setPuedePublicar(page.puedePublicar);
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
      });

    return () => {
      active = false;
    };
  }, [enabled, categoriaId, debouncedSearch, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setCategoriaId("");
  }, []);

  const loadMore = useCallback(() => {
    if (nextCursor === null || loadingMore) return;
    const cursor = nextCursor;
    const query = queryRef.current;

    setLoadingMore(true);
    fetchTiendaOnlineProductos({
      cursor,
      ...(query.categoriaId ? { categoriaId: query.categoriaId } : {}),
      ...(query.search ? { search: query.search } : {}),
    })
      .then((page) => {
        // The pages already loaded stay where they are: paginating never
        // replaces the list with a skeleton.
        setProductos((current) => [...current, ...page.productos]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        // A failed page leaves the list untouched; the button stays available.
      })
      .finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore]);

  const publicarProducto = useCallback(
    async (productoId: string, publicarEnTienda: boolean) => {
      setPendingProductoIds((current) => new Set(current).add(productoId));
      try {
        const result = await updateProductoPublicacion(productoId, {
          publicarEnTienda,
        });
        // The switch's position always comes from the last product the SERVER
        // returned, never from an optimistic guess.
        setProductos((current) =>
          current.map((producto) =>
            producto.id === productoId ? result.producto : producto,
          ),
        );
        return result.producto;
      } finally {
        setPendingProductoIds((current) => {
          const next = new Set(current);
          next.delete(productoId);
          return next;
        });
      }
    },
    [],
  );

  const publicarCategoria = useCallback(
    async (targetCategoriaId: string, publicarEnTienda: boolean) => {
      setBulkPending(true);
      try {
        const result = await updateCategoriaPublicacionMasiva(
          targetCategoriaId,
          { publicarEnTienda },
        );
        // Reload from the first page with the filters in place: the switches and
        // the states on screen have to be the server's, not a supposition.
        reload();
        return result;
      } finally {
        setBulkPending(false);
      }
    },
    [reload],
  );

  return useMemo(
    () => ({
      status,
      productos,
      nextCursor,
      total,
      puedePublicar,
      online,
      loadingMore,
      search,
      categoriaId,
      pendingProductoIds,
      bulkPending,
      setSearch,
      setCategoriaId,
      clearFilters,
      reload,
      loadMore,
      publicarProducto,
      publicarCategoria,
    }),
    [
      status,
      productos,
      nextCursor,
      total,
      puedePublicar,
      online,
      loadingMore,
      search,
      categoriaId,
      pendingProductoIds,
      bulkPending,
      clearFilters,
      reload,
      loadMore,
      publicarProducto,
      publicarCategoria,
    ],
  );
}
