import { describe, expect, it } from "vitest";
import {
  isSaleIncludedInCutoff,
  partitionSalesByCutoff,
  deferredSalesEffectiveWhere,
  dayCutoffAt,
  groupSalesByDay,
  resolveSalesCutoffRequest,
  isSalesCutoffWithinPeriod,
  buildSalesCutoffListItems,
  type DeferredSalesWhere,
  type SalesCutoffListItem,
} from "@/lib/cierre/salesCutoff";
import { saleEffectiveAt, type SaleTimestamps } from "@/lib/venta/saleTime";
import {
  SALES_CUTOFF_STEP_MS,
  SALES_CUTOFF_INSTRUCTION,
} from "@/constants/cierre";
import { startOfNextDay } from "@/utils/date";

/**
 * F-029/F-030 — contract § 2, § 3, § 15 (ADR 0104/0105/0108).
 *
 * `src/lib/cierre/salesCutoff.ts` is THE definition of what a close takes.
 * Since F-030 the comparison column is a sale's EFFECTIVE time
 * (`saleEffectiveAt`, `src/lib/venta/saleTime.ts`), never a raw column read
 * by hand — that is exactly the mistake F-030 exists to correct (F-029 had
 * this module compare `createdAt` alone). Every function here is derived from
 * `isSaleIncludedInCutoff`/`saleEffectiveAt` and none of them restates the
 * rule with a different boundary (E-014, E-039).
 *
 * Dates are built with LOCAL constructors, never ISO strings ending in "Z":
 * day grouping is local time, and a string literal would tie the test to the
 * runner's own timezone.
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

type Sale = { id: string } & SaleTimestamps;
const sale = (
  id: string,
  createdAt: Date,
  frontendCreatedAt: Date | null = null,
): Sale => ({ id, createdAt, frontendCreatedAt });

/** Local midnight — mirrors the module's own day boundary, for cross-checks. */
const localMidnight = (date: Date): Date => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

/**
 * Independent re-implementation of the three-branch OR of
 * `deferredSalesEffectiveWhere`, evaluated against a plain sale object — the
 * same technique F-029 used for `deferredSalesCreatedAtFilter`, now over
 * three branches instead of one.
 */
function matchesDeferredWhere(s: Sale, where: DeferredSalesWhere): boolean {
  const [byDeviceElapsed, byDeviceFuture, byNoDevice] = where.OR;
  const fc = s.frontendCreatedAt;
  const b1 =
    fc !== null &&
    fc.getTime() > byDeviceElapsed.frontendCreatedAt.gt.getTime() &&
    fc.getTime() <= byDeviceElapsed.frontendCreatedAt.lte.getTime();
  const b2 =
    fc !== null &&
    fc.getTime() > byDeviceFuture.frontendCreatedAt.gt.getTime() &&
    s.createdAt.getTime() > byDeviceFuture.createdAt.gt.getTime();
  const b3 =
    fc === null && s.createdAt.getTime() > byNoDevice.createdAt.gt.getTime();
  return b1 || b2 || b3;
}

describe("SALES_CUTOFF_STEP_MS", () => {
  it("is exactly 1 millisecond — the smallest instant timestamp(3) can distinguish, not an approximation", () => {
    expect(SALES_CUTOFF_STEP_MS).toBe(1);
  });
});

describe("SALES_CUTOFF_INSTRUCTION", () => {
  it("matches the exact copy the design contract fixes (.agents/designs/F-030.md) — anchored so the row's own instruction never drifts from a string typed twice (E-016)", () => {
    expect(SALES_CUTOFF_INSTRUCTION).toBe(
      "Toca una venta para cerrar hasta ella: entra esa venta y todas las anteriores. Las horas son las de la venta, aunque se haya sincronizado más tarde.",
    );
  });
});

