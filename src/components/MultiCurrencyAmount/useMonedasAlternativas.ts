import { useMemo, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { convertFromBase } from "@/lib/currency";
import type { INegocioMoneda } from "@/schemas/moneda";

function tieneTasaVigente(monedaCode: string, tasas: Record<string, number>): boolean {
  if (monedaCode === "CUP") return true;
  const tasa = tasas[monedaCode];
  return tasa != null && tasa > 0;
}

export function useMonedasAlternativas() {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();

  const monedasAlternativas = useMemo<INegocioMoneda[]>(
    () =>
      monedasNegocio.filter(
        (m) =>
          m.activo &&
          m.monedaCode !== monedaBase &&
          tieneTasaVigente(m.monedaCode, tasasVigentes),
      ),
    [monedasNegocio, monedaBase, tasasVigentes],
  );

  const hasAlternativas = monedasAlternativas.length > 0;

  const convertToMoneda = useCallback(
    (amountBase: number, monedaCode: string) =>
      convertFromBase(amountBase, monedaCode, tasasVigentes, monedaBase),
    [tasasVigentes, monedaBase],
  );

  return { monedasAlternativas, hasAlternativas, monedaBase, convertToMoneda };
}
