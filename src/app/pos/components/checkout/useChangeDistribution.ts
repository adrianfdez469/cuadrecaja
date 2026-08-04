"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  autoChangeDistribution,
  changeErrors,
  distributedBase,
  hasChangeErrors,
  type ChangeDistribution,
} from "@/app/pos/utils/changeMath";
import { convertFromBase } from "@/lib/currency";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface UseChangeDistributionArgs {
  lines: PaymentLine[];
  changeAmountBase: number;
  missing: boolean;
  rates: ITasaSnapshot;
  base: string;
  tiendaId: string;
  cierreId: string;
}

export function useChangeDistribution({
  lines,
  changeAmountBase,
  missing,
  rates,
  base,
  tiendaId,
  cierreId,
}: UseChangeDistributionArgs) {
  const [distribution, setDistribution] = useState<ChangeDistribution>({});
  const [locked, setLocked] = useState(false);
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

  // Auto-distribute until the cashier edits the split by hand.
  useEffect(() => {
    if (missing) {
      setDistribution({});
      setLocked(false);
      return;
    }
    if (locked) return;
    setDistribution(
      autoChangeDistribution(lines, changeAmountBase, rates, base),
    );
  }, [missing, locked, lines, changeAmountBase, rates, base]);

  const errors = useMemo(
    () => changeErrors(distribution, lines, drawerBalance),
    [distribution, lines, drawerBalance],
  );

  const distributedBaseAmount = useMemo(
    () => distributedBase(distribution, rates, base),
    [distribution, rates, base],
  );

  const setAmount = useCallback((currency: string, amount: number) => {
    setLocked(true);
    setDistribution((prev) => ({ ...prev, [currency]: amount }));
  }, []);

  const addCurrency = useCallback(
    (currency: string) => {
      setLocked(true);
      const remaining = Math.max(0, changeAmountBase - distributedBaseAmount);
      const suggested =
        remaining > 0
          ? Number(convertFromBase(remaining, currency, rates, base).toFixed(2))
          : 0;
      setDistribution((prev) => ({ ...prev, [currency]: suggested }));
    },
    [changeAmountBase, distributedBaseAmount, rates, base],
  );

  const removeCurrency = useCallback((currency: string) => {
    setLocked(true);
    setDistribution((prev) => {
      const next = { ...prev };
      delete next[currency];
      return next;
    });
  }, []);

  return {
    distribution,
    errors,
    hasErrors: hasChangeErrors(errors),
    distributedBaseAmount,
    setAmount,
    addCurrency,
    removeCurrency,
  };
}
