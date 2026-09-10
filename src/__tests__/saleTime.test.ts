import { describe, expect, it } from "vitest";
import {
  saleReportedAt,
  saleEffectiveAt,
  saleMovementFecha,
  type SaleTimestamps,
} from "@/lib/venta/saleTime";
import { SALES_CUTOFF_STEP_MS } from "@/constants/cierre";
import { isSalesCutoffWithinPeriod } from "@/lib/cierre/salesCutoff";

/**
 * F-030 — contract § 1 (ADR 0108).
 *
 * `src/lib/venta/saleTime.ts` is THE single definition of "when a sale
 * happened" for every consumer this feature touches: the cutoff partition,
 * the SQL filter of the transfer, the day grouping, the row the dialog
 * paints, and the `fecha` a VENTA's stock movement is sealed with.
 *
 * Dates are built with LOCAL constructors, never ISO strings ending in "Z":
 * this suite cares about exact millisecond boundaries, and a string literal
 * would tie it to the runner's own timezone offset.
 */

const d = (
  year: number,
  month: number,
  day: number,
  h = 0,
  m = 0,
  s = 0,
  ms = 0,
) => new Date(year, month, day, h, m, s, ms);

const timestamps = (
  createdAt: Date,
  frontendCreatedAt: Date | null,
): SaleTimestamps => ({ createdAt, frontendCreatedAt });

describe("saleReportedAt", () => {
  it("falls back to createdAt when frontendCreatedAt is null (acceptance criterion 3)", () => {
    const createdAt = d(2026, 8, 8, 7);
    expect(saleReportedAt(timestamps(createdAt, null)).getTime()).toBe(
      createdAt.getTime(),
    );
  });

  it("prefers frontendCreatedAt over createdAt whenever both are present", () => {
    const createdAt = d(2026, 8, 9, 7);
    const frontendCreatedAt = d(2026, 8, 8, 22);
    expect(
      saleReportedAt(timestamps(createdAt, frontendCreatedAt)).getTime(),
    ).toBe(frontendCreatedAt.getTime());
  });

  it("is NOT capped against the present — a frontendCreatedAt far in the future is returned as-is, which is exactly what separates it from saleEffectiveAt", () => {
    const createdAt = d(2026, 9, 9, 7);
    const future = d(2099, 0, 1);
    expect(saleReportedAt(timestamps(createdAt, future)).getTime()).toBe(
      future.getTime(),
    );
  });
});

