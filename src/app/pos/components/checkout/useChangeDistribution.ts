"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  changeErrors,
  changeOptions,
  customChangeSplit,
  hasChangeErrors,
  CUSTOM_CHANGE_ID,
  type ChangeDistribution,
} from "@/app/pos/utils/changeMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { useCashBalance, useCashBalanceStore } from "@/store/cashBalanceStore";

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
  const [customAmounts, setCustomAmounts] = useState<ChangeDistribution>({});

  // Served from a TTL cache shared across mounts. The checkout is remounted
  // after every sale and on every switch of cart, and each mount used to fire
  // this aggregation — five parallel queries over the whole open period —
  // right as the cashier was about to charge.
  const drawerBalance = useCashBalance(tiendaId, cierreId);
  useEffect(() => {
    void useCashBalanceStore.getState().ensure(tiendaId, cierreId);
  }, [tiendaId, cierreId]);

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

  /**
   * The cashier's own split, kept alive next to the pre-computed ones: it is
   * the way out for the handful of cases the generated list cannot express, not
   * a replacement for it.
   */
  const custom = useMemo(
    () =>
      customChangeSplit(
        customAmounts,
        changeAmountBase,
        rates,
        base,
        currencies,
        denominationsFor,
      ),
    [
      customAmounts,
      changeAmountBase,
      rates,
      base,
      currencies,
      denominationsFor,
    ],
  );

  /** Currencies the cashier types into — every one but the auto-filled remainder. */
  const customCurrencies = useMemo(
    () =>
      currencies.filter((currency) => currency !== custom.remainderCurrency),
    [currencies, custom.remainderCurrency],
  );

  // A typed split is a statement about one amount owed. Editing the payment
  // makes it a claim about a number that no longer exists, so it is dropped
  // rather than left to silently overshoot — the same thing that happens to a
  // selected option, whose id is derived from the amounts and stops existing.
  // Guarded with the functional form so a reset that changes nothing keeps the
  // same state identity: the effect fires on every keypad digit that moves the
  // change, and two unconditional setState calls meant an extra render each.
  useEffect(() => {
    setCustomAmounts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setSelectedId((prev) => (prev === null ? prev : null));
  }, [changeAmountBase]);

  const setCustomAmount = useCallback((currency: string, amount: number) => {
    setCustomAmounts((prev) => ({ ...prev, [currency]: amount }));
    // Typing is the selection: reaching for a field and then having to also
    // tick its radio is a step that can only be forgotten.
    setSelectedId(CUSTOM_CHANGE_ID);
  }, []);

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

  const isCustom =
    selectedId === CUSTOM_CHANGE_ID && customCurrencies.length > 0;

  // A selection only survives while the split it names still exists — option
  // ids are derived from the amounts, so any change to what is owed drops the
  // cashier back to the default rather than keeping a stale split.
  const selected = useMemo(
    () => options.find((option) => option.id === selectedId) ?? defaultOption,
    [options, selectedId, defaultOption],
  );

  const distribution: ChangeDistribution = useMemo(
    () => (isCustom ? custom.distribution : (selected?.distribution ?? {})),
    [isCustom, custom.distribution, selected],
  );

  const errors = useMemo(
    () => changeErrors(distribution, lines, drawerBalance),
    [distribution, lines, drawerBalance],
  );

  // Overshoot only exists for the typed split, and it blocks the sale for the
  // same reason a drawer shortfall does: the money cannot actually be handed
  // over as stated.
  const overshootBase = isCustom ? custom.overshootBase : 0;

  return {
    options,
    unavailableIds,
    selectedId: isCustom ? CUSTOM_CHANGE_ID : (selected?.id ?? null),
    select: setSelectedId,
    distribution,
    errors,
    overshootBase,
    hasErrors: hasChangeErrors(errors) || overshootBase > 0,
    custom: {
      amounts: customAmounts,
      currencies: customCurrencies,
      remainderCurrency: custom.remainderCurrency,
      remainderAmount: custom.distribution[custom.remainderCurrency] ?? 0,
      setAmount: setCustomAmount,
    },
  };
}
