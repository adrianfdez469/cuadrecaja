import { useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useCartStore } from "@/store/cartStore";
import { convertToBase } from "@/lib/currency";

export function useCartTotal(): number {
  const { tasasVigentes, monedaBase } = useAppContext();
  const items = useCartStore((s) => s.items);

  return useMemo(
    () =>
      items.reduce((sum, item) => {
        const moneda = item.monedaPrecioCode ?? monedaBase;
        return (
          sum +
          convertToBase(
            item.price * item.quantity,
            moneda,
            tasasVigentes,
            monedaBase,
          )
        );
      }, 0),
    [items, tasasVigentes, monedaBase],
  );
}
