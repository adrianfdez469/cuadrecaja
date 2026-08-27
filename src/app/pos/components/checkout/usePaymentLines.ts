"use client";

import { useCallback, useState } from "react";
import type { PaymentLine, PaymentLineKind } from "@/app/pos/utils/paymentMath";

interface UsePaymentLinesArgs {
  defaultTransferDestId: string;
}

let lineCounter = 0;
const nextLineId = () => `line-${++lineCounter}`;

/**
 * The payments the customer hands over, as the charge screen edits them.
 *
 * It starts empty on purpose. The screen opens on «elegir forma de pago» with
 * nothing preselected — the redesign's first state — and the first line only
 * exists once the cashier has picked a tile. The base cash line that used to
 * be preloaded here, and the bookkeeping that kept it in step with the total
 * while «untouched», went with the card layout it was drawn for.
 */
export function usePaymentLines({
  defaultTransferDestId,
}: UsePaymentLinesArgs) {
  const [lines, setLines] = useState<PaymentLine[]>([]);

  /** Appends a line and returns its id, so the caller can open it. */
  const addLine = useCallback(
    (kind: PaymentLineKind, currency: string, amount: number): string => {
      const id = nextLineId();
      setLines((prev) => [
        ...prev,
        {
          id,
          kind,
          currency,
          amount,
          ...(kind === "transfer"
            ? { transferDestinationId: defaultTransferDestId }
            : {}),
        },
      ]);
      return id;
    },
    [defaultTransferDestId],
  );

  /** Replaces every line at once — picking a single form of payment, or
   * starting a mixed one from nothing. Returns the ids in order. */
  const replaceLines = useCallback(
    (next: Array<Omit<PaymentLine, "id">>): string[] => {
      const withIds = next.map((line) => ({
        ...line,
        id: nextLineId(),
        ...(line.kind === "transfer" && !line.transferDestinationId
          ? { transferDestinationId: defaultTransferDestId }
          : {}),
      }));
      setLines(withIds);
      return withIds.map((line) => line.id);
    },
    [defaultTransferDestId],
  );

  const updateLine = useCallback((id: string, patch: Partial<PaymentLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }, []);

  return { lines, addLine, replaceLines, updateLine, removeLine };
}
