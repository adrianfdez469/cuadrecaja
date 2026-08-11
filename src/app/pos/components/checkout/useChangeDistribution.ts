"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  changeErrors,
  changeOptions,
  hasChangeErrors,
  type ChangeDistribution,
} from "@/app/pos/utils/changeMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface UseChangeDistributionArgs {
  lines: PaymentLine[];
  changeAmountBase: number;
  missing: boolean;
  rates: ITasaSnapshot;
  base: string;
  /** Every currency the business can hand change in. */
  currencies: string[];
  denominationsFor: (currency: string) => number[];
  tiendaId: string;
  cierreId: string;
}

export function useChangeDistribution({
  lines,
  changeAmountBase,
  missing,
  rates,
  base,
  currencies,
  denominationsFor,
  tiendaId,
  cierreId,
}: UseChangeDistributionArgs) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerBalance, setDrawerBalance] = useState<Record<string, number>>(
    {},
  );

  const refreshBalance = useCallback(() => {
    if (!tiendaId || !cierreId) return;
    fetch(`/api/cierre/${tiendaId}/${cierreId}/cash-balance`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((balance: Record<string, number>) => setDrawerBalance(balance))
      .catch(() => setDrawerBalance({}));
  }, [tiendaId, cierreId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const options = useMemo(
    () =>
      missing
        ? []
        : changeOptions(
            lines,
            changeAmountBase,
            rates,
            base,
            currencies,
            denominationsFor,
          ),
    [
      missing,
      lines,
      changeAmountBase,
      rates,
      base,
      currencies,
      denominationsFor,
    ],
  );

  const optionErrors = useMemo(
    () =>
      options.map((option) =>
        changeErrors(option.distribution, lines, drawerBalance),
      ),
    [options, lines, drawerBalance],
  );

  /**
   * Splits the drawer cannot actually cover. Surfaced so the sheet can mark
   * them instead of letting the cashier pick one and only then discover that
   * VENDER is disabled.
   */
  const unavailableIds = useMemo(
    () =>
      new Set(
        options
          .filter((_, index) => hasChangeErrors(optionErrors[index]))
          .map((option) => option.id),
      ),
    [options, optionErrors],
  );

  /**
   * The default is the best split the drawer can actually cover — normally
   * the first, the largest deliverable amount in the currency the customer
   * paid with. Falling back to the first one regardless would block the sale
   * on a shortfall the cashier never chose and, since every split is
   * pre-computed, could leave no reachable way out.
   */
  const defaultOption = useMemo(
    () =>
      options.find((_, index) => !hasChangeErrors(optionErrors[index])) ??
      options[0],
    [options, optionErrors],
  );

  // A selection only survives while the split it names still exists — option
  // ids are derived from the amounts, so any change to what is owed drops the
  // cashier back to the default rather than keeping a stale split.
  const selected = useMemo(
    () => options.find((option) => option.id === selectedId) ?? defaultOption,
    [options, selectedId, defaultOption],
  );

  const distribution: ChangeDistribution = useMemo(
    () => selected?.distribution ?? {},
    [selected],
  );

  const errors = useMemo(
    () => changeErrors(distribution, lines, drawerBalance),
    [distribution, lines, drawerBalance],
  );

  return {
    options,
    unavailableIds,
    selectedId: selected?.id ?? null,
    select: setSelectedId,
    distribution,
    errors,
    hasErrors: hasChangeErrors(errors),
  };
}
