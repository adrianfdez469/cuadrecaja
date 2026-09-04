import { describe, it, expect } from "vitest";
import {
  buildTasaSnapshotWithMeta,
  buildTasaSnapshotAt,
  completeTasaSnapshot,
  missingRateCodes,
  convertToBase,
} from "@/lib/currency";

const d = (iso: string) => new Date(iso);

// Ascending history of a USD-based business: USD and EUR registered daily.
const history = [
  { monedaCode: "USD", tasa: 615, createdAt: d("2026-06-06T04:49:32Z") },
  { monedaCode: "EUR", tasa: 700, createdAt: d("2026-06-06T04:50:20Z") },
  { monedaCode: "USD", tasa: 625, createdAt: d("2026-06-08T16:47:49Z") },
  { monedaCode: "EUR", tasa: 710, createdAt: d("2026-06-08T16:51:24Z") },
  { monedaCode: "CUP", tasa: 1, createdAt: d("2026-06-08T17:00:00Z") },
];

describe("buildTasaSnapshotWithMeta — the base currency is kept", () => {
  it("includes monedaBase (USD) alongside the other rates", () => {
    const { vigentes } = buildTasaSnapshotWithMeta(history);
    expect(vigentes).toEqual({ USD: 625, EUR: 710 });
  });

  it("never includes CUP and drops non-positive rates", () => {
    const { vigentes } = buildTasaSnapshotWithMeta([
      ...history,
      { monedaCode: "MLC", tasa: 0, createdAt: d("2026-06-09T00:00:00Z") },
    ]);
    expect(vigentes).not.toHaveProperty("CUP");
    expect(vigentes).not.toHaveProperty("MLC");
  });

  it("reports the most recent createdAt among included rates", () => {
    const { actualizadoEn } = buildTasaSnapshotWithMeta(history);
    expect(actualizadoEn).toBe("2026-06-08T16:51:24.000Z");
  });

  it("regression: a USD-based sale paid in CUP no longer converts at rate 1", () => {
    const { vigentes } = buildTasaSnapshotWithMeta(history);
    // 625 CUP must be exactly 1 USD; without the base rate this returned 625.
    expect(convertToBase(625, "CUP", vigentes, "USD")).toBeCloseTo(1, 10);
  });
});

describe("buildTasaSnapshotAt", () => {
  it("returns the rates in force at the given moment", () => {
    expect(buildTasaSnapshotAt(history, d("2026-06-07T12:00:00Z"))).toEqual({
      USD: 615,
      EUR: 700,
    });
  });

  it("includes a rate registered exactly at the moment", () => {
    expect(buildTasaSnapshotAt(history, d("2026-06-08T16:47:49Z")).USD).toBe(
      625,
    );
  });

  it("is empty before the first rate and never includes CUP", () => {
    expect(buildTasaSnapshotAt(history, d("2026-06-01T00:00:00Z"))).toEqual({});
    expect(
      buildTasaSnapshotAt(history, d("2026-07-01T00:00:00Z")),
    ).not.toHaveProperty("CUP");
  });
});

describe("completeTasaSnapshot", () => {
  it("fills only the missing monedas — client rates always win", () => {
    const result = completeTasaSnapshot(
      { EUR: 775 },
      { EUR: 700, USD: 680 },
      { EUR: 600, USD: 600, MLC: 300 },
    );
    expect(result).toEqual({ EUR: 775, USD: 680, MLC: 300 });
  });

  it("treats a null/undefined client snapshot as empty", () => {
    expect(completeTasaSnapshot(null, { USD: 680 })).toEqual({ USD: 680 });
    expect(completeTasaSnapshot(undefined, { USD: 680 })).toEqual({ USD: 680 });
  });

  it("ignores CUP and non-positive rates from any layer", () => {
    expect(
      completeTasaSnapshot({ CUP: 1, USD: 0 }, { USD: 680, EUR: -1 }),
    ).toEqual({ USD: 680 });
  });

  it("does not mutate its inputs", () => {
    const client = { EUR: 775 };
    const fallback = { USD: 680 };
    completeTasaSnapshot(client, fallback);
    expect(client).toEqual({ EUR: 775 });
    expect(fallback).toEqual({ USD: 680 });
  });
});

describe("missingRateCodes", () => {
  it("needs nothing when the sale is settled entirely in monedaBase", () => {
    expect(missingRateCodes({}, "USD", ["USD", "USD"])).toEqual([]);
    expect(missingRateCodes({}, "CUP", ["CUP"])).toEqual([]);
  });

  it("requires the base's own rate when a foreign moneda is involved (base ≠ CUP)", () => {
    expect(missingRateCodes({ EUR: 775 }, "USD", ["EUR"])).toEqual(["USD"]);
    expect(missingRateCodes({ EUR: 775 }, "USD", ["CUP"])).toEqual(["USD"]);
  });

  it("does not require a rate for CUP, only for the base", () => {
    expect(missingRateCodes({ USD: 680 }, "USD", ["CUP", "USD"])).toEqual([]);
  });

  it("with base CUP only the foreign monedas need a rate", () => {
    expect(missingRateCodes({}, "CUP", ["USD", "EUR"])).toEqual(["USD", "EUR"]);
    expect(
      missingRateCodes({ USD: 680, EUR: 775 }, "CUP", ["USD", "EUR"]),
    ).toEqual([]);
  });

  it("lists every missing moneda once, base first", () => {
    expect(missingRateCodes({}, "USD", ["EUR", "EUR", "MLC"])).toEqual([
      "USD",
      "EUR",
      "MLC",
    ]);
  });

  it("treats a non-positive rate as missing", () => {
    expect(missingRateCodes({ USD: 0, EUR: 775 }, "USD", ["EUR"])).toEqual([
      "USD",
    ]);
  });
});