describe("saleEffectiveAt", () => {
  const now = d(2026, 8, 9, 7, 0, 0, 0);

  it("falls back to createdAt when frontendCreatedAt is null (acceptance criterion 3) — no change in behaviour", () => {
    const createdAt = d(2026, 8, 8, 22);
    expect(saleEffectiveAt(timestamps(createdAt, null), now).getTime()).toBe(
      createdAt.getTime(),
    );
  });

  it("honours a frontendCreatedAt that has already elapsed even though it is LATER than createdAt — the offline sale of acceptance criterion 1", () => {
    const frontendCreatedAt = d(2026, 8, 8, 22); // reported yesterday 22:00
    const createdAt = d(2026, 8, 9, 7); // synced today 07:00
    expect(
      saleEffectiveAt(timestamps(createdAt, frontendCreatedAt), now).getTime(),
    ).toBe(frontendCreatedAt.getTime());
  });

  it("is NOT min(frontendCreatedAt, createdAt): the acceptance-criterion-4 pair (createdAt earlier, frontendCreatedAt later but already elapsed) resolves to the LATER device time, never falls back to the earlier createdAt", () => {
    const createdAt = d(2026, 8, 8, 6); // would be "the more favourable" answer
    const frontendCreatedAt = d(2026, 8, 8, 8); // later, but already happened by `laterNow`
    const laterNow = d(2026, 8, 8, 9);
    const effective = saleEffectiveAt(
      timestamps(createdAt, frontendCreatedAt),
      laterNow,
    );
    expect(effective.getTime()).not.toBe(createdAt.getTime());
    expect(effective.getTime()).toBe(frontendCreatedAt.getTime());
  });

  it("boundary: a frontendCreatedAt EXACTLY equal to now is honoured — matches deferredSalesEffectiveWhere at the same edge", () => {
    const frontendCreatedAt = new Date(now.getTime());
    const createdAt = d(2026, 8, 9, 7, 0, 0, 1);
    expect(
      saleEffectiveAt(timestamps(createdAt, frontendCreatedAt), now).getTime(),
    ).toBe(frontendCreatedAt.getTime());
  });

  it("boundary: a frontendCreatedAt one step AFTER now is capped — the reported instant has not happened yet from the server's point of view", () => {
    const frontendCreatedAt = new Date(now.getTime() + SALES_CUTOFF_STEP_MS);
    const createdAt = d(2026, 8, 9, 6, 55);
    expect(
      saleEffectiveAt(timestamps(createdAt, frontendCreatedAt), now).getTime(),
    ).toBe(createdAt.getTime());
  });

  it("acceptance criterion 5: a frontendCreatedAt ahead of the server clock defers to createdAt, and createdAt is always reachable by a cutoff fixed at `now` — the sale is never excluded from every close forever", () => {
    const createdAt = d(2026, 8, 9, 6, 50); // already happened
    const frontendCreatedAt = d(2026, 8, 9, 9, 0); // device claims a time still in the future
    const effective = saleEffectiveAt(
      timestamps(createdAt, frontendCreatedAt),
      now,
    );
    expect(effective.getTime()).toBe(createdAt.getTime());

    const period = { fechaInicio: d(2026, 8, 6, 9) };
    expect(isSalesCutoffWithinPeriod(now, period, now)).toBe(true);
    expect(effective.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("the escape branch is NOT re-capped: even with a skewed createdAt later than `now`, a future frontendCreatedAt falls back to createdAt verbatim, not to `now` or to any other clamp", () => {
    const skewedCreatedAt = new Date(now.getTime() + 5 * 60_000);
    const frontendCreatedAt = new Date(now.getTime() + 10 * 60_000);
    const effective = saleEffectiveAt(
      timestamps(skewedCreatedAt, frontendCreatedAt),
      now,
    );
    expect(effective.getTime()).toBe(skewedCreatedAt.getTime());
  });

  it("`now` is read only from the parameter: two calls for the same sale with the same explicit `now` always agree (acceptance criterion 6)", () => {
    const sale = timestamps(d(2026, 8, 8, 22), d(2026, 8, 8, 21));
    const first = saleEffectiveAt(sale, now);
    const second = saleEffectiveAt(sale, now);
    expect(first.getTime()).toBe(second.getTime());
  });
});

describe("saleMovementFecha", () => {
  it("acceptance criterion 10: when the effective time falls ON OR AFTER periodStart, the movement is sealed with that exact instant, not with createdAt", () => {
    const periodStart = d(2026, 8, 8, 7);
    const createdAt = d(2026, 8, 9, 7); // synced next morning
    const frontendCreatedAt = d(2026, 8, 8, 22); // sold yesterday 22:00, inside this period
    const fecha = saleMovementFecha(
      timestamps(createdAt, frontendCreatedAt),
      periodStart,
    );
    expect(fecha.getTime()).toBe(frontendCreatedAt.getTime());
    expect(fecha.getTime()).not.toBe(createdAt.getTime());
  });

  it("§ 12 / § 1.2.1: when the effective time falls BEFORE periodStart (the sale moved to the current period), the movement seals at periodStart + SALES_CUTOFF_STEP_MS — never createdAt, never periodStart itself", () => {
    const periodStart = d(2026, 8, 9, 7, 30);
    const frontendCreatedAt = d(2026, 8, 8, 22); // the sale's real hour: yesterday
    const createdAt = d(2026, 8, 9, 9, 0); // synced after the move, at 09:00
    const fecha = saleMovementFecha(
      timestamps(createdAt, frontendCreatedAt),
      periodStart,
    );
    expect(fecha.getTime()).toBe(periodStart.getTime() + SALES_CUTOFF_STEP_MS);
    expect(fecha.getTime()).not.toBe(createdAt.getTime());
    expect(fecha.getTime()).not.toBe(periodStart.getTime());
  });

  it("boundary: an effective time exactly EQUAL to periodStart is not clamped — the frontier is inclusive and that instant already belongs to the window", () => {
    const periodStart = d(2026, 8, 9, 7, 30);
    const frontendCreatedAt = new Date(periodStart.getTime());
    const createdAt = d(2026, 8, 9, 9);
    const fecha = saleMovementFecha(
      timestamps(createdAt, frontendCreatedAt),
      periodStart,
    );
    expect(fecha.getTime()).toBe(periodStart.getTime());
  });

  it("the property the fallback exists to protect: for a sale whose effective time precedes periodStart, the movement's fecha is <= EVERY cutoff isSalesCutoffWithinPeriod would accept for that period — the sale and its movement can never fall on opposite sides", () => {
    const periodStart = d(2026, 8, 9, 7, 30);
    const frontendCreatedAt = d(2026, 8, 8, 22);
    const createdAt = d(2026, 8, 9, 10); // sync time, well after every candidate cutoff below
    const fecha = saleMovementFecha(
      timestamps(createdAt, frontendCreatedAt),
      periodStart,
    );
    const period = { fechaInicio: periodStart };
    const candidateCutoffs = [
      new Date(periodStart.getTime() + SALES_CUTOFF_STEP_MS), // "Nada" — the smallest legal cutoff
      d(2026, 8, 9, 8),
      d(2026, 8, 9, 9, 30),
      createdAt,
    ];
    for (const cutoffAt of candidateCutoffs) {
      expect(isSalesCutoffWithinPeriod(cutoffAt, period, createdAt)).toBe(true);
      expect(fecha.getTime()).toBeLessThanOrEqual(cutoffAt.getTime());
    }
  });

  it("uses the sale's own createdAt as the clock, not the wall clock: a frontendCreatedAt claimed AFTER its own createdAt is capped exactly as saleEffectiveAt would cap it against that createdAt", () => {
    const periodStart = d(2026, 8, 8, 7);
    const createdAt = d(2026, 8, 8, 20); // the sale's own arrival at the server
    const frontendCreatedAt = d(2026, 8, 8, 23); // device claims a time AFTER its own createdAt
    const fecha = saleMovementFecha(
      timestamps(createdAt, frontendCreatedAt),
      periodStart,
    );
    expect(fecha.getTime()).toBe(createdAt.getTime());
  });
});
