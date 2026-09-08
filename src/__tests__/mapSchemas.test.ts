import { describe, it, expect } from "vitest";
import { mapPointSchema, mapViewSchema } from "@/schemas/map";
import {
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
  MAP_DEFAULT_VIEW,
} from "@/constants/map";

/**
 * F-025 — `src/schemas/map.ts` (contract § 3.2).
 *
 * Written against the interface contract, without the implementation. `IMapPoint` and `IMapView`
 * are deliberately incompatible shapes (ADR 0098): `mapViewSchema` must NOT accept a point, and
 * `MAP_DEFAULT_VIEW` — the actual constant, not a hand-typed literal — must satisfy `mapViewSchema`.
 * This is the runtime half of the criterion 5 boundary; the compile-time half is that
 * `applyMapPointToDraft` only accepts `IMapPoint`, which `tsc --noEmit` verifies, not this suite.
 */

describe("mapPointSchema (src/schemas/map.ts)", () => {
  it("should accept all four range limits inclusive", () => {
    expect(mapPointSchema.safeParse({ lat: LATITUDE_MIN, lon: 0 }).success).toBe(true);
    expect(mapPointSchema.safeParse({ lat: LATITUDE_MAX, lon: 0 }).success).toBe(true);
    expect(mapPointSchema.safeParse({ lat: 0, lon: LONGITUDE_MIN }).success).toBe(true);
    expect(mapPointSchema.safeParse({ lat: 0, lon: LONGITUDE_MAX }).success).toBe(true);
  });

  it("should reject a latitude or longitude just outside each of the four limits", () => {
    expect(mapPointSchema.safeParse({ lat: LATITUDE_MIN - 0.0001, lon: 0 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: LATITUDE_MAX + 0.0001, lon: 0 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: 0, lon: LONGITUDE_MIN - 0.0001 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: 0, lon: LONGITUDE_MAX + 0.0001 }).success).toBe(false);
  });

  it("should reject NaN and Infinity for either coordinate", () => {
    expect(mapPointSchema.safeParse({ lat: NaN, lon: 0 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: 0, lon: NaN }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: Infinity, lon: 0 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lat: 0, lon: -Infinity }).success).toBe(false);
  });

  it("should reject extra keys — .strict()", () => {
    expect(
      mapPointSchema.safeParse({ lat: 10, lon: 10, elevation: 5 }).success,
    ).toBe(false);
  });

  it("should reject a point missing a coordinate", () => {
    expect(mapPointSchema.safeParse({ lat: 10 }).success).toBe(false);
    expect(mapPointSchema.safeParse({ lon: 10 }).success).toBe(false);
  });
});

describe("mapViewSchema (src/schemas/map.ts) — the ADR 0098 type boundary", () => {
  it("should NOT accept an IMapPoint shape ({ lat, lon })", () => {
    expect(mapViewSchema.safeParse({ lat: 10, lon: 10 }).success).toBe(false);
  });

  it("should accept the real MAP_DEFAULT_VIEW constant", () => {
    // Imported from the contract's own constant, never hand-typed here — a hand-typed
    // { centerLat: 21.55, ... } would tautologically match a schema shaped after itself.
    expect(mapViewSchema.safeParse(MAP_DEFAULT_VIEW).success).toBe(true);
  });

  it("should require an integer zoom and keep both centers inside the coordinate bounds", () => {
    expect(
      mapViewSchema.safeParse({ centerLat: 0, centerLon: 0, zoom: 5.5 }).success,
    ).toBe(false);
    expect(
      mapViewSchema.safeParse({ centerLat: LATITUDE_MAX + 1, centerLon: 0, zoom: 5 }).success,
    ).toBe(false);
    expect(
      mapViewSchema.safeParse({ centerLat: 0, centerLon: LONGITUDE_MIN - 1, zoom: 5 }).success,
    ).toBe(false);
  });

  it("should reject extra keys — .strict()", () => {
    expect(
      mapViewSchema.safeParse({ centerLat: 0, centerLon: 0, zoom: 5, lat: 0 }).success,
    ).toBe(false);
  });
});
