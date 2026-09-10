import { describe, expect, it } from "vitest";
import {
  compareSalesByReportedAtDesc,
  type SaleOrderKey,
} from "@/lib/venta/saleOrder";

/**
 * F-032 — contract § "Firmas públicas" > 1, `src/lib/venta/saleOrder.ts`
 * (ADR 0111). `compareSalesByReportedAtDesc` is THE only thing that decides
 * the order of `/ventas`: newest reported instant first, ties broken by id
 * ascending.
 *
 * It is built ON TOP OF saleReportedAt (never re-expressing
 * `frontendCreatedAt ?? createdAt`), which is exactly the mechanism that
 * keeps a null-frontendCreatedAt sale interleaved instead of grouped at
 * either end of the list (acceptance criterion 9). This suite never asserts
 * against saleReportedAt's own output — its contract is already covered in
 * saleTime.test.ts — it only checks the ORDER compareSalesByReportedAtDesc
 * produces.
 *
 * Local Date constructors only, never ISO strings ending in "Z": ordering
 * cares about exact instants, and a string literal would tie the suite to
 * the runner's own timezone offset (same convention as saleTime.test.ts).
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

const key = (
  id: string,
  createdAt: Date,
  frontendCreatedAt: Date | null,
): SaleOrderKey => ({ id, createdAt, frontendCreatedAt });

/** Sorts a COPY, never mutates the fixture array a test built. */
const sortedIds = (sales: SaleOrderKey[]): string[] =>
  [...sales].sort(compareSalesByReportedAtDesc).map((s) => s.id);

describe("compareSalesByReportedAtDesc", () => {
  it("orders the most recently REPORTED sale first, with frontendCreatedAt present on both", () => {
    const older = key("s-older", d(2026, 8, 9, 6), d(2026, 8, 9, 6));
    const newer = key("s-newer", d(2026, 8, 9, 10), d(2026, 8, 9, 10));

    expect(compareSalesByReportedAtDesc(newer, older)).toBeLessThan(0);
    expect(compareSalesByReportedAtDesc(older, newer)).toBeGreaterThan(0);
    expect(sortedIds([older, newer])).toEqual(["s-newer", "s-older"]);
  });

  it("acceptance criterion 1 / the design's V-TRAZA: a sale reported yesterday 22:00 and synced today 07:00 sorts BELOW an ordinary sale reported today at 06:30 — the opposite of what createdAt-order shows today", () => {
    const vTraza = key(
      "v-traza",
      d(2026, 8, 9, 7), // createdAt: today 07:00 (server arrival)
      d(2026, 8, 8, 22), // frontendCreatedAt: yesterday 22:00 (device)
    );
    const vNormal = key(
      "v-normal",
      d(2026, 8, 9, 6, 30, 4), // createdAt a few seconds after the device stamp
      d(2026, 8, 9, 6, 30), // frontendCreatedAt: today 06:30
    );

    expect(sortedIds([vTraza, vNormal])).toEqual(["v-normal", "v-traza"]);
    expect(compareSalesByReportedAtDesc(vNormal, vTraza)).toBeLessThan(0);
  });

  it("acceptance criterion 9: sales without frontendCreatedAt are INTERLEAVED by their createdAt among sales that do have the column, never bunched at either end", () => {
    // Reported instants, descending: 10:00(hasFc) > 09:00(noFc) > 08:00(hasFc)
    // > 07:00(noFc) > 06:00(hasFc) — a null column falls BETWEEN two sales
    // that have it, on both sides, so a grouping bug is visible either way.
    const hasFc10 = key("has-10", d(2026, 8, 9, 10), d(2026, 8, 9, 10));
    const noFc09 = key("no-09", d(2026, 8, 9, 9), null);
    const hasFc08 = key("has-08", d(2026, 8, 9, 8), d(2026, 8, 9, 8));
    const noFc07 = key("no-07", d(2026, 8, 9, 7), null);
    const hasFc06 = key("has-06", d(2026, 8, 9, 6), d(2026, 8, 9, 6));

    // Fed in an order that does not already match the expected result, so a
    // comparator that merely preserves input order would not pass by luck.
    const input = [noFc07, hasFc10, hasFc06, noFc09, hasFc08];

    expect(sortedIds(input)).toEqual([
      "has-10",
      "no-09",
      "has-08",
      "no-07",
      "has-06",
    ]);
  });

  it("breaks an exact tie of reported instant by id ascending, and gives the IDENTICAL result from two differently shuffled inputs — proof of a total order, not just a stable sort riding on input order", () => {
    const tieA = key("a-tie", d(2026, 8, 9, 6, 34), null);
    const tieB = key("b-tie", d(2026, 8, 9, 6, 34), null); // same reported instant as tieA

    expect(compareSalesByReportedAtDesc(tieA, tieB)).toBe(-1);
    expect(compareSalesByReportedAtDesc(tieB, tieA)).toBe(1);

    const other1 = key("z-other", d(2026, 8, 9, 8), null);
    const other2 = key("m-other", d(2026, 8, 9, 5), null);
    const expected = ["z-other", "a-tie", "b-tie", "m-other"];

    const shuffleOne = [tieB, other1, tieA, other2];
    const shuffleTwo = [other2, tieA, other1, tieB];

    expect(sortedIds(shuffleOne)).toEqual(expected);
    expect(sortedIds(shuffleTwo)).toEqual(expected);
  });

  it("breaks a tie between a sale that carries frontendCreatedAt and one that doesn't, when their reported instants coincide — id decides, with no preference for having the column", () => {
    const withoutFc = key("a-without-fc", d(2026, 8, 9, 6), null); // reportedAt falls back to createdAt = 06:00
    const withFc = key("b-with-fc", d(2026, 8, 9, 11), d(2026, 8, 9, 6)); // reportedAt = frontendCreatedAt = 06:00, same instant

    expect(compareSalesByReportedAtDesc(withoutFc, withFc)).toBe(-1);
    expect(compareSalesByReportedAtDesc(withFc, withoutFc)).toBe(1);
    expect(sortedIds([withFc, withoutFc])).toEqual([
      "a-without-fc",
      "b-with-fc",
    ]);
  });

  it("returns 0 when comparing the same row to itself", () => {
    const sale = key("self", d(2026, 8, 9, 12), d(2026, 8, 9, 12));
    expect(compareSalesByReportedAtDesc(sale, sale)).toBe(0);
  });

  it('does NOT use localeCompare for the id tie-break: plain code-unit order, where "id-10" sorts BEFORE "id-9" (a numeric-aware collation would do the opposite)', () => {
    const idTen = key("id-10", d(2026, 8, 9, 6), null);
    const idNine = key("id-9", d(2026, 8, 9, 6), null); // same reported instant as idTen

    expect(compareSalesByReportedAtDesc(idTen, idNine)).toBe(-1);
    expect(sortedIds([idNine, idTen])).toEqual(["id-10", "id-9"]);
  });
});
