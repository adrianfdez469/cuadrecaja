"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { convertFromBase } from "@/lib/currency";
import { formatCurrency, formatMontoEnMoneda } from "@/utils/formatters";

/**
 * Display-currency handling shared by every report.
 *
 * The split matters: APIs return money already converted to the business base
 * currency using each sale's historical `tasaSnapshot`, because a sale is worth
 * what it was worth when it happened. Re-expressing those base amounts in
 * another currency is purely presentational and uses *current* rates — which is
 * what `format` does here.
 */
export function useDisplayCurrency() {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const [displayCurrency, setDisplayCurrency] = useState<string>(monedaBase);

  useEffect(() => {
    setDisplayCurrency(monedaBase);
  }, [monedaBase]);

  const availableCurrencies = useMemo(
    () => [
      monedaBase,
      ...monedasNegocio
        .filter((m) => m.activo && m.monedaCode !== monedaBase)
        .map((m) => m.monedaCode),
    ],
    [monedasNegocio, monedaBase],
  );

  /**
   * Formats an amount already expressed in the display currency.
   *
   * The "$" of `formatCurrency` implies the base currency, so showing it on a
   * converted amount would read as "$45.00" for a value actually in USD. When
   * the display currency differs, the code is appended instead.
   */
  const formatAmount = useCallback(
    (amount: number) =>
      displayCurrency === monedaBase
        ? formatCurrency(amount ?? 0)
        : formatMontoEnMoneda(amount ?? 0, displayCurrency),
    [displayCurrency, monedaBase],
  );

  /** Base-currency amount → selected currency, formatted. */
  const format = useCallback(
    (amountInBase: number) =>
      formatAmount(
        convertFromBase(
          amountInBase ?? 0,
          displayCurrency,
          tasasVigentes,
          monedaBase,
        ),
      ),
    [formatAmount, displayCurrency, tasasVigentes, monedaBase],
  );

  /** Same conversion without formatting — for chart axes and series values. */
  const convert = useCallback(
    (amountInBase: number) =>
      convertFromBase(
        amountInBase ?? 0,
        displayCurrency,
        tasasVigentes,
        monedaBase,
      ),
    [displayCurrency, tasasVigentes, monedaBase],
  );

  /**
   * Formats an amount that is ALREADY in the display currency.
   *
   * Charts feed their series through `convert`, so their tooltips and axes must
   * use this — passing those values to `format` would convert a second time.
   */
  const formatConverted = formatAmount;

  return {
    displayCurrency,
    setDisplayCurrency,
    availableCurrencies,
    hasMultipleCurrencies: availableCurrencies.length > 1,
    monedaBase,
    format,
    convert,
    formatConverted,
  };
}
