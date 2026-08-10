"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine, PaymentLineKind } from "@/app/pos/utils/paymentMath";

interface UsePaymentLinesArgs {
  finalTotal: number;
  monedaBase: string;
  denominationsFor: (currency: string) => number[];
  defaultTransferDestId: string;
  /** Converts an amount between two currencies at the current rates. */
  convertAmount: (amount: number, from: string, to: string) => number;
}

let lineCounter = 0;
const nextLineId = () => `line-${++lineCounter}`;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function usePaymentLines({
  finalTotal,
  monedaBase,
  denominationsFor,
  defaultTransferDestId,
  convertAmount,
}: UsePaymentLinesArgs) {
  const buildInitialLine = useCallback(
    (): PaymentLine => ({
      id: nextLineId(),
      kind: "cash",
      currency: monedaBase,
      amount: suggestedAmounts(finalTotal, denominationsFor(monedaBase)).exact,
    }),
    [finalTotal, monedaBase, denominationsFor],
  );

  const [lines, setLines] = useState<PaymentLine[]>(() => [buildInitialLine()]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // While untouched, the single base line tracks the total (e.g. a discount
  // lands). Once the cashier has touched anything, amounts are theirs.
  useEffect(() => {
    if (dirtyRef.current) return;
    if (finalTotal <= 0) return;
    const exact = suggestedAmounts(
      finalTotal,
      denominationsFor(monedaBase),
    ).exact;
    setLines((prev) =>
      prev.length === 1 &&
      prev[0].kind === "cash" &&
      prev[0].currency === monedaBase
        ? [{ ...prev[0], amount: exact }]
        : prev,
    );
  }, [finalTotal, monedaBase, denominationsFor]);

  const addLine = useCallback(
    (kind: PaymentLineKind, currency: string, amount: number) => {
      setDirty(true);
      setLines((prev) => [
        ...prev,
        {
          id: nextLineId(),
          kind,
          currency,
          amount,
          ...(kind === "transfer"
            ? { transferDestinationId: defaultTransferDestId }
            : {}),
        },
      ]);
    },
    [defaultTransferDestId],
  );

  const updateLine = useCallback((id: string, patch: Partial<PaymentLine>) => {
    setDirty(true);
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setDirty(true);
    setLines((prev) => prev.filter((line) => line.id !== id));
  }, []);

  /** Drops every line for `currency` — a cash-anchored card and its paired
   * transfer line come and go together. */
  const removeCurrencyGroup = useCallback((currency: string) => {
    setDirty(true);
    setLines((prev) => prev.filter((line) => line.currency !== currency));
  }, []);

  /**
   * Re-denominates a whole card: every line for `from` (its cash line and,
   * if present, its embedded transfer line) moves to `to`, carrying the same
   * money over at the current rate. This is what lets a cashier correct the
   * currency of the payment already on screen instead of removing the card
   * and adding another one. Cash lands on a payable amount (rounded up to
   * the target currency's smallest bill); a transfer keeps the exact
   * equivalent, since no bill has to exist for it.
   */
  const changeCurrency = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      setDirty(true);
      setLines((prev) => {
        // Merging into a currency that already has its own card would leave
        // two cash lines for it; the caller only offers free currencies, this
        // is the guard that makes that a precondition rather than a hope.
        if (prev.some((line) => line.currency === to)) return prev;
        return prev.map((line) => {
          if (line.currency !== from) return line;
          const converted = convertAmount(line.amount, from, to);
          return {
            ...line,
            currency: to,
            amount:
              line.kind === "cash"
                ? suggestedAmounts(converted, denominationsFor(to)).exact
                : round2(converted),
          };
        });
      });
    },
    [convertAmount, denominationsFor],
  );

  /**
   * Turns the embedded transfer field on a currency's cash card on or off.
   * Off → on: reveals an empty transfer line, nothing moves yet. On → off:
   * drops the transfer line and folds whatever it held back into that
   * currency's cash line, so the total paid never silently changes.
   */
  const toggleTransfer = useCallback(
    (currency: string) => {
      setDirty(true);
      setLines((prev) => {
        const transferLine = prev.find(
          (line) => line.kind === "transfer" && line.currency === currency,
        );
        if (transferLine) {
          return prev
            .filter((line) => line.id !== transferLine.id)
            .map((line) =>
              line.kind === "cash" && line.currency === currency
                ? { ...line, amount: round2(line.amount + transferLine.amount) }
                : line,
            );
        }
        return [
          ...prev,
          {
            id: nextLineId(),
            kind: "transfer",
            currency,
            amount: 0,
            transferDestinationId: defaultTransferDestId,
          },
        ];
      });
    },
    [defaultTransferDestId],
  );

  /**
   * Sets the transfer amount for `currency`'s embedded transfer field and
   * reduces that currency's cash line by the same delta, clamped at zero —
   * the same contract the old per-currency panel guaranteed by construction,
   * so typing a transfer amount can never inflate the total paid.
   */
  const setTransferAmount = useCallback(
    (currency: string, newAmount: number) => {
      setDirty(true);
      setLines((prev) => {
        const transferLine = prev.find(
          (line) => line.kind === "transfer" && line.currency === currency,
        );
        const prevAmount = transferLine?.amount ?? 0;
        return prev.map((line) => {
          if (line.kind === "transfer" && line.currency === currency) {
            return { ...line, amount: newAmount };
          }
          if (line.kind === "cash" && line.currency === currency) {
            return {
              ...line,
              amount: Math.max(0, round2(line.amount + prevAmount - newAmount)),
            };
          }
          return line;
        });
      });
    },
    [],
  );

  const setTransferDestination = useCallback(
    (currency: string, transferDestinationId: string) => {
      setDirty(true);
      setLines((prev) =>
        prev.map((line) =>
          line.kind === "transfer" && line.currency === currency
            ? { ...line, transferDestinationId }
            : line,
        ),
      );
    },
    [],
  );

  return {
    lines,
    dirty,
    addLine,
    updateLine,
    removeLine,
    removeCurrencyGroup,
    changeCurrency,
    toggleTransfer,
    setTransferAmount,
    setTransferDestination,
  };
}
