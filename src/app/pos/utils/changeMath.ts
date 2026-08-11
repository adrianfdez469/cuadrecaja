import { convertToBase, convertFromBase } from "@/lib/currency";
import { ceilToStep } from "@/app/pos/utils/suggestedAmounts";
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

/** Tolerance for float noise before rounding to a denomination. */
const EPS = 1e-6;

/**
 * Fallback bill size for a currency with no denominations configured. Change
 * still has to land on *some* grid, and a whole unit is the safest guess —
 * assuming cents would reintroduce the undeliverable amounts this module
 * exists to prevent.
 */
const FALLBACK_DENOMINATION = 1;

/** How many reduced-amount options to offer besides the maximum and "all in base". */
const MAX_STEP_DOWN_OPTIONS = 3;

/** Rounds down to the nearest multiple of `step`, immune to float noise. */
function floorToStep(value: number, step: number): number {
  if (step <= 0) return round2(value);
  return round2(Math.floor((value + EPS) / step) * step);
}

function smallestDenomination(denominations: number[]): number {
  const positive = denominations.filter((d) => d > 0);
  return positive.length > 0 ? Math.min(...positive) : FALLBACK_DENOMINATION;
}

/**
 * The cash currency the customer mostly paid with — change is denominated
 * there first. Aggregates per currency before comparing: nothing stops two
 * cash lines from sharing a currency, and picking the largest single line
 * would then choose the wrong one.
 */
export function mainCashCurrency(
  lines: PaymentLine[],
  rates: ITasaSnapshot,
  base: string,
): string | null {
  const baseByCurrency = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "cash" || line.amount <= 0) continue;
    const lineBase = convertToBase(line.amount, line.currency, rates, base);
    baseByCurrency.set(
      line.currency,
      (baseByCurrency.get(line.currency) ?? 0) + lineBase,
    );
  }
  return (
    Array.from(baseByCurrency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null
  );
}

/** One way to hand the change over, as a ready-made split. */
export interface ChangeOption {
  /**
   * Derived from the split itself, so it stays stable while the split does
   * and changes the moment the amount owed does — a selection made against
   * an older total can never silently survive into a new one.
   */
  id: string;
  distribution: ChangeDistribution;
}

function optionId(distribution: ChangeDistribution): string {
  return Object.entries(distribution)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => `${currency}:${amount}`)
    .join("|");
}

/**
 * Splits `changeAmountBase` given `amountInMain` units of the main currency,
 * with the remainder in `remainderCurrency`. The main part is floored to its
 * own bill size and the remainder is ceiled to the finer one: the coarse
 * currency never overshoots what is owed, and the fine one absorbs the
 * difference rather than leaving an undeliverable fraction behind.
 */
function splitWith(
  amountInMain: number,
  mainCurrency: string,
  changeAmountBase: number,
  rates: ITasaSnapshot,
  base: string,
  remainderCurrency: string,
  remainderDenomination: number,
): ChangeDistribution {
  const distribution: ChangeDistribution = {};
  if (amountInMain > 0) distribution[mainCurrency] = amountInMain;

  const remainderBase =
    changeAmountBase - convertToBase(amountInMain, mainCurrency, rates, base);

  if (remainderBase > EPS) {
    distribution[remainderCurrency] = ceilToStep(
      convertFromBase(remainderBase, remainderCurrency, rates, base),
      remainderDenomination,
    );
  }
  return distribution;
}

/**
 * The currency whose smallest bill is worth least — the one that can absorb
 * a remainder without rounding it away.
 *
 * Deliberately not "the base currency": a business can be based in the coarse
 * currency. Casa de Cristal is based in USD, whose smallest bill is 1 USD,
 * and settles remainders in CUP, where a bill is worth ~0.0015 USD. Sending
 * the remainder to base there would round 63.33 USD up to 64 and hand the
 * customer money that was never owed.
 */
export function remainderCurrencyFor(
  currencies: string[],
  rates: ITasaSnapshot,
  base: string,
  denominationsFor: (currency: string) => number[],
): string {
  let best = base;
  let bestValue = Infinity;
  for (const currency of currencies) {
    if (denominationsFor(currency).length === 0) continue;
    const value = convertToBase(
      smallestDenomination(denominationsFor(currency)),
      currency,
      rates,
      base,
    );
    if (value < bestValue) {
      bestValue = value;
      best = currency;
    }
  }
  return best;
}

/**
 * Every split the cashier is plausibly choosing between, best first.
 *
 * Production data shows the choice is not a continuum but a handful of
 * points: hand over the largest deliverable amount in the currency the
 * customer paid with, hand over none of it and settle in the finer currency,
 * or stop at a round bill in between — always a denomination, never an
 * arbitrary number. So the options are generated from the denominations
 * themselves, and a split that does not add up to what is owed cannot be
 * expressed at all.
 *
 * Replayed against 207 real multi-currency sales, the first option matches
 * what the cashier actually handed over 84% of the time and the list covers
 * 99.5% of them.
 */
