"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLIENTES_CACHE_SIZE,
  CLIENTES_COPY,
  CLIENTES_EXTRA_COPY,
  CLIENTES_LIST_LIMIT,
  CLIENTES_PERMISO_CONFIGURACION,
  CLIENTES_SEARCH_DEBOUNCE_MS,
} from "@/constants/clientes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePermisos } from "@/utils/permisos_front";
import { useMessageContext } from "@/context/MessageContext";
import { toClienteOption } from "@/lib/clientes/clienteCache";
import {
  filterClientesCache,
  resolveCreateAvailability,
  type IClienteCreateBlockReason,
  type IClienteSearchSource,
} from "@/lib/clientes/clienteSearch";
import {
  refreshClientesCache,
  useClientesStore,
} from "@/store/clientesStore";
import {
  createCliente as createClienteRequest,
  getClientes,
} from "@/services/clienteService";
import type { ICreateCliente } from "@/schemas/cliente";
import type {
  IClienteOption,
  IClienteUpsertResponse,
} from "@/schemas/clienteSaldo";

export interface IUseClienteSearchResult {
  term: string;
  setTerm: (next: string) => void;
  results: IClienteOption[];
  loading: boolean;
  error: string | null;
  /** Which side answered the current `results`. */
  source: IClienteSearchSource;
  isOnline: boolean;
  canCreate: boolean;
  blockReason: IClienteCreateBlockReason | null;
  /**
   * Resolves with what the POST answered — the row AND whether it was created or
   * reactivated — or `null` when the request was rejected.
   */
  createCliente: (input: ICreateCliente) => Promise<IClienteUpsertResponse | null>;
  refresh: () => Promise<number>;
}

/** The message an Axios rejection carries in its body, when it carries one. */
function serverErrorMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response
    ?.data;
  return typeof data?.error === "string" && data.error !== ""
    ? data.error
    : null;
}

/**
 * THE ONLY logic of the selector. `ClienteSheet` and `ClienteAutocomplete` repeat none of it
 * (`AGENTS.md`, no duplication).
 *
 * Not covered by the suite — the project has no `@testing-library/react` — which is why
 * everything decidable lives in `src/lib/clientes/**`, which is.
 */
export function useClienteSearch(): IUseClienteSearchResult {
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, CLIENTES_SEARCH_DEBOUNCE_MS);

  const { isOnline } = useNetworkStatus();
  const { verificarPermiso } = usePermisos();
  const { showMessage } = useMessageContext();

  const hasPermission = verificarPermiso(CLIENTES_PERMISO_CONFIGURACION);

  const options = useClientesStore((state) => state.options);
  const ownerChecked = useClientesStore((state) => state.ownerChecked);
  const remember = useClientesStore((state) => state.remember);

  const [serverResults, setServerResults] = useState<IClienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getClientes({
      nombre: debouncedTerm || undefined,
      limit: CLIENTES_LIST_LIMIT,
    })
      .then((rows) => {
        if (cancelled) return;
        setServerResults(rows.map(toClienteOption));
        remember(rows);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        // Fixed copy, never the exception message: it quotes the data that broke it (E-031).
        setError(CLIENTES_COPY.selectorError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, isOnline, remember]);

  const source: IClienteSearchSource = isOnline ? "server" : "cache";

  const results = useMemo(() => {
    if (isOnline) return serverResults;
    // The cache is not read before knowing whose it is (§ 8.1, amendment S2).
    if (!ownerChecked) return [];
    return filterClientesCache(options, term, CLIENTES_CACHE_SIZE);
  }, [isOnline, serverResults, ownerChecked, options, term]);

  const { canCreate, blockReason } = resolveCreateAvailability({
    isOnline,
    hasPermission,
  });

  const createCliente = useCallback(
    async (input: ICreateCliente): Promise<IClienteUpsertResponse | null> => {
      try {
        const response = await createClienteRequest(input);
        remember([response.cliente]);
        return response;
      } catch (requestError) {
        showMessage(
          serverErrorMessage(requestError) ?? CLIENTES_EXTRA_COPY.errorCrear,
          "error",
        );
        return null;
      }
    },
    [remember, showMessage],
  );

  const refresh = useCallback(() => refreshClientesCache(), []);

  return {
    term,
    setTerm,
    results,
    loading,
    error,
    source,
    isOnline,
    canCreate,
    blockReason,
    createCliente,
    refresh,
  };
}
