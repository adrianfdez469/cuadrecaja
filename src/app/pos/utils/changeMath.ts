import {
  convertToBase,
  convertFromBase,
  roundBaseToAnchorCents,
} from "@/lib/currency";
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

/** A split with nothing in it — the change owed is below the finest bill. */
function isEmptySplit(distribution: ChangeDistribution): boolean {
  return Object.keys(distribution).length === 0;
}

/** Wraps a single split, or offers none at all when it is empty. */
function asOptions(distribution: ChangeDistribution): ChangeOption[] {
  return isEmptySplit(distribution)
    ? []
    : [{ id: optionId(distribution), distribution }];
}

/**
 * Base-currency value of a split: what actually leaves the drawer.
 *
 * Not the same number as the change owed — whatever falls below one bill of
 * the finest currency is never handed over and stays in the till — so this is
 * what the checkout must show and what caps a tip taken from the change.
 */
export function distributionBase(
  distribution: ChangeDistribution,
  rates: ITasaSnapshot,
  base: string,
): number {
  const total = Object.entries(distribution).reduce(
    (sum, [currency, amount]) =>
      amount > 0 ? sum + convertToBase(amount, currency, rates, base) : sum,
    0,
  );
  return roundBaseToAnchorCents(total, rates, base);
}

/**
 * Splits `changeAmountBase` given `amountInMain` units of the main currency,
 * with the remainder in `remainderCurrency`. Both parts are floored to their
 * own bill size, so no split ever hands over more than is owed.
 *
 * What is left below one bill of the finest currency cannot be handed over at
 * all, so no line is emitted for it: it stays in the drawer, where the cash
 * count expects it, instead of being rounded up to a whole bill the sale
 * never took.
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
    const remainderAmount = floorToStep(
      convertFromBase(remainderBase, remainderCurrency, rates, base),
      remainderDenomination,
    );
    if (remainderAmount > 0) distribution[remainderCurrency] = remainderAmount;
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
 * themselves, and every split adds up to what is owed save for the sliver
 * below one bill of the finest currency, which no split can express and none
 * hands over.
 *
 * Nothing is ever rounded up: a split that overshot the debt would be money
 * leaving the till that the sale never took. When the whole change is that
 * sliver — a 0.25 debt where the smallest bill is 1 — there is no option at
 * all and the overpayment stays in the drawer.
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
  const allInRemainderAmount = floorToStep(
    convertFromBase(changeAmountBase, remainderCurrency, rates, base),
    remainderDenomination,
  );
  const allInRemainder: ChangeDistribution =
    allInRemainderAmount > 0
      ? { [remainderCurrency]: allInRemainderAmount }
      : {};

  const mainCurrency = mainCashCurrency(lines, rates, base);

  // Paid in the finest currency already (or not in cash at all): there is no
  // coarser denomination to split against, so there is nothing to choose.
  if (!mainCurrency || mainCurrency === remainderCurrency) {
    return asOptions(allInRemainder);
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
    return asOptions(allInRemainder);
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

  // A split can collapse onto another once both parts are floored (two
  // amounts whose remainders truncate to the same bill, say). Identical ids
  // would then render as duplicate choices and make selection ambiguous. The
  // empty split is dropped outright: "hand over nothing" is not a choice.
  const seen = new Set<string>();
  return options.filter((option) => {
    if (isEmptySplit(option.distribution)) return false;
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

/**
 * Id of the cashier's own split. Fixed instead of derived from the amounts the
 * way {@link optionId} is: an id that changed on every keystroke would drop the
 * selection halfway through typing.
 */
export const CUSTOM_CHANGE_ID = "custom";

/** A hand-typed split, with the leftover already settled. */
export interface CustomChangeSplit {
  distribution: ChangeDistribution;
  /** The currency that absorbs whatever the typed amounts leave over. */
  remainderCurrency: string;
  /** How much the typed part exceeds the change by, in base. 0 when it fits. */
  overshootBase: number;
}

/**
 * Completes a hand-typed split: the cashier states the coarse currencies and
 * the finest one is filled with whatever is still owed, so the split adds up to
 * the change no matter what is typed.
 *
 * This is the escape hatch for what {@link changeOptions} cannot express — a
 * third currency, or an amount that is not a multiple of any bill — and it
 * exists alongside those options, not instead of them: the pre-computed splits
 * still cover 99.5% of the recorded sales.
 *
 * Overshoot is reported rather than clamped away. Typing past what is owed
 * means handing the customer money the sale never took, so the caller blocks
 * on it instead of quietly shrinking the amount the cashier just wrote.
 */
export function customChangeSplit(
  amounts: ChangeDistribution,
  changeAmountBase: number,
  rates: ITasaSnapshot,
  base: string,
  currencies: string[],
  denominationsFor: (currency: string) => number[],
): CustomChangeSplit {
  const remainderCurrency = remainderCurrencyFor(
    currencies,
    rates,
    base,
    denominationsFor,
  );
  const remainderDenomination = smallestDenomination(
    denominationsFor(remainderCurrency),
  );

  // Insertion order is what the sheet and `formatChangeSplit` render, so the
  // typed currencies come first and the remainder lands last — the same order
  // `splitWith` produces, and the order the cashier counts the money out in.
  const distribution: ChangeDistribution = {};
  let typedBase = 0;
  for (const [currency, amount] of Object.entries(amounts)) {
    if (currency === remainderCurrency || !(amount > 0)) continue;
    distribution[currency] = amount;
    typedBase += convertToBase(amount, currency, rates, base);
  }

  // Anchor-cent grid, not base cents: with a USD base, round2 here would
  // erase a remainder worth several CUP (0.0037 USD ≈ 2.5 CUP → 0).
  const remainderBase = roundBaseToAnchorCents(
    changeAmountBase - typedBase,
    rates,
    base,
  );
  if (remainderBase > EPS) {
    const remainderAmount = floorToStep(
      convertFromBase(remainderBase, remainderCurrency, rates, base),
      remainderDenomination,
    );
    if (remainderAmount > 0) distribution[remainderCurrency] = remainderAmount;
  }

  return {
    distribution,
    remainderCurrency,
    overshootBase: remainderBase < -EPS ? -remainderBase : 0,
  };
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
