"use client";

import { useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { buildMonedaOptions, type MonedaOption } from "@/utils/monedas";

/**
 * The currencies a user may pick, base first, straight from `AppContext`.
 *
 * Screens read it from here instead of receiving `monedasNegocio` as a prop:
 * the base currency has to be prepended (see `buildMonedaOptions`), and every
 * screen that rebuilt that list by hand got it wrong in the same way.
 */
export function useMonedaOptions(): {
  monedaOptions: MonedaOption[];
  monedaBase: string;
  hasMultipleCurrencies: boolean;
} {
  const { monedasNegocio, monedaBase } = useAppContext();

  const monedaOptions = useMemo(
    () => buildMonedaOptions(monedasNegocio, monedaBase),
    [monedasNegocio, monedaBase],
  );

  return {
    monedaOptions,
    monedaBase,
    hasMultipleCurrencies: monedaOptions.length > 1,
  };
}
