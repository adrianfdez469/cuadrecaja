import { describe, it, expect } from "vitest";
import {
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
  MAP_TILE_HOST,
  OSMF_TILE_PROVIDER,
  resolveTileProvider,
  MAP_DEFAULT_VIEW,
  MAP_HEIGHT,
  MAP_ROOT_CLASS,
  MAP_MARKER_CLASS,
  MAP_MARKER_ICON_SIZE,
  MAP_MARKER_DOT_SIZE,
  MAP_ATTRIBUTION_BAR_HEIGHT,
} from "@/constants/map";
import { touch } from "@/theme/tokens";

/**
 * F-025 — `src/constants/map.ts` (contract § 3.1 and § 3.1.b).
 *
 * Written against the interface contract in `.agents/specs/F-025.md`, WITHOUT reading the
 * implementation — the implementer runs in parallel. Every red case here is expected until the
 * implementer writes this module (E-019 does not apply: nothing here runs `it.each` on a
 * possibly-undefined symbol, and each `it` fails independently).
 *
 * The contract § 7.1 forbids fixing the center, the zooms, the heights and the marker sizes as
 * bare numbers in this suite — even though the design contract (`.agents/designs/F-025.md`) fixed
 * their real values after step 4b, and even though that prohibition text was rewritten (not left
 * stale) specifically because a previous version said those values "podían moverse en el paso 4b"
 * and 4b has already happened (E-018). So this file checks SHAPE and RELATIONS for those, and
 * checks EXACT values only for what the contract explicitly allows as ours to pin (geographic
 * bounds, the OSMF provider literal, class name distinctness).
 */

describe("coordinate bounds (src/constants/map.ts)", () => {
  it("should fix the four geographic bounds — the single definition every schema imports", () => {
    expect(LATITUDE_MIN).toBe(-90);
    expect(LATITUDE_MAX).toBe(90);
    expect(LONGITUDE_MIN).toBe(-180);
    expect(LONGITUDE_MAX).toBe(180);
  });
});

describe("MAP_DEFAULT_VIEW (src/constants/map.ts)", () => {
  it("should have EXACTLY the keys centerLat, centerLon and zoom — never lat/lon", () => {
    // This is the test that catches whoever "simplifies" the default view into an IMapPoint
    // shape and reopens the door the criterion 5 / ADR 0098 boundary closes (contract § 7.1).
    const keys = Object.keys(MAP_DEFAULT_VIEW).sort();
    expect(keys).toEqual(["centerLat", "centerLon", "zoom"].sort());
    expect(MAP_DEFAULT_VIEW).not.toHaveProperty("lat");
    expect(MAP_DEFAULT_VIEW).not.toHaveProperty("lon");
  });

  it("should keep its three numbers inside the four geographic bounds and zoom as an integer", () => {
    // Relations only — never the literal center/zoom the ui-designer picked (contract § 7.1).
    expect(MAP_DEFAULT_VIEW.centerLat).toBeGreaterThanOrEqual(LATITUDE_MIN);
    expect(MAP_DEFAULT_VIEW.centerLat).toBeLessThanOrEqual(LATITUDE_MAX);
    expect(MAP_DEFAULT_VIEW.centerLon).toBeGreaterThanOrEqual(LONGITUDE_MIN);
    expect(MAP_DEFAULT_VIEW.centerLon).toBeLessThanOrEqual(LONGITUDE_MAX);
    expect(Number.isInteger(MAP_DEFAULT_VIEW.zoom)).toBe(true);
  });
});

describe("OSMF_TILE_PROVIDER (src/constants/map.ts)", () => {
  it("should point at the OSMF host over HTTPS, with no query string and no {s} subdomain pattern", () => {
    expect(OSMF_TILE_PROVIDER.urlTemplate.startsWith(`https://${MAP_TILE_HOST}`)).toBe(true);
    expect(OSMF_TILE_PROVIDER.urlTemplate).not.toContain("?");
    expect(OSMF_TILE_PROVIDER.urlTemplate).not.toContain("{s}");
  });

  it("should carry a visible OpenStreetMap attribution that opens in a new tab", () => {
    expect(OSMF_TILE_PROVIDER.attributionHtml).toContain("openstreetmap.org/copyright");
    expect(OSMF_TILE_PROVIDER.attributionHtml).toContain("OpenStreetMap");
    expect(OSMF_TILE_PROVIDER.attributionHtml).toContain('target="_blank"');
  });
});

