"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import type { ReportQuery } from "@/services/reportsService";

type Fetcher<TData> = (
  tiendaId: string,
  params?: ReportQuery,
) => Promise<TData>;

/**
 * Loads a report for the active store, refetching when the store or the filters
 * change. `ready` gates the request while a custom range is still incomplete.
 */
export function useReportData<TData>(
  fetcher: Fetcher<TData>,
  buildQuery: () => ReportQuery,
  ready: boolean,
) {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tiendaId = user?.localActual?.id;
  // Serialized so the effect compares filter *values*, not object identity.
  const querySignature = JSON.stringify(buildQuery());

  const load = useCallback(async () => {
    if (!tiendaId) return;
    try {
      setLoading(true);
      setError(null);
      setData(await fetcher(tiendaId, JSON.parse(querySignature)));
    } catch (err) {
      console.error("Error al cargar el reporte:", err);
      setError("No se pudo cargar el reporte");
      showMessage("Error al cargar el reporte", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaId, querySignature]);

  useEffect(() => {
    if (loadingContext || !tiendaId || !ready) return;
    load();
  }, [loadingContext, tiendaId, ready, load]);

  return { data, loading, error, refetch: load, tiendaId };
}
