import { describe, expect, it } from "vitest";
import {
  isSaleIncludedInCutoff,
  partitionSalesByCutoff,
  deferredSalesCreatedAtFilter,
  dayCutoffAt,
  groupSalesByDay,
  resolveSalesCutoffRequest,
  isSalesCutoffWithinPeriod,
  buildSalesCutoffListItems,
  type SalesCutoffListItem,
} from "@/lib/cierre/salesCutoff";
import { SALES_CUTOFF_STEP_MS } from "@/constants/cierre";
import { startOfNextDay } from "@/utils/date";

/**
 * F-029 — contract § 2, § 12 (ADR 0104/0105).
 *
 * `src/lib/cierre/salesCutoff.ts` is THE definition of what a close takes: a
 * sale enters when `createdAt <= cutoffAt`. Everything else in this suite
 * (partitioning, the SQL filter, day grouping, the list the dialog renders)
 * is derived from that one rule and must never restate it with a different
 * boundary (E-014, E-039).
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

type Sale = { id: string; createdAt: Date };
const sale = (id: string, createdAt: Date): Sale => ({ id, createdAt });

describe("SALES_CUTOFF_STEP_MS", () => {
  it("is exactly 1 millisecond — the smallest instant timestamp(3) can distinguish, not an approximation", () => {
    expect(SALES_CUTOFF_STEP_MS).toBe(1);
  });
});

describe("isSaleIncludedInCutoff", () => {
  it("a NULL cutoff includes everything — the behaviour before this column existed", () => {
    expect(isSaleIncludedInCutoff(d(2026, 8, 8, 10), null)).toBe(true);
    expect(isSaleIncludedInCutoff(d(1999, 0, 1), null)).toBe(true);
  });

  it("includes a sale strictly before the cutoff", () => {
    const cutoff = d(2026, 8, 8, 12, 0, 0, 0);
    expect(isSaleIncludedInCutoff(d(2026, 8, 8, 11, 59, 59, 999), cutoff)).toBe(
      true,
    );
  });

  it("INCLUDES a sale sealed at the exact same millisecond as the cutoff — the boundary is inclusive by below", () => {
    const cutoff = d(2026, 8, 8, 12, 0, 0, 0);
    const sameInstant = new Date(cutoff.getTime());
    expect(isSaleIncludedInCutoff(sameInstant, cutoff)).toBe(true);
  });

  it("excludes a sale exactly one millisecond after the cutoff", () => {
    const cutoff = d(2026, 8, 8, 12, 0, 0, 0);
    const oneMsLater = new Date(cutoff.getTime() + SALES_CUTOFF_STEP_MS);
    expect(isSaleIncludedInCutoff(oneMsLater, cutoff)).toBe(false);
  });
});

describe("deferredSalesCreatedAtFilter", () => {
  it("returns exactly { gt: cutoffAt } — the only SQL rendering of the rule", () => {
    const cutoff = d(2026, 8, 8, 12);
    expect(deferredSalesCreatedAtFilter(cutoff)).toEqual({ gt: cutoff });
  });

  it("is the EXACT complement of isSaleIncludedInCutoff at the millisecond boundary", () => {
    const cutoff = d(2026, 8, 8, 12, 0, 0, 0);
    const { gt } = deferredSalesCreatedAtFilter(cutoff);
    const samples = [
      new Date(cutoff.getTime() - SALES_CUTOFF_STEP_MS),
      new Date(cutoff.getTime()),
      new Date(cutoff.getTime() + SALES_CUTOFF_STEP_MS),
    ];
    for (const createdAt of samples) {
      const isDeferredBySqlFilter = createdAt.getTime() > gt.getTime();
      expect(isDeferredBySqlFilter).toBe(
        !isSaleIncludedInCutoff(createdAt, cutoff),
      );
    }
  });
});

describe("partitionSalesByCutoff", () => {
  it("a NULL cutoff includes everything and defers nothing, preserving order", () => {
    const sales = [
      sale("c", d(2026, 8, 8, 20)),
      sale("a", d(2026, 8, 8, 8)),
      sale("b", d(2026, 8, 8, 14)),
    ];
    const { included, deferred } = partitionSalesByCutoff(sales, null);
    expect(included.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(deferred).toEqual([]);
  });

  it("splits at the cutoff, INCLUDING the sale sealed at the exact same millisecond", () => {
    const cutoff = d(2026, 8, 8, 12, 0, 0, 0);
    const before = sale("before", d(2026, 8, 8, 8));
    const atCutoff = sale("at-cutoff", new Date(cutoff.getTime()));
    const after = sale(
      "after",
      new Date(cutoff.getTime() + SALES_CUTOFF_STEP_MS),
    );
    const { included, deferred } = partitionSalesByCutoff(
      [before, atCutoff, after],
      cutoff,
    );
    expect(included.map((s) => s.id)).toEqual(["before", "at-cutoff"]);
    expect(deferred.map((s) => s.id)).toEqual(["after"]);
  });

  it("preserves the order it RECEIVED on both sides — it never sorts by date", () => {
    const cutoff = d(2026, 8, 8, 12);
    const sales = [
      sale("i2", d(2026, 8, 8, 10)),
      sale("d2", d(2026, 8, 8, 18)),
      sale("i1", d(2026, 8, 8, 6)),
      sale("d1", d(2026, 8, 8, 16)),
    ];
    const { included, deferred } = partitionSalesByCutoff(sales, cutoff);
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

describe("groupSalesByDay", () => {
  it("groups distinct days OLDEST FIRST, regardless of the input order", () => {
    const b1 = sale("b1", d(2026, 8, 9, 9));
    const b2 = sale("b2", d(2026, 8, 9, 15));
    const a1 = sale("a1", d(2026, 8, 8, 20));
    const a2 = sale("a2", d(2026, 8, 8, 8));
    // Fed out of chronological order AND out of day order on purpose.
    const groups = groupSalesByDay([b1, a1, b2, a2]);
    expect(groups.map((g) => g.sales.map((s) => s.id))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
    expect(groups[0].dayStart.getTime()).toBe(d(2026, 8, 8).getTime());
    expect(groups[1].dayStart.getTime()).toBe(d(2026, 8, 9).getTime());
  });

  it("keeps each day's sales in the order RECEIVED, not sorted by time", () => {
    // a1 arrives before a2 in the array even though a2 happened earlier.
    const a1 = sale("a1", d(2026, 8, 8, 20));
    const a2 = sale("a2", d(2026, 8, 8, 8));
    const [group] = groupSalesByDay([a1, a2]);
    expect(group.sales.map((s) => s.id)).toEqual(["a1", "a2"]);
  });

  it("each group's cutoffAt is exactly dayCutoffAt(dayStart)", () => {
    const [group] = groupSalesByDay([sale("x", d(2026, 8, 8, 10))]);
    expect(group.cutoffAt.getTime()).toBe(
      dayCutoffAt(group.dayStart).getTime(),
    );
  });

  it("splits at the day boundary: 23:59:59.999 and the next day's 00:00:00.000 are different groups", () => {
    const lastOfDayA = sale("last-a", d(2026, 8, 8, 23, 59, 59, 999));
    const firstOfDayB = sale("first-b", d(2026, 8, 9, 0, 0, 0, 0));
    const groups = groupSalesByDay([lastOfDayA, firstOfDayB]);
    expect(groups).toHaveLength(2);
    expect(groups[0].sales.map((s) => s.id)).toEqual(["last-a"]);
    expect(groups[1].sales.map((s) => s.id)).toEqual(["first-b"]);
  });

  it("returns an empty array for no sales", () => {
    expect(groupSalesByDay([])).toEqual([]);
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

  it('"nothing" resolves to fechaInicio plus one step — NEVER fechaInicio itself (§ 7.3)', () => {
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

  it('"sale" resolves to that sale\'s own createdAt — the inclusive boundary puts it inside the close', () => {
    const touched = d(2026, 8, 7, 15, 30);
    const result = resolveSalesCutoffRequest(
      { kind: "sale", createdAt: touched },
      period,
      now,
    );
    expect(result).toEqual({ mode: "at", cutoffAt: touched });
  });

  it("an OFFLINE sale's createdAt before fechaInicio is clamped UP to fechaInicio + one step, never left invalid", () => {
    const offlineCreatedAt = new Date(fechaInicio.getTime() - 60_000);
    const result = resolveSalesCutoffRequest(
      { kind: "sale", createdAt: offlineCreatedAt },
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
      { kind: "sale", createdAt: future },
      period,
      now,
    );
    expect(result).toEqual({ mode: "now" });
  });
});

describe('SalesCutoffChoice "sale" variant, combined with the partition it drives (design contract, § 2.0.1)', () => {
  const salesOfPeriod = [
    sale("s1", d(2026, 8, 7, 8)),
    sale("s2", d(2026, 8, 7, 14)),
    sale("s3", d(2026, 8, 7, 20)),
  ];
  const period = { fechaInicio: d(2026, 8, 6, 9) };
  const now = d(2026, 8, 8, 20);

  const cutoffOf = (createdAt: Date) => {
    const target = resolveSalesCutoffRequest(
      { kind: "sale", createdAt },
      period,
      now,
    );
    return target.mode === "at" ? target.cutoffAt : null;
  };

  it("touching a sale makes THAT sale enter", () => {
    const { included } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[1].createdAt),
    );
    expect(included.map((s) => s.id)).toContain("s2");
  });

  it("touching the LAST sale of the period defers zero", () => {
    const { deferred } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[2].createdAt),
    );
    expect(deferred).toEqual([]);
  });

  it("touching the FIRST sale leaves only that one inside", () => {
    const { included } = partitionSalesByCutoff(
      salesOfPeriod,
      cutoffOf(salesOfPeriod[0].createdAt),
    );
    expect(included.map((s) => s.id)).toEqual(["s1"]);
  });

  it("touching an offline sale earlier than fechaInicio still lets it enter, via the clamp", () => {
    const offlineSale = sale(
      "offline",
      new Date(period.fechaInicio.getTime() - 3_600_000),
    );
    const target = resolveSalesCutoffRequest(
      { kind: "sale", createdAt: offlineSale.createdAt },
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
    );
    expect(included.map((s) => s.id)).toContain("offline");
  });
});

describe("isSalesCutoffWithinPeriod", () => {
  const fechaInicio = d(2026, 8, 6, 9, 0, 0, 0);
  const now = d(2026, 8, 8, 20, 0, 0, 0);
  const period = { fechaInicio };

  it("REJECTS a cutoff equal to fechaInicio — the range is strict by below (§ 7.3, ADR 0105)", () => {
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
    const items = buildSalesCutoffListItems(salesOfPeriod, null).map(
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
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt).map(
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
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt).map(
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
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt).map(
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
    const items = buildSalesCutoffListItems(salesOfPeriod, cutoffAt);
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
});