export function changeOptions(
  lines: PaymentLine[],
  changeAmountBase: number,
  rates: ITasaSnapshot,
  base: string,
  currencies: string[],
  denominationsFor: (currency: string) => number[],
): ChangeOption[] {
  if (changeAmountBase <= 0) return [];

  const remainderCurrency = remainderCurrencyFor(
    currencies,
    rates,
    base,
    denominationsFor,
  );
  const remainderDenomination = smallestDenomination(
    denominationsFor(remainderCurrency),
  );
  const allInRemainder: ChangeDistribution = {
    [remainderCurrency]: ceilToStep(
      convertFromBase(changeAmountBase, remainderCurrency, rates, base),
      remainderDenomination,
    ),
  };

  const mainCurrency = mainCashCurrency(lines, rates, base);

  // Paid in the finest currency already (or not in cash at all): there is no
  // coarser denomination to split against, so there is nothing to choose.
  if (!mainCurrency || mainCurrency === remainderCurrency) {
    return [{ id: optionId(allInRemainder), distribution: allInRemainder }];
  }

  const mainDenominations = denominationsFor(mainCurrency);
  const mainDenomination = smallestDenomination(mainDenominations);
  const changeInMain = convertFromBase(
    changeAmountBase,
    mainCurrency,
    rates,
    base,
  );
  const maxInMain = floorToStep(changeInMain, mainDenomination);

  if (maxInMain <= 0) {
    return [{ id: optionId(allInRemainder), distribution: allInRemainder }];
  }

  // Round stopping points below the maximum: the largest multiple of each
  // bill that still fits. For 63 USD with bills 100/50/20/10/5/1 this is
  // 60 (three 20s) and 50 (one 50) — exactly the values the cashiers reach
  // for in the recorded sales.
  //
  // Walked from the largest bill down, and kept in that order, because the
  // cashier who steps below the maximum is holding back a big note, not
  // shaving off a small one. Keeping the amounts *closest* to the maximum
  // instead would offer 85 and 80 against a 87 maximum and drop the 50 that
  // the recorded sales actually used.
  const seenAmounts = new Set<number>();
  const stepDowns: number[] = [];
  for (const denomination of [...mainDenominations].sort((a, b) => b - a)) {
    if (denomination <= 0) continue;
    const amount = floorToStep(maxInMain, denomination);
    if (amount <= 0 || amount >= maxInMain || seenAmounts.has(amount)) continue;
    seenAmounts.add(amount);
    stepDowns.push(amount);
    if (stepDowns.length === MAX_STEP_DOWN_OPTIONS) break;
  }
  stepDowns.sort((a, b) => b - a);

  const amounts = [maxInMain, ...stepDowns, 0];

  const options = amounts.map((amountInMain) => {
    const distribution = splitWith(
      amountInMain,
      mainCurrency,
      changeAmountBase,
      rates,
      base,
      remainderCurrency,
      remainderDenomination,
    );
    return { id: optionId(distribution), distribution };
  });

  // A split can collapse onto another once both parts are rounded (a tiny
  // remainder ceiling to the same base amount, say). Identical ids would
  // then render as duplicate choices and make selection ambiguous.
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
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

/** Drawer shortfall for a currency whose distributed change exceeds it. */
export interface ChangeError {
  available: number;
  currency: string;
}

export type ChangeErrors = Record<string, ChangeError | null>;

/**
 * Structured so each call site composes its own sentence — the caller knows
 * whether it is rendering the error alone or alongside other copy, and
 * `formatMontoEnMoneda` needs both `available` and `currency` to format.
 */
export function changeErrors(
  distribution: ChangeDistribution,
  lines: PaymentLine[],
  drawerBalance: Record<string, number>,
): ChangeErrors {
  const available = changeAvailability(lines, drawerBalance);
  return Object.fromEntries(
    Object.entries(distribution).map(([currency, amount]) => {
      const cap = available[currency] ?? 0;
      return [
        currency,
        amount > cap + BALANCE_EPSILON ? { available: cap, currency } : null,
      ];
    }),
  );
}

export function hasChangeErrors(errors: ChangeErrors): boolean {
  return Object.values(errors).some((error) => error !== null);
}

export function toVueltoLineas(
  distribution: ChangeDistribution,
): IVueltoLinea[] {
  return Object.entries(distribution)
    .filter(([, amount]) => amount > 0)
    .map(([moneda, monto]) => ({ moneda, monto }));
}
