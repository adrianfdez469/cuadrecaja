import { convertToBase, convertFromBase } from "@/lib/currency";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import type { IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/** Change to give, per currency code. */
export type ChangeDistribution = Record<string, number>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Tolerance for float noise when comparing against the drawer balance. */
const BALANCE_EPSILON = 0.001;

/**
 * Change goes to the cash currency with the largest base equivalent, for
 * the exact difference — cash received is rounded up, so the change is
 * that surplus and the net in the drawer matches the real total.
 */
export function autoChangeDistribution(
  lines: PaymentLine[],
  changeAmountBase: number,
  rates: ITasaSnapshot,
  base: string,
): ChangeDistribution {
  if (changeAmountBase <= 0) return {};

  const mainCurrency = lines
    .filter((line) => line.kind === "cash" && line.amount > 0)
    .map((line) => ({
      currency: line.currency,
      base: convertToBase(line.amount, line.currency, rates, base),
    }))
    .sort((a, b) => b.base - a.base)[0]?.currency;

  if (!mainCurrency) return {};

  const amount = round2(
    convertFromBase(changeAmountBase, mainCurrency, rates, base),
  );
  return amount > 0 ? { [mainCurrency]: amount } : {};
}

/**
 * Cash available to give change: what the period accumulated plus the cash
 * taken in this very sale.
 */
export function changeAvailability(
  lines: PaymentLine[],
  drawerBalance: Record<string, number>,
): Record<string, number> {
  const available: Record<string, number> = { ...drawerBalance };
  for (const line of lines) {
    if (line.kind !== "cash") continue;
    available[line.currency] = round2(
      (available[line.currency] ?? 0) + line.amount,
    );
  }
  return available;
}

export function changeErrors(
  distribution: ChangeDistribution,
  lines: PaymentLine[],
  drawerBalance: Record<string, number>,
): Record<string, string | null> {
  const available = changeAvailability(lines, drawerBalance);
  return Object.fromEntries(
    Object.entries(distribution).map(([currency, amount]) => {
      const cap = available[currency] ?? 0;
      return [
        currency,
        amount > cap + BALANCE_EPSILON
          ? `En caja hay ${cap.toFixed(2)} ${currency}`
          : null,
      ];
    }),
  );
}

export function hasChangeErrors(
  errors: Record<string, string | null>,
): boolean {
  return Object.values(errors).some((error) => error !== null);
}

export function distributedBase(
  distribution: ChangeDistribution,
  rates: ITasaSnapshot,
  base: string,
): number {
  return round2(
    Object.entries(distribution).reduce(
      (sum, [currency, amount]) =>
        sum + convertToBase(amount, currency, rates, base),
      0,
    ),
  );
}

export function toVueltoLineas(
  distribution: ChangeDistribution,
): IVueltoLinea[] {
  return Object.entries(distribution)
    .filter(([, amount]) => amount > 0)
    .map(([moneda, monto]) => ({ moneda, monto }));
}