describe("isSaleIncludedInCutoff", () => {
  const now = d(2026, 8, 9, 12);

  it("a NULL cutoff includes everything — the behaviour before this column existed", () => {
    expect(
      isSaleIncludedInCutoff(sale("s", d(2026, 8, 8, 10)), null, now),
    ).toBe(true);
    expect(isSaleIncludedInCutoff(sale("s", d(1999, 0, 1)), null, now)).toBe(
      true,
    );
  });

  it("acceptance criterion 3: with frontendCreatedAt null, decides by createdAt alone — no change from before this column existed", () => {
    const cutoff = d(2026, 8, 8, 12);
    expect(
      isSaleIncludedInCutoff(
        sale("before", d(2026, 8, 8, 11, 59, 59, 999)),
        cutoff,
        now,
      ),
    ).toBe(true);
    expect(
      isSaleIncludedInCutoff(
        sale("after", new Date(cutoff.getTime() + SALES_CUTOFF_STEP_MS)),
        cutoff,
        now,
      ),
    ).toBe(false);
  });

  it("INCLUDES a sale whose effective time coincides with the cutoff at the exact same millisecond — inclusive by below", () => {
    const cutoff = d(2026, 8, 8, 12);
    const atCutoff = sale(
      "at-cutoff",
      d(2026, 8, 9, 1),
      new Date(cutoff.getTime()),
    );
    expect(isSaleIncludedInCutoff(atCutoff, cutoff, now)).toBe(true);
  });

  it("acceptance criterion 1: an offline sale reported yesterday 22:00 but synced today 07:00 ENTERS a cutoff set at the end of yesterday", () => {
    const cutoff = dayCutoffAt(d(2026, 8, 8));
    const offlineSale = sale("offline", d(2026, 8, 9, 7), d(2026, 8, 8, 22));
    expect(isSaleIncludedInCutoff(offlineSale, cutoff, now)).toBe(true);
  });

  it("acceptance criterion 4: a frontendCreatedAt AFTER the cutoff (already elapsed) but a createdAt BEFORE it does NOT enter — the effective time decides, never the more favourable of the two", () => {
    const cutoff = d(2026, 8, 8, 7);
    const pair = sale("pair", d(2026, 8, 8, 6), d(2026, 8, 8, 8));
    expect(pair.createdAt.getTime()).toBeLessThan(cutoff.getTime());
    expect(pair.frontendCreatedAt!.getTime()).toBeGreaterThan(cutoff.getTime());
    expect(pair.frontendCreatedAt!.getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
    expect(isSaleIncludedInCutoff(pair, cutoff, now)).toBe(false);
  });

  it("acceptance criterion 5: a frontendCreatedAt AHEAD of the server clock does not exclude the sale forever — it falls back to createdAt, and a cutoff fixed at `now` reaches it", () => {
    const advancedClockSale = sale(
      "advanced",
      d(2026, 8, 9, 6),
      d(2026, 8, 9, 15), // device claims 15:00, but `now` is 12:00
    );
    expect(advancedClockSale.frontendCreatedAt!.getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(isSaleIncludedInCutoff(advancedClockSale, now, now)).toBe(true);
  });

  it("acceptance criterion 8: is exactly saleEffectiveAt(sale, now) compared against the cutoff — never a second definition of the same rule", () => {
    const cutoff = d(2026, 8, 8, 20);
    const cases = [
      sale("a", d(2026, 8, 8, 19)),
      sale("b", d(2026, 8, 8, 21)),
      sale("c", d(2026, 8, 8, 19), d(2026, 8, 8, 22)),
      sale("d", d(2026, 8, 9, 1), d(2026, 8, 8, 19)),
      sale("e", d(2026, 8, 8, 10), d(2026, 8, 9, 23)), // device time in the future
    ];
    for (const s of cases) {
      expect(isSaleIncludedInCutoff(s, cutoff, now)).toBe(
        saleEffectiveAt(s, now).getTime() <= cutoff.getTime(),
      );
    }
  });
});

describe("partitionSalesByCutoff", () => {
  const now = d(2026, 8, 9, 12);

  it("a NULL cutoff includes everything and defers nothing, preserving order", () => {
    const sales = [
      sale("c", d(2026, 8, 8, 20)),
      sale("a", d(2026, 8, 8, 8)),
      sale("b", d(2026, 8, 8, 14)),
    ];
    const { included, deferred } = partitionSalesByCutoff(sales, null, now);
    expect(included.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(deferred).toEqual([]);
  });

  it("acceptance criterion 1: splits by the EFFECTIVE time — an offline sale reported yesterday 22:00 but synced today enters a cutoff at the end of yesterday, while a same-day sale stays deferred", () => {
    const cutoff = dayCutoffAt(d(2026, 8, 8));
    const offline = sale("offline", d(2026, 8, 9, 7), d(2026, 8, 8, 22));
    const today = sale("today", d(2026, 8, 9, 8));
    const { included, deferred } = partitionSalesByCutoff(
      [offline, today],
      cutoff,
      now,
    );
    expect(included.map((s) => s.id)).toEqual(["offline"]);
    expect(deferred.map((s) => s.id)).toEqual(["today"]);
  });

  it("acceptance criterion 4: the pair with frontendCreatedAt after the cutoff (already elapsed) and createdAt before it is DEFERRED — never included via the more favourable createdAt", () => {
    const cutoff = d(2026, 8, 8, 7);
    const pair = sale("pair", d(2026, 8, 8, 6), d(2026, 8, 8, 8));
    const { included, deferred } = partitionSalesByCutoff([pair], cutoff, now);
    expect(included).toEqual([]);
    expect(deferred.map((s) => s.id)).toEqual(["pair"]);
  });

  it("acceptance criterion 5: a sale with the device clock ahead of `now` is included once the cutoff is fixed at `now` itself, via the createdAt fallback", () => {
    const advanced = sale("advanced", d(2026, 8, 9, 6), d(2026, 8, 9, 15));
    const { included, deferred } = partitionSalesByCutoff([advanced], now, now);
    expect(included.map((s) => s.id)).toEqual(["advanced"]);
    expect(deferred).toEqual([]);
  });

  it("preserves the order it RECEIVED on both sides — it never sorts by date", () => {
    const cutoff = d(2026, 8, 8, 12);
    const sales = [
      sale("i2", d(2026, 8, 8, 10)),
      sale("d2", d(2026, 8, 8, 18)),
      sale("i1", d(2026, 8, 8, 6)),
      sale("d1", d(2026, 8, 8, 16)),
    ];
    const { included, deferred } = partitionSalesByCutoff(sales, cutoff, now);
    expect(included.map((s) => s.id)).toEqual(["i2", "i1"]);
    expect(deferred.map((s) => s.id)).toEqual(["d2", "d1"]);
  });
});

describe("dayCutoffAt", () => {
  it("is exactly one step before startOfNextDay — an exact boundary, not an approximation", () => {
    const day = d(2026, 8, 8, 14, 30);
    expect(dayCutoffAt(day).getTime()).toBe(
      startOfNextDay(day).getTime() - SALES_CUTOFF_STEP_MS,
    );
  });

  it("depends only on the calendar day, not the time of day passed in", () => {
    expect(dayCutoffAt(d(2026, 8, 8, 0, 0, 0, 0)).getTime()).toBe(
      dayCutoffAt(d(2026, 8, 8, 23, 59, 59, 999)).getTime(),
    );
  });

  it("lands at 23:59:59.999 local time of that day", () => {
    const cutoff = dayCutoffAt(d(2026, 8, 8, 10));
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(8);
    expect(cutoff.getDate()).toBe(8);
    expect(cutoff.getHours()).toBe(23);
    expect(cutoff.getMinutes()).toBe(59);
    expect(cutoff.getSeconds()).toBe(59);
    expect(cutoff.getMilliseconds()).toBe(999);
  });
});

describe("deferredSalesEffectiveWhere", () => {
  const cutoffAt = d(2026, 8, 8, 20);
  const now = d(2026, 8, 9, 12);

  it("returns EXACTLY the three-branch OR the contract fixes, verbatim", () => {
    expect(deferredSalesEffectiveWhere(cutoffAt, now)).toEqual({
      OR: [
        { frontendCreatedAt: { gt: cutoffAt, lte: now } },
        { frontendCreatedAt: { gt: now }, createdAt: { gt: cutoffAt } },
        { frontendCreatedAt: null, createdAt: { gt: cutoffAt } },
      ],
    });
  });

  it("is the EXACT complement of isSaleIncludedInCutoff across the three branches, sampled at every boundary — the same guarantee F-029 required of deferredSalesCreatedAtFilter, now by triplicate", () => {
    const where = deferredSalesEffectiveWhere(cutoffAt, now);
    const samples: Sale[] = [
      sale("null-fc-before", d(2026, 8, 8, 19), null),
      sale("null-fc-at-cutoff", new Date(cutoffAt.getTime()), null),
      sale(
        "null-fc-after",
        new Date(cutoffAt.getTime() + SALES_CUTOFF_STEP_MS),
        null,
      ),
      sale(
        "device-before-cutoff",
        d(2026, 8, 9, 1),
        new Date(cutoffAt.getTime() - SALES_CUTOFF_STEP_MS),
      ),
      sale("device-at-cutoff", d(2026, 8, 9, 1), new Date(cutoffAt.getTime())),
      sale(
        "device-after-cutoff-elapsed",
        d(2026, 8, 9, 1),
        new Date(cutoffAt.getTime() + SALES_CUTOFF_STEP_MS),
      ),
      sale("device-at-now", d(2026, 8, 9, 1), new Date(now.getTime())),
      sale(
        "device-after-now-createdAt-after-cutoff",
        d(2026, 8, 9, 1),
        new Date(now.getTime() + SALES_CUTOFF_STEP_MS),
      ),
      sale(
        "device-after-now-createdAt-before-cutoff",
        d(2026, 8, 8, 10),
        new Date(now.getTime() + SALES_CUTOFF_STEP_MS),
      ),
    ];

    for (const s of samples) {
      expect(matchesDeferredWhere(s, where)).toBe(
        !isSaleIncludedInCutoff(s, cutoffAt, now),
      );
    }
  });

  it("boundary: a sale whose effective time EQUALS the cutoff exactly is NOT deferred — tested at the edge, not the middle of a branch", () => {
    const where = deferredSalesEffectiveWhere(cutoffAt, now);
    const atCutoff = sale(
      "at-cutoff-via-device",
      d(2026, 8, 9, 1),
      new Date(cutoffAt.getTime()),
    );
    expect(isSaleIncludedInCutoff(atCutoff, cutoffAt, now)).toBe(true);
    expect(matchesDeferredWhere(atCutoff, where)).toBe(false);
  });

  it("carries no tenant clause — it is combined by the caller with cierrePeriodoId", () => {
    const where = deferredSalesEffectiveWhere(cutoffAt, now);
    expect(where).not.toHaveProperty("negocioId");
    expect(where).not.toHaveProperty("tiendaId");
    expect(Object.keys(where)).toEqual(["OR"]);
  });
});

describe("groupSalesByDay", () => {
  const now = d(2026, 8, 10, 12);

  it("groups distinct days OLDEST FIRST, by EFFECTIVE time, regardless of the input order", () => {
    const b1 = sale("b1", d(2026, 8, 9, 9));
    const b2 = sale("b2", d(2026, 8, 9, 15));
    const a1 = sale("a1", d(2026, 8, 8, 20));
    const a2 = sale("a2", d(2026, 8, 8, 8));
    const groups = groupSalesByDay([b1, a1, b2, a2], now);
    expect(groups.map((g) => g.sales.map((s) => s.id))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
    expect(groups[0].dayStart.getTime()).toBe(d(2026, 8, 8).getTime());
    expect(groups[1].dayStart.getTime()).toBe(d(2026, 8, 9).getTime());
  });

  it("acceptance criteria 2/8: an offline sale reported yesterday 22:00 but synced today 07:00 groups under YESTERDAY's header, not today's — otherwise the dialog would contradict 'Mis Ventas'", () => {
    const offline = sale("offline", d(2026, 8, 9, 7), d(2026, 8, 8, 22));
    const groups = groupSalesByDay([offline], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].dayStart.getTime()).toBe(d(2026, 8, 8).getTime());
  });

  it("caps grouping at `now`: a frontendCreatedAt still in the future groups by createdAt instead, matching saleEffectiveAt exactly — never a second definition", () => {
    const nowHere = d(2026, 8, 9, 12);
    const advanced = sale("advanced", d(2026, 8, 9, 8), d(2026, 8, 9, 20));
    const groups = groupSalesByDay([advanced], nowHere);
    expect(groups[0].dayStart.getTime()).toBe(
      localMidnight(saleEffectiveAt(advanced, nowHere)).getTime(),
    );
    expect(groups[0].dayStart.getTime()).toBe(d(2026, 8, 9).getTime());
  });

  it("keeps each day's sales in the order RECEIVED, not sorted by time", () => {
    const a1 = sale("a1", d(2026, 8, 8, 20));
    const a2 = sale("a2", d(2026, 8, 8, 8));
    const [group] = groupSalesByDay([a1, a2], now);
    expect(group.sales.map((s) => s.id)).toEqual(["a1", "a2"]);
  });

  it("each group's cutoffAt is exactly dayCutoffAt(dayStart)", () => {
    const [group] = groupSalesByDay([sale("x", d(2026, 8, 8, 10))], now);
    expect(group.cutoffAt.getTime()).toBe(
      dayCutoffAt(group.dayStart).getTime(),
    );
  });

  it("splits at the day boundary: 23:59:59.999 and the next day's 00:00:00.000 are different groups", () => {
    const lastOfDayA = sale("last-a", d(2026, 8, 8, 23, 59, 59, 999));
    const firstOfDayB = sale("first-b", d(2026, 8, 9, 0, 0, 0, 0));
    const groups = groupSalesByDay([lastOfDayA, firstOfDayB], now);
    expect(groups).toHaveLength(2);
    expect(groups[0].sales.map((s) => s.id)).toEqual(["last-a"]);
    expect(groups[1].sales.map((s) => s.id)).toEqual(["first-b"]);
  });

  it("returns an empty array for no sales", () => {
    expect(groupSalesByDay([], now)).toEqual([]);
  });
});

describe("resolveSalesCutoffRequest", () => {
  // The period opened two days before "now" — the exact scenario F-029 exists
  // for: the cashier forgot to close, and today's chip must still resolve to
  // "now" rather than to a not-yet-happened end of day.
  const fechaInicio = d(2026, 8, 6, 9, 0, 0, 0);
  const now = d(2026, 8, 8, 20, 0, 0, 0);
  const period = { fechaInicio };

  it('"clear" resolves to mode "clear"', () => {
    expect(resolveSalesCutoffRequest({ kind: "clear" }, period, now)).toEqual({
      mode: "clear",
    });
  });

  it('"nothing" resolves to fechaInicio plus one step — NEVER fechaInicio itself', () => {
    const result = resolveSalesCutoffRequest({ kind: "nothing" }, period, now);
    expect(result).toEqual({
      mode: "at",
      cutoffAt: new Date(fechaInicio.getTime() + SALES_CUTOFF_STEP_MS),
    });
  });

  it('"day" on an ALREADY-FINISHED day resolves to mode "at" with dayCutoffAt', () => {
    const finishedDay = d(2026, 8, 6); // the period's opening day, already past
    const result = resolveSalesCutoffRequest(
      { kind: "day", dayStart: finishedDay },
      period,
      now,
    );
    expect(result).toEqual({ mode: "at", cutoffAt: dayCutoffAt(finishedDay) });
  });

  it('"day" on the day STILL IN PROGRESS resolves to mode "now" — its end has not happened yet', () => {
    const today = d(2026, 8, 8); // same calendar day as `now`
    const result = resolveSalesCutoffRequest(
      { kind: "day", dayStart: today },
      period,
      now,
    );
    expect(result).toEqual({ mode: "now" });
  });

  it('"sale" resolves to the EFFECTIVE instant carried in the choice — not a raw column re-derived here', () => {
    const touched = d(2026, 8, 7, 15, 30);
    const result = resolveSalesCutoffRequest(
      { kind: "sale", effectiveAt: touched },
      period,
      now,
    );
    expect(result).toEqual({ mode: "at", cutoffAt: touched });
  });

  it("§ 15 — F-029 debt corrected: touching a sale whose EFFECTIVE time precedes fechaInicio still lets it enter, via the clamp (the sale moved to the current period, § 1.2.1)", () => {
    const movedSaleEffectiveAt = new Date(fechaInicio.getTime() - 3_600_000);
    const result = resolveSalesCutoffRequest(
      { kind: "sale", effectiveAt: movedSaleEffectiveAt },
      period,
      now,
    );
    expect(result).toEqual({
      mode: "at",
      cutoffAt: new Date(fechaInicio.getTime() + SALES_CUTOFF_STEP_MS),
    });
  });

  it('a resolved instant LATER than now is clamped to mode "now", never left as an invalid future cutoff', () => {
    const future = new Date(now.getTime() + 60_000);
    const result = resolveSalesCutoffRequest(
      { kind: "sale", effectiveAt: future },
      period,
      now,
    );
    expect(result).toEqual({ mode: "now" });
  });
});

describe('SalesCutoffChoice "sale" variant, combined with the partition it drives', () => {
  const salesOfPeriod = [
    sale("s1", d(2026, 8, 7, 8)),
    sale("s2", d(2026, 8, 7, 14)),
    sale("s3", d(2026, 8, 7, 20)),
  ];
  const period = { fechaInicio: d(2026, 8, 6, 9) };
  const now = d(2026, 8, 8, 20);

  const cutoffOf = (s: Sale) => {
    const effectiveAt = saleEffectiveAt(s, now);
    const target = resolveSalesCutoffRequest(
      { kind: "sale", effectiveAt },
      period,
      now,
    );
    return target.mode === "at" ? target.cutoffAt : null;
  };

  it("touching a sale makes THAT sale enter", () => {
    const { included } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[1]),
      now,
    );
    expect(included.map((s) => s.id)).toContain("s2");
  });

  it("touching the LAST sale of the period defers zero", () => {
    const { deferred } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[2]),
      now,
    );
    expect(deferred).toEqual([]);
  });

  it("touching the FIRST sale leaves only that one inside", () => {
    const { included } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[0]),
      now,
    );
    expect(included.map((s) => s.id)).toEqual(["s1"]);
  });

  it("touching an offline sale whose EFFECTIVE time is earlier than fechaInicio still lets it enter, via the clamp — the real F-030 case of a sale moved to the current period, seeded with frontendCreatedAt", () => {
    const offlineSale = sale(
      "offline",
      d(2026, 8, 8, 9), // synced within the period
      new Date(period.fechaInicio.getTime() - 3_600_000), // reported an hour BEFORE the period opened
    );
    const effectiveAt = saleEffectiveAt(offlineSale, now);
    const target = resolveSalesCutoffRequest(
      { kind: "sale", effectiveAt },
      period,
      now,
    );
    expect(target).toEqual({
      mode: "at",
      cutoffAt: new Date(period.fechaInicio.getTime() + SALES_CUTOFF_STEP_MS),
    });
    const cutoffAt = target.mode === "at" ? target.cutoffAt : null;
    const { included } = partitionSalesByCutoff(
      [offlineSale, ...salesOfPeriod],
      cutoffAt,
      now,
    );
    expect(included.map((s) => s.id)).toContain("offline");
  });
});

