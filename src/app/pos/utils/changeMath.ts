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

  // Aggregate per currency before comparing: nothing stops two cash lines
  // from sharing a currency, and picking the largest single line would
  // then choose the wrong one.
  const baseByCurrency = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "cash" || line.amount <= 0) continue;
    const lineBase = convertToBase(line.amount, line.currency, rates, base);
    baseByCurrency.set(
      line.currency,
      (baseByCurrency.get(line.currency) ?? 0) + lineBase,
    );
  }

  const mainCurrency = Array.from(baseByCurrency.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

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
