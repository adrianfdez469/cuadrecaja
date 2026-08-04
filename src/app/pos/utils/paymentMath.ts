import { convertToBase, convertFromBase } from "@/lib/currency";
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Compares money in cents so float noise never decides a sale. */
function cents(value: number): number {
  return Math.round(value * 100);
}

export function paidBase(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): number {
  return round2(
    lines.reduce(
      (sum, line) =>
        sum + convertToBase(line.amount, line.currency, rates, base),
      0,
    ),
  );
}

/**
 * How much is still owed, expressed in `currency`. `excludeId` leaves the
 * line being edited out of the sum so it does not cancel its own suggestion.
 */
export function pendingInCurrency(
  lines: PaymentLine[],
  finalTotal: number,
  currency: string,
  rates: ITasaSnapshot,
  base: string,
  excludeId?: string,
): number {
  const covered = paidBase(
    lines.filter((line) => line.id !== excludeId),
    rates,
    base,
  );
  const remaining = Math.max(0, finalTotal - covered);
  if (remaining === 0) return 0;
  return round2(convertFromBase(remaining, currency, rates, base));
}

export function isMissing(paid: number, finalTotal: number): boolean {
  return cents(paid) < cents(finalTotal);
}

export function changeBase(paid: number, finalTotal: number): number {
  return Math.max(0, round2(paid - finalTotal));
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