describe("isSalesCutoffWithinPeriod", () => {
  const fechaInicio = d(2026, 8, 6, 9, 0, 0, 0);
  const now = d(2026, 8, 8, 20, 0, 0, 0);
  const period = { fechaInicio };

  it("REJECTS a cutoff equal to fechaInicio — the range is strict by below (ADR 0105)", () => {
    expect(isSalesCutoffWithinPeriod(fechaInicio, period, now)).toBe(false);
  });

  it("accepts a cutoff exactly one step after fechaInicio", () => {
    const cutoff = new Date(fechaInicio.getTime() + SALES_CUTOFF_STEP_MS);
    expect(isSalesCutoffWithinPeriod(cutoff, period, now)).toBe(true);
  });

  it("accepts a cutoff EQUAL to now — the range is inclusive by above", () => {
    expect(isSalesCutoffWithinPeriod(now, period, now)).toBe(true);
  });

  it("rejects a cutoff exactly one step after now", () => {
    const cutoff = new Date(now.getTime() + SALES_CUTOFF_STEP_MS);
    expect(isSalesCutoffWithinPeriod(cutoff, period, now)).toBe(false);
  });

  it("rejects a cutoff well before fechaInicio", () => {
    expect(
      isSalesCutoffWithinPeriod(
        new Date(fechaInicio.getTime() - 86_400_000),
        period,
        now,
      ),
    ).toBe(false);
  });

  it("rejects a cutoff well after now", () => {
    expect(
      isSalesCutoffWithinPeriod(
        new Date(now.getTime() + 86_400_000),
        period,
        now,
      ),
    ).toBe(false);
  });
});

