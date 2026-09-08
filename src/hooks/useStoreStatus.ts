import { useMemo } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSalesStore } from "@/store/salesStore";

/** The two facts, apart. See `.agents/designs/estado-sin-conexion.md`. */
export interface IStoreStatus {
  /** The server cannot be reached. */
  offline: boolean;
  /** Sales that exist only on this device. `0` when there are none. */
  pendingSales: number;
}

/**
 * «Sin conexión», «3 sin subir», both — or nothing at all.
 *
 * The redesign prints this twice: under the store name in the top bar, and at
 * the head of the basket panel on desktop. It stays empty while everything is
 * fine, which is why it can be trusted when it is not: an indicator that is
 * always lit stops being read. **`undefined` when nothing is wrong is that
 * premise**, and it is why both callers still ask `if (status)` rather than
 * comparing two fields.
 *
 * The two facts come apart rather than joined by « · »: they are different
 * claims — one about the device, one about the data — and a caller cannot give
 * each one its own glyph, its own accessible label and its own behaviour at
 * 320px if all it receives is a sentence to split again.
 */
export function useStoreStatus(): IStoreStatus | undefined {
  const { isOnline } = useNetworkStatus();
  const pendingSales = useSalesStore(
    (state) => state.sales.filter((sale) => !sale.synced).length,
  );

  return useMemo(() => {
    if (isOnline && pendingSales === 0) return undefined;
    return { offline: !isOnline, pendingSales };
  }, [isOnline, pendingSales]);
}
