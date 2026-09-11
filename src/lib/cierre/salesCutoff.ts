import { startOfNextDay } from "@/utils/date";
import { SALES_CUTOFF_STEP_MS } from "@/constants/cierre";
import { saleEffectiveAt, type SaleTimestamps } from "@/lib/venta/saleTime";
// `import type`, never a value import: this module must not pull the schemas
// module at load time (E-028, a value cycle between two schema modules).
import type { ISalesCutoffTarget } from "@/schemas/cierre";

/**
 * The cut of a close: one instant stored on the open period.
 *
 * This module is THE definition of what a cut means. The in-memory partition,
 * the SQL filter of the transfer, the day chips and the flat list the dialog
 * renders all derive from `isSaleIncludedInCutoff` and none of them restates
 * it, so a correction cannot leave a copy behind (E-014, E-039).
 *
 * No Prisma and no React here on purpose: acceptance criterion 12 requires this
 * logic to be testable without a database, and a symbol living in a `.tsx` is
 * not importable from a test at all (E-015).
 */

/**
 * THE definition of what enters a close. Every other form in this file derives
 * from it; nothing outside restates it.
 *
 * It takes the SALE and not a bare instant on purpose: the column a caller
 * would reach for by hand is exactly the one F-030 stopped comparing against.
 *
 * A NULL cutoff means "no cut": every sale of the period is included.
 */
export function isSaleIncludedInCutoff(
  sale: SaleTimestamps,
  cutoffAt: Date | null,
  now: Date,
): boolean {
  if (cutoffAt === null || cutoffAt === undefined) return true;
  return saleEffectiveAt(sale, now).getTime() <= cutoffAt.getTime();
}

export interface SalesPartition<T> {
  included: T[];
  deferred: T[];
}

/**
 * Splits the sales of an open period into the ones the close takes and the ones
 * it defers, preserving the order it received. Built on isSaleIncludedInCutoff.
 */
export function partitionSalesByCutoff<T extends SaleTimestamps>(
  sales: readonly T[],
  cutoffAt: Date | null,
  now: Date,
): SalesPartition<T> {
  const included: T[] = [];
  const deferred: T[] = [];

  for (const sale of sales) {
    if (isSaleIncludedInCutoff(sale, cutoffAt, now)) included.push(sale);
    else deferred.push(sale);
  }

  return { included, deferred };
}

/**
 * The `where` fragment that selects the DEFERRED side, for the updateMany that
 * reassigns those sales at close time. The ONLY SQL rendering of the rule, and
 * the exact complement of isSaleIncludedInCutoff at the same boundary.
 *
 * Three branches because the effective time is a CASE and SQL has to spell it
 * out. They are mutually exclusive, and together they cover every row, given
 * that a stored cutoff satisfies cutoffAt <= now:
 *
 *   1. device time elapsed and after the cut  -> deferred by the device
 *   2. device time still in the future        -> the server stamp decides
 *   3. no device time                         -> the server stamp decides
 *
 * It carries no tenant clause: the caller ANDs it with cierrePeriodoId, which
 * was tied to the store and the store to the session's business.
 */
export interface DeferredSalesWhere {
  OR: [
    { frontendCreatedAt: { gt: Date; lte: Date } },
    { frontendCreatedAt: { gt: Date }; createdAt: { gt: Date } },
    { frontendCreatedAt: null; createdAt: { gt: Date } },
  ];
}

export function deferredSalesEffectiveWhere(
  cutoffAt: Date,
  now: Date,
): DeferredSalesWhere {
  return {
    OR: [
      { frontendCreatedAt: { gt: cutoffAt, lte: now } },
      { frontendCreatedAt: { gt: now }, createdAt: { gt: cutoffAt } },
      { frontendCreatedAt: null, createdAt: { gt: cutoffAt } },
    ],
  };
}

/** Local midnight that opens the day a date falls in. */
function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * The cutoff a day chip sets: the last representable instant of that day, so
 * the day itself AND every earlier day enter the close.
 *
 * Derived from startOfNextDay, the day boundary convention this project already
 * uses, minus one step. Local time of the runtime that calls it — see the note
 * on where this may run.
 */
export function dayCutoffAt(day: Date): Date {
  return new Date(startOfNextDay(day).getTime() - SALES_CUTOFF_STEP_MS);
}

export interface SalesDayGroup<T> {
  /** Local midnight that opens the day. */
  dayStart: Date;
  /** The cutoff the chip for this day sets: dayCutoffAt(dayStart). */
  cutoffAt: Date;
  sales: T[];
}

/**
 * The distinct days with sales, oldest first, with each day's sales in the
 * order received. Same day boundary as dayCutoffAt.
 */
export function groupSalesByDay<T extends SaleTimestamps>(
  sales: readonly T[],
  now: Date,
): SalesDayGroup<T>[] {
  const byDay = new Map<number, SalesDayGroup<T>>();

  for (const sale of sales) {
    const dayStart = startOfDay(saleEffectiveAt(sale, now));
    const key = dayStart.getTime();
    const group = byDay.get(key);
    if (group) group.sales.push(sale);
    else
      byDay.set(key, {
        dayStart,
        cutoffAt: dayCutoffAt(dayStart),
        sales: [sale],
      });
  }

  return [...byDay.values()].sort(
    (a, b) => a.dayStart.getTime() - b.dayStart.getTime(),
  );
}

