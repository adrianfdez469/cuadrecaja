/**
 * Tip arithmetic for the POS checkout.
 *
 * A tip is not a separate flow of money: it is the part of `pagosDetalle`
 * that does not belong to the business. The invariant the whole feature
 * rests on is
 *
 *   Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) = total + tipTotal
 *
 * which is why the cash drawer needs no knowledge of tips — the bill is
 * already counted there. These helpers only decide *which* currency and
 * payment method each unit of tip is attributed to, so it can be reported
 * and handed out later.
 */

import { convertToBase } from "@/lib/currency";
import type { PaymentLine } from "./paymentMath";
import type { ChangeDistribution } from "./changeMath";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The change the cashier was about to hand back, kept as a tip instead.
 *
 * The split has already been chosen and validated against the drawer, so it
 * maps across one-to-one — and it is exactly right by construction: the
 * currency retained is the currency that was going to leave the drawer.
 * Change is always handed over in cash, never as a transfer.
 */
export function tipLinesFromChange(
  distribution: ChangeDistribution,
  rates: ITasaSnapshot,
  base: string,
): IPagoLinea[] {
  return Object.entries(distribution)
    .filter(([, monto]) => monto > 0)
    .map(([moneda, monto]) => ({
      tipo: "cash" as const,
      moneda,
      monto: round2(monto),
      equivalenteBase: round2(convertToBase(monto, moneda, rates, base)),
    }));
}

/** Tip typed by the cashier: an amount per currency, in that currency. */
export type TipAmounts = Record<string, number>;

/**
 * The tip exactly as the cashier entered it, one line per currency.
 *
 * A tip is not necessarily in the currency the sale was paid with — a
 * customer settling in USD may well leave the tip in CUP, or split it — so
 * the currency is stated, never inferred from the payment.
 *
 * What *is* inferred is the method, because the cashier has no reason to
 * care: a tip in a currency that was paid in cash is cash, one in a
 * transfer-only currency rides the transfer (and inherits its destination),
 * and a currency that was not used to pay at all is money handed over at the
 * counter, so cash.
 */
export function tipLinesFromAmounts(
  amounts: TipAmounts,
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): IPagoLinea[] {
  return Object.entries(amounts)
    .filter(([, monto]) => monto > 0)
    .map(([moneda, monto]) => {
      const paidInCash = lines.some(
        (line) =>
          line.kind === "cash" && line.currency === moneda && line.amount > 0,
      );
      const transferLine = lines.find(
        (line) =>
          line.kind === "transfer" &&
          line.currency === moneda &&
          line.amount > 0,
      );
      const asTransfer = !paidInCash && Boolean(transferLine);

      return {
        tipo: asTransfer ? ("transfer" as const) : ("cash" as const),
        moneda,
        monto: round2(monto),
        equivalenteBase: round2(convertToBase(monto, moneda, rates, base)),
        ...(asTransfer && transferLine?.transferDestinationId
          ? { transferDestinationId: transferLine.transferDestinationId }
          : {}),
      };
    });
}

/** What the typed amounts add up to in base currency. */
export function tipTotalFromAmounts(
  amounts: TipAmounts,
  rates: ITasaSnapshot,
  base: string,
): number {
  return round2(
    Object.entries(amounts).reduce(
      (sum, [moneda, monto]) =>
        monto > 0 ? sum + convertToBase(monto, moneda, rates, base) : sum,
      0,
    ),
  );
}

/** Total of a tip breakdown in base currency. */
export function tipTotalBase(tipDetail: IPagoLinea[]): number {
  return round2(tipDetail.reduce((sum, line) => sum + line.equivalenteBase, 0));
}