describe("resolveTileProvider (src/constants/map.ts) — the licence guard", () => {
  it("should return OSMF_TILE_PROVIDER whole when both substitution values are undefined", () => {
    expect(resolveTileProvider(undefined, undefined)).toEqual(OSMF_TILE_PROVIDER);
  });

  it("should return the override pair, whole, when BOTH substitution values are set and non-blank", () => {
    const override = resolveTileProvider(
      "https://example-tiles.test/{z}/{x}/{y}.png",
      "&copy; Example Tiles contributors",
    );
    expect(override).toEqual({
      urlTemplate: "https://example-tiles.test/{z}/{x}/{y}.png",
      attributionHtml: "&copy; Example Tiles contributors",
    });
  });

  // The guard against a licence breach: serving one provider's tiles under another's credit.
  // Each of these is a deployment slip that must fall back to the OSMF pair WHOLE, never a mix.
  const halfConfigured: Array<[string, string | undefined, string | undefined]> = [
    ["URL only, no attribution (undefined)", "https://example-tiles.test/{z}/{x}/{y}.png", undefined],
    ["attribution only, no URL (undefined)", undefined, "&copy; Example Tiles contributors"],
    ["URL only, attribution is empty string", "https://example-tiles.test/{z}/{x}/{y}.png", ""],
    ["attribution only, URL is empty string", "", "&copy; Example Tiles contributors"],
    [
      "URL only, attribution is whitespace only",
      "https://example-tiles.test/{z}/{x}/{y}.png",
      "   ",
    ],
    ["attribution only, URL is whitespace only", "   ", "&copy; Example Tiles contributors"],
  ];

  it.each(halfConfigured)(
    "should return OSMF_TILE_PROVIDER WHOLE, never a mix, when only one substitution value is usable: %s",
    (_label, urlTemplate, attributionHtml) => {
      const result = resolveTileProvider(urlTemplate, attributionHtml);
      expect(result).toEqual(OSMF_TILE_PROVIDER);
      // Explicit per-field check so a mixed object (e.g. the injected URL with the OSMF
      // attribution) cannot slip past a shallow `toEqual` on a differently-shaped mock.
      expect(result.urlTemplate).toBe(OSMF_TILE_PROVIDER.urlTemplate);
      expect(result.attributionHtml).toBe(OSMF_TILE_PROVIDER.attributionHtml);
    },
  );

  it("should return OSMF_TILE_PROVIDER whole when both values are blank strings", () => {
    expect(resolveTileProvider("", "")).toEqual(OSMF_TILE_PROVIDER);
    expect(resolveTileProvider("   ", "   ")).toEqual(OSMF_TILE_PROVIDER);
  });
});

describe("MAP_HEIGHT (src/constants/map.ts) — design symbol added after step 4b", () => {
  it("should have EXACTLY the breakpoint keys xs, sm and md", () => {
    expect(Object.keys(MAP_HEIGHT).sort()).toEqual(["md", "sm", "xs"]);
  });

  it("should hold three integers, strictly increasing from xs to md", () => {
    expect(Number.isInteger(MAP_HEIGHT.xs)).toBe(true);
    expect(Number.isInteger(MAP_HEIGHT.sm)).toBe(true);
    expect(Number.isInteger(MAP_HEIGHT.md)).toBe(true);
    expect(MAP_HEIGHT.xs).toBeLessThan(MAP_HEIGHT.sm);
    expect(MAP_HEIGHT.sm).toBeLessThan(MAP_HEIGHT.md);
  });

  it("should keep xs at or above four touch floors — never fixed as a bare number", () => {
    // Relation only, against the real theme token, never the literal 240/176 (contract § 7.1).
    expect(MAP_HEIGHT.xs).toBeGreaterThanOrEqual(touch.min * 4);
  });
});

describe("MAP_ROOT_CLASS / MAP_MARKER_CLASS (src/constants/map.ts)", () => {
  it("should each be a non-empty class name with no whitespace, and distinct from each other", () => {
    for (const className of [MAP_ROOT_CLASS, MAP_MARKER_CLASS]) {
      expect(className.length).toBeGreaterThan(0);
      expect(/\s/.test(className)).toBe(false);
    }
    expect(MAP_ROOT_CLASS).not.toBe(MAP_MARKER_CLASS);
  });
});

describe("MAP_MARKER_ICON_SIZE (src/constants/map.ts)", () => {
  it("should be EXACTLY touch.min — derived from the token, never a literal 44", () => {
    // If the tap floor ever changes, the marker must change with it: equality with the token
    // import, not with the number it happens to be today (contract § 7.1).
    expect(MAP_MARKER_ICON_SIZE).toBe(touch.min);
  });
});

describe("MAP_MARKER_DOT_SIZE (src/constants/map.ts)", () => {
  it("should be smaller than the marker's hit area and at least the WCAG 2.2 target-size minimum (24)", () => {
    expect(MAP_MARKER_DOT_SIZE).toBeLessThan(MAP_MARKER_ICON_SIZE);
    expect(MAP_MARKER_DOT_SIZE).toBeGreaterThanOrEqual(24);
  });
});

describe("MAP_ATTRIBUTION_BAR_HEIGHT (src/constants/map.ts)", () => {
  it("should be at least 24 and fit inside the shortest map slot", () => {
    expect(MAP_ATTRIBUTION_BAR_HEIGHT).toBeGreaterThanOrEqual(24);
    expect(MAP_ATTRIBUTION_BAR_HEIGHT).toBeLessThan(MAP_HEIGHT.xs);
  });
});
