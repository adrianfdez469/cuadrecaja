import { SALES_CUTOFF_STEP_MS } from "@/constants/cierre";

/**
 * The time of a sale, defined ONCE.
 *
 * A sale carries two timestamps that do not mean the same thing, and before
 * F-030 seven call sites picked between them by hand while the closing cut
 * compared a third thing. This module is the single definition every consumer
 * derives from.
 *
 * No Prisma, no React and no `@/schemas/**` here on purpose: a value cycle
 * between schema modules compiles clean and blows up at load time (E-028), and
 * a symbol living in a `.tsx` is not importable from a test at all (E-015).
 */

/**
 * The two timestamps every sale carries, and the only input this module needs.
 *
 * `frontendCreatedAt` is REQUIRED, never optional: a caller that forgets to
 * select the column would compile clean and silently fall back to createdAt for
 * every sale, which is the pre-F-030 behaviour restored by accident (E-013).
 * A source that types it as `Date | undefined` maps `?? null` at its boundary.
 */
export interface SaleTimestamps {
  /** Stamped by Postgres on INSERT: when the sale REACHED the server. */
  createdAt: Date;
  /** The selling device's own clock, or null for a sale older than the column. */
  frontendCreatedAt: Date | null;
}

/**
 * The instant the sale REPORTS it happened. The convention five call sites of
 * this project already apply by hand, named once here so the cap below has a
 * single thing to be built on.
 *
 * This is NOT the effective time the acceptance criteria speak of: it is
 * uncapped and can therefore lie in the future. Nothing decides membership of a
 * close with it — see saleEffectiveAt.
 */
export function saleReportedAt(sale: SaleTimestamps): Date {
  return sale.frontendCreatedAt ?? sale.createdAt;
}

/**
 * THE effective time of a sale, and the only definition of it: the reported
 * instant, capped so it never lies in the future of `now`. When the device
 * clock runs ahead, its claim is dropped and the server's own stamp decides.
 *
 * Why the cap exists: a cutoff is bounded by the server clock
 * (isSalesCutoffWithinPeriod requires cutoffAt <= now), so a reported instant
 * later than `now` is unreachable by every valid cutoff and the sale would keep
 * deferring, close after close, until the real clock caught up.
 *
 * The cap is NOT min(frontendCreatedAt, createdAt). A device instant that has
 * ALREADY elapsed wins over the server stamp even when it is later than it:
 * that is the whole content of acceptance criterion 4.
 *
 * Boundary: the cap fires on `reported > now` only. `reported === now` is
 * honoured, so it matches deferredSalesEffectiveWhere at the same edge.
 *
 * `now` is a parameter and is never read from the clock inside: one request
 * resolves it once and hands the same value to every consumer, so one sale
 * cannot get two answers inside one close (acceptance criterion 6).
 */
export function saleEffectiveAt(sale: SaleTimestamps, now: Date): Date {
  if (sale.frontendCreatedAt === null || sale.frontendCreatedAt === undefined) {
    return sale.createdAt;
  }
  // The escape branch is NOT capped again: clamping twice would be a second
  // definition of the same rule.
  if (sale.frontendCreatedAt.getTime() > now.getTime()) return sale.createdAt;
  return sale.frontendCreatedAt;
}

/**
 * The `fecha` a stock movement of a sale is stamped with: the effective time,
 * EXCEPT when it precedes the start of the period the sale is accounted in.
 *
 * MovimientoStock has no relation to a period — its date is the ONLY carrier of
 * which period it belongs to — so a date before the period start would account
 * the movement in a period its own sale is not in, and the stock identity of
 * ADR 0071 would stop closing on the open period. That happens for real in one
 * case with a name: a sale the client moved into the current period after its
 * own period had closed.
 *
 * The fallback is the EARLIEST instant that belongs to the period,
 * periodStart + SALES_CUTOFF_STEP_MS, because the movement has to inherit the
 * position its own sale has: a sale whose effective time precedes periodStart
 * is inside EVERY valid cut of that period (a cut is strictly later than
 * periodStart), and this is the only date inside the period with that same
 * property. Stamping createdAt instead splits them apart under any cut earlier
 * than the sync; stamping periodStart itself counts in both windows, always,
 * because it is the exact fechaFin of the previous period.
 *
 * `now` is not a parameter here: the clock is the row's own createdAt, which
 * makes the stamp deterministic and identical on both sale routes.
 */
export function saleMovementFecha(
  sale: SaleTimestamps,
  periodStart: Date,
): Date {
  const effectiveAt = saleEffectiveAt(sale, sale.createdAt);
  if (effectiveAt.getTime() >= periodStart.getTime()) return effectiveAt;
  return new Date(periodStart.getTime() + SALES_CUTOFF_STEP_MS);
}
