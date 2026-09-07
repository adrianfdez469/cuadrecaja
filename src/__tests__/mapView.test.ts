import { describe, it, expect } from "vitest";
import { initialMapView, isPointOutsideBounds } from "@/components/tiendaOnline/map/mapView";
import { MAP_DEFAULT_VIEW, MAP_POINT_ZOOM } from "@/constants/map";
import type { IMapPoint, IMapBounds } from "@/schemas/map";

/**
 * F-025 — `src/components/tiendaOnline/map/mapView.ts` (contract § 3.4).
 *
 * A plain `.ts`, importable from a test without touching Leaflet or React (E-015). Written
 * against the contract, without the implementation.
 */

describe("initialMapView (map/mapView.ts)", () => {
  it("should return MAP_DEFAULT_VIEW itself for null — by equality with the constant, never a hand-typed center", () => {
    expect(initialMapView(null)).toEqual(MAP_DEFAULT_VIEW);
  });

  it("should return the point's coordinates as the center, at MAP_POINT_ZOOM, for a non-null point", () => {
    const point: IMapPoint = { lat: 23.113, lon: -82.366 };
    const view = initialMapView(point);
    expect(view.centerLat).toBe(point.lat);
    expect(view.centerLon).toBe(point.lon);
    expect(view.zoom).toBe(MAP_POINT_ZOOM);
  });

  it("should never return a view with lat/lon keys, only centerLat/centerLon/zoom", () => {
    const view = initialMapView({ lat: 10, lon: 10 });
    expect(view).not.toHaveProperty("lat");
    expect(view).not.toHaveProperty("lon");
  });
});

describe("isPointOutsideBounds (map/mapView.ts)", () => {
  const bounds: IMapBounds = { south: 10, west: 10, north: 20, east: 20 };

  it("should return false for a point clearly inside the bounds", () => {
    expect(isPointOutsideBounds({ lat: 15, lon: 15 }, bounds)).toBe(false);
  });

  it("should return true for a point outside on each of the four sides", () => {
    expect(isPointOutsideBounds({ lat: 9, lon: 15 }, bounds)).toBe(true); // south of
    expect(isPointOutsideBounds({ lat: 21, lon: 15 }, bounds)).toBe(true); // north of
    expect(isPointOutsideBounds({ lat: 15, lon: 9 }, bounds)).toBe(true); // west of
    expect(isPointOutsideBounds({ lat: 15, lon: 21 }, bounds)).toBe(true); // east of
  });

  it("should treat a point exactly on each of the four edges as INSIDE", () => {
    expect(isPointOutsideBounds({ lat: bounds.south, lon: 15 }, bounds)).toBe(false);
    expect(isPointOutsideBounds({ lat: bounds.north, lon: 15 }, bounds)).toBe(false);
    expect(isPointOutsideBounds({ lat: 15, lon: bounds.west }, bounds)).toBe(false);
    expect(isPointOutsideBounds({ lat: 15, lon: bounds.east }, bounds)).toBe(false);
  });

  it("should return true for a point outside on two sides at once (a corner)", () => {
    expect(isPointOutsideBounds({ lat: 9, lon: 9 }, bounds)).toBe(true);
  });
});