export type SalesCutoffChoice =
  // "Whole period" and "Remove cut" are the SAME choice: leave the period with
  // no cut at all. Decision of the human, 2026-09-08.
  | { kind: "clear" }
  | { kind: "nothing" }
  | { kind: "day"; dayStart: Date }
  // Tapping a sale: that sale enters, everything after it defers. It carries
  // the EFFECTIVE instant the row was painted with, never a raw column, so
  // what the operator sees and what the cut becomes are one value.
  | { kind: "sale"; effectiveAt: Date };

/**
 * Translates what the operator picked in the dialog into the target of the
 * request. It never produces an instant the range check would reject, which is
 * the whole reason it takes the period and the clock:
 *
 *   "clear"   -> mode "clear".
 *   "nothing" -> one step after fechaInicio, never fechaInicio itself.
 *   "day"     -> dayCutoffAt(dayStart).
 *   "sale"    -> the effective instant the row was painted with, which by the
 *                inclusive boundary puts that sale itself inside the close.
 *
 * The last two are then clamped, in this order:
 *   1. Earlier than one step after fechaInicio -> that instant instead. Since
 *      F-030 the cut is compared against the effective time, so this IS reached
 *      by a backdated offline sale: its device time can precede the start of
 *      the period its sync landed in. The sale still enters, because inclusion
 *      is effective time <= cutoff.
 *   2. Later than `now` -> mode "now", so the SERVER stamps it. Today's chip
 *      hits this every time: the end of today has not happened yet.
 */
export function resolveSalesCutoffRequest(
  choice: SalesCutoffChoice,
  period: { fechaInicio: Date },
  now: Date,
): ISalesCutoffTarget {
  const earliest = new Date(
    period.fechaInicio.getTime() + SALES_CUTOFF_STEP_MS,
  );

  if (choice.kind === "clear") return { mode: "clear" };
  if (choice.kind === "nothing") return { mode: "at", cutoffAt: earliest };

  const wanted =
    choice.kind === "day" ? dayCutoffAt(choice.dayStart) : choice.effectiveAt;

  const clamped =
    wanted.getTime() < earliest.getTime()
      ? earliest
      : new Date(wanted.getTime());

  if (clamped.getTime() > now.getTime()) return { mode: "now" };
  return { mode: "at", cutoffAt: clamped };
}

/**
 * PURE. The range rule of acceptance criterion 9: a cutoff must fall after the
 * period start and no later than now. Used by BOTH routes that accept one, so
 * the rule has a single definition.
 *
 * Strict on the lower bound: a cutoff equal to fechaInicio would give the closed
 * period and the one the close creates the same start, and the four queries that
 * resolve "the last period" by `orderBy fechaInicio desc limit 1` could then pick
 * the closed one and open a third.
 */
export function isSalesCutoffWithinPeriod(
  cutoffAt: Date,
  period: { fechaInicio: Date },
  now: Date,
): boolean {
  return (
    cutoffAt.getTime() > period.fechaInicio.getTime() &&
    cutoffAt.getTime() <= now.getTime()
  );
}

export type SalesCutoffListItem<T> =
  | { kind: "day"; dayStart: Date }
  | { kind: "sale"; sale: T; included: boolean }
  | { kind: "cut"; cutoffAt: Date };

/**
 * The flat list the cutoff dialog renders: one day header per distinct day,
 * one item per sale in the order received, and the cut marker at the boundary.
 *
 * Built on groupSalesByDay and partitionSalesByCutoff; it restates neither.
 *
 * The cut item is emitted whenever cutoffAt is not null, exactly once, right
 * after the last included sale — and therefore BEFORE the next day header when
 * the cut falls at the end of a day, never between a day header and its own
 * first sale. The one exception is a cut that leaves nothing inside: then there
 * is no "last included sale" and the marker opens the list, right after the
 * first day header.
 */
export function buildSalesCutoffListItems<T extends SaleTimestamps>(
  sales: readonly T[],
  cutoffAt: Date | null,
  now: Date,
): SalesCutoffListItem<T>[] {
  const items: SalesCutoffListItem<T>[] = [];
  const groups = groupSalesByDay(sales, now);
  const includedCount = partitionSalesByCutoff(sales, cutoffAt, now).included
    .length;

  let pending = cutoffAt !== null && cutoffAt !== undefined;
  let seenIncluded = 0;

  for (const group of groups) {
    items.push({ kind: "day", dayStart: group.dayStart });

    if (pending && includedCount === 0) {
      items.push({ kind: "cut", cutoffAt });
      pending = false;
    }

    for (const sale of group.sales) {
      const included = isSaleIncludedInCutoff(sale, cutoffAt, now);
      items.push({ kind: "sale", sale, included });
      if (!included) continue;

      seenIncluded += 1;
      if (pending && seenIncluded === includedCount) {
        items.push({ kind: "cut", cutoffAt });
        pending = false;
      }
    }
  }

  // No sale at all in the period, yet a cut is set: the marker is still the
  // only thing that says where the next period will start.
  if (pending) items.push({ kind: "cut", cutoffAt });

  return items;
}
