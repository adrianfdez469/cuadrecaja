import { useMemo } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSalesStore } from "@/store/salesStore";

/**
 * «Sin conexión · 3 sin subir» — or nothing at all.
 *
 * The redesign prints this line twice: under the store name in the top bar,
 * and at the head of the basket panel on desktop. It stays empty while
 * everything is fine, which is why it can be trusted when it is not: an
 * indicator that is always lit stops being read.
 */
export function useStoreStatus(): string | undefined {
  const { isOnline } = useNetworkStatus();
  const pendingSales = useSalesStore(
    (state) => state.sales.filter((sale) => !sale.synced).length,
  );

  return useMemo(() => {
    const parts: string[] = [];
    if (!isOnline) parts.push("Sin conexión");
    if (pendingSales > 0) parts.push(`${pendingSales} sin subir`);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [isOnline, pendingSales]);
}
