import {
  convertToBase,
  convertFromBase,
  roundBaseToAnchorCents,
  anchorCents,
} from "@/lib/currency";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export type PaymentLineKind = "cash" | "transfer";

/**
 * A single payment the customer hands over. Replaces the previous
 * per-currency record, which could not represent two transfers going to
 * different destinations in the same currency.
 */
export interface PaymentLine {
  id: string;
  kind: PaymentLineKind;
  currency: string;
  amount: number;
  transferDestinationId?: string;
}

export function paidBase(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): number {
  // Anchor-cent grid, not base cents: quantizing a coarse base (USD) to its
  // own cents shifts the sum by several CUP (see roundBaseToAnchorCents).
  return roundBaseToAnchorCents(
    lines.reduce(
      (sum, line) =>
        sum + convertToBase(line.amount, line.currency, rates, base),
      0,
    ),
    rates,
    base,
  );
}

/**
 * How much is still owed, expressed in `currency`. `excludeId` leaves the
 * line being edited out of the sum so it does not cancel its own suggestion;
 * pass several ids to leave out a whole card (a cash line and the transfer
 * embedded in it).
 */
export function pendingInCurrency(
  lines: PaymentLine[],
  finalTotal: number,
  currency: string,
  rates: ITasaSnapshot,
  base: string,
  excludeId?: string | string[],
): number {
  const excluded = new Set(
    excludeId === undefined
      ? []
      : Array.isArray(excludeId)
        ? excludeId
        : [excludeId],
  );
  const covered = paidBase(
    lines.filter((line) => !excluded.has(line.id)),
    rates,
    base,
  );
  const remaining = Math.max(0, finalTotal - covered);
  if (remaining === 0) return 0;
  const raw = convertFromBase(remaining, currency, rates, base);
  // Ceiled to the target currency's cent, never nearest-rounded: paying the
  // stated amount must always clear the debt. Rounding 0.7463 USD down to
  // 0.74 would leave the sale short by real CUP after the customer paid
  // exactly what was asked. The epsilon keeps float noise (500.0000000006)
  // from ceiling an exact amount up a cent.
  return Math.ceil(raw * 100 - 1e-6) / 100;
}

/** Compares money in anchor (CUP) cents so float noise never decides a sale. */
export function isMissing(
  paid: number,
  finalTotal: number,
  rates: ITasaSnapshot,
  base: string,
): boolean {
  return anchorCents(paid, rates, base) < anchorCents(finalTotal, rates, base);
}

export function changeBase(
  paid: number,
  finalTotal: number,
  rates: ITasaSnapshot,
  base: string,
): number {
  return Math.max(0, roundBaseToAnchorCents(paid - finalTotal, rates, base));
}

export function hasMissingTransferDestination(lines: PaymentLine[]): boolean {
  return lines.some(
    (line) =>
      line.kind === "transfer" &&
      line.amount > 0 &&
      !line.transferDestinationId,
  );
}

/**
 * Maps to the wire format the sales API already expects. Lines with no
 * amount are dropped: `pagoLineaSchema` requires a positive `monto`.
 */
export function toPagoLineas(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): IPagoLinea[] {
  return lines
    .filter((line) => line.amount > 0)
    .map((line) => ({
      tipo: line.kind,
      moneda: line.currency,
      monto: line.amount,
      equivalenteBase: convertToBase(line.amount, line.currency, rates, base),
      ...(line.kind === "transfer" && line.transferDestinationId
        ? { transferDestinationId: line.transferDestinationId }
        : {}),
    }));
}
