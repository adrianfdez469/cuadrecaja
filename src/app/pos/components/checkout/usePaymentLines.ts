"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine, PaymentLineKind } from "@/app/pos/utils/paymentMath";

interface UsePaymentLinesArgs {
  finalTotal: number;
  monedaBase: string;
  denominationsFor: (currency: string) => number[];
  defaultTransferDestId: string;
}

let lineCounter = 0;
const nextLineId = () => `line-${++lineCounter}`;

export function usePaymentLines({
  finalTotal,
  monedaBase,
  denominationsFor,
  defaultTransferDestId,
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

  const reset = useCallback(() => {
    setDirty(false);
    setLines([buildInitialLine()]);
  }, [buildInitialLine]);

  return { lines, dirty, addLine, updateLine, removeLine, reset };
}