describe("buildSalesCutoffListItems", () => {
  const now = d(2026, 8, 10, 20);
  const a1 = sale("a1", d(2026, 8, 8, 8));
  const a2 = sale("a2", d(2026, 8, 8, 10));
  const a3 = sale("a3", d(2026, 8, 8, 20));
  const b1 = sale("b1", d(2026, 8, 9, 9));
  const b2 = sale("b2", d(2026, 8, 9, 15));
  const salesOfPeriod = [a1, a2, a3, b1, b2];

  const describeItem = (item: SalesCutoffListItem<Sale>) => {
    if (item.kind === "day") {
      return { kind: "day" as const, day: item.dayStart.toDateString() };
    }
    if (item.kind === "cut") {
      return { kind: "cut" as const, at: item.cutoffAt.getTime() };
    }
    return { kind: "sale" as const, id: item.sale.id, included: item.included };
  };

  it("with NO cutoff: day headers, every sale included, no cut item anywhere", () => {
    const items = buildSalesCutoffListItems(salesOfPeriod, null, now).map(
      describeItem,
    );
    expect(items).toEqual([
      { kind: "day", day: a1.createdAt.toDateString() },
      { kind: "sale", id: "a1", included: true },
      { kind: "sale", id: "a2", included: true },
      { kind: "sale", id: "a3", included: true },
      { kind: "day", day: b1.createdAt.toDateString() },
      { kind: "sale", id: "b1", included: true },
      { kind: "sale", id: "b2", included: true },
    ]);
  });

  it("cutoff BEFORE the first sale: the cut line sits right after the first day header, everything deferred", () => {
    const cutoffAt = new Date(a1.createdAt.getTime() - 1);
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt, now).map(
      describeItem,
    );
    expect(items).toEqual([
      { kind: "day", day: a1.createdAt.toDateString() },
      { kind: "cut", at: cutoffAt.getTime() },
      { kind: "sale", id: "a1", included: false },
      { kind: "sale", id: "a2", included: false },
      { kind: "sale", id: "a3", included: false },
      { kind: "day", day: b1.createdAt.toDateString() },
      { kind: "sale", id: "b1", included: false },
      { kind: "sale", id: "b2", included: false },
    ]);
  });

  it("cutoff INSIDE a day, between two of its sales: the cut sits between them, day header not repeated", () => {
    const cutoffAt = new Date(a2.createdAt.getTime() + 30 * 60_000);
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt, now).map(
      describeItem,
    );
    expect(items).toEqual([
      { kind: "day", day: a1.createdAt.toDateString() },
      { kind: "sale", id: "a1", included: true },
      { kind: "sale", id: "a2", included: true },
      { kind: "cut", at: cutoffAt.getTime() },
      { kind: "sale", id: "a3", included: false },
      { kind: "day", day: b1.createdAt.toDateString() },
      { kind: "sale", id: "b1", included: false },
      { kind: "sale", id: "b2", included: false },
    ]);
  });

  it("cutoff at the END of a day (the day chip): the cut sits BEFORE the next day's header, never after it", () => {
    const cutoffAt = dayCutoffAt(d(2026, 8, 8));
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt, now).map(
      describeItem,
    );
    expect(items).toEqual([
      { kind: "day", day: a1.createdAt.toDateString() },
      { kind: "sale", id: "a1", included: true },
      { kind: "sale", id: "a2", included: true },
      { kind: "sale", id: "a3", included: true },
      { kind: "cut", at: cutoffAt.getTime() },
      { kind: "day", day: b1.createdAt.toDateString() },
      { kind: "sale", id: "b1", included: false },
      { kind: "sale", id: "b2", included: false },
    ]);
  });

  it("cutoff AFTER the last sale overall: the cut line is the very last item, not before any day header", () => {
    const cutoffAt = new Date(b2.createdAt.getTime() + 60_000);
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt, now);
    expect(items[items.length - 1].kind).toBe("cut");
    expect(items.slice(0, -1).map(describeItem)).toEqual([
      { kind: "day", day: a1.createdAt.toDateString() },
      { kind: "sale", id: "a1", included: true },
      { kind: "sale", id: "a2", included: true },
      { kind: "sale", id: "a3", included: true },
      { kind: "day", day: b1.createdAt.toDateString() },
      { kind: "sale", id: "b1", included: true },
      { kind: "sale", id: "b2", included: true },
    ]);
  });

  it("acceptance criterion 2: an offline sale reported yesterday 22:00 but synced today groups under YESTERDAY and stays included at a cutoff set at the end of yesterday, alongside a same-day sale that stays out", () => {
    const offline = sale("offline", d(2026, 8, 9, 7), d(2026, 8, 8, 22));
    const sameDayLater = sale("same-day-later", d(2026, 8, 8, 23));
    const cutoff = dayCutoffAt(d(2026, 8, 8));
    const items = buildSalesCutoffListItems(
      [sameDayLater, offline],
      cutoff,
      now,
    ).map(describeItem);
    expect(items).toEqual([
      { kind: "day", day: d(2026, 8, 8).toDateString() },
      { kind: "sale", id: "same-day-later", included: true },
      { kind: "sale", id: "offline", included: true },
      { kind: "cut", at: cutoff.getTime() },
    ]);
  });

  it("acceptance criterion 8: the 'included' flag of every item is exactly isSaleIncludedInCutoff for that sale — never a second definition", () => {
    const cutoff = d(2026, 8, 8, 15);
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoff, now);
    for (const item of items) {
      if (item.kind !== "sale") continue;
      expect(item.included).toBe(
        isSaleIncludedInCutoff(item.sale, cutoff, now),
      );
    }
  });
});
