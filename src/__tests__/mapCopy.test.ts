import { describe, it, expect } from "vitest";
import {
  mapHintCopy,
  MAP_GROUP_LABEL,
  MAP_HINT_NO_POINT,
  MAP_HINT_WITH_POINT,
  MAP_DEGRADED_NOTICE,
  MAP_LOADING_LABEL,
  MAP_REMOVE_POINT_LABEL,
  MAP_ZOOM_IN_TITLE,
  MAP_ZOOM_OUT_TITLE,
} from "@/components/tiendaOnline/map/mapCopy";

/**
 * F-025 — `src/components/tiendaOnline/map/mapCopy.ts`.
 *
 * Added to the contract (§ 7.1 "Ampliación tras el paso 4b") after the `ui-designer` delivered
 * its "Símbolos puros añadidos" section (`.agents/designs/F-025.md`, line 524). Not the
 * `implementer`'s or `dev-tester`'s call to add these symbols on their own (E-035) — they were
 * already added by `arch-guardian` to the contract before this file was written.
 *
 * A plain `.ts`, importable from a test without touching React (E-015).
 *
 * Per contract § 7.1 "Al dev-tester, tres cosas que NO debe fijar": no visible copy is pinned
 * here except the mandatory attribution fragments (elsewhere, in mapConstants.test.ts) — every
 * string below is one the design contract explicitly fixed as an exact, named constant, which is
 * different from "copy visible" in the general sense the prohibition targets (free-form UI text
 * the ui-designer could still tweak). These eight ARE the frozen contract values (design doc,
 * "Símbolos puros añadidos", line ~524).
 */

describe("mapHintCopy (map/mapCopy.ts)", () => {
  it("should return exactly MAP_HINT_NO_POINT for false, and MAP_HINT_WITH_POINT for true — by equality with the constants", () => {
    expect(mapHintCopy(false)).toBe(MAP_HINT_NO_POINT);
    expect(mapHintCopy(true)).toBe(MAP_HINT_WITH_POINT);
  });

  it("should return two distinct, non-empty strings for the two states — the discriminating check", () => {
    expect(MAP_HINT_NO_POINT).not.toBe(MAP_HINT_WITH_POINT);
    expect(MAP_HINT_NO_POINT.length).toBeGreaterThan(0);
    expect(MAP_HINT_WITH_POINT.length).toBeGreaterThan(0);
  });
});

describe("MAP_GROUP_LABEL (map/mapCopy.ts)", () => {
  it('should be exactly "Ubicación del local" — used both as the section aria-label and its visible legend', () => {
    expect(MAP_GROUP_LABEL).toBe("Ubicación del local");
  });
});

describe("MAP_HINT_NO_POINT / MAP_HINT_WITH_POINT (map/mapCopy.ts)", () => {
  it("should each mention both entry paths — mapa AND coordenadas — so the hint stays true even when the map fails to load", () => {
    for (const hint of [MAP_HINT_NO_POINT, MAP_HINT_WITH_POINT]) {
      expect(hint).toContain("mapa");
      expect(hint).toContain("coordenadas");
    }
  });
});

describe("MAP_DEGRADED_NOTICE (map/mapCopy.ts) — the E-031 half a test can fix", () => {
  it("should mention latitud and longitud, telling the merchant the form still works", () => {
    expect(MAP_DEGRADED_NOTICE).toContain("latitud");
    expect(MAP_DEGRADED_NOTICE).toContain("longitud");
  });

  it("should never interpolate a runtime error, a URL or a tile placeholder", () => {
    for (const forbidden of ["http", "tile", "{z}", "Error", "undefined", "NaN"]) {
      expect(MAP_DEGRADED_NOTICE).not.toContain(forbidden);
    }
  });
});

describe("MAP_LOADING_LABEL (map/mapCopy.ts)", () => {
  it('should be exactly "Cargando el mapa" — and NOT the ambiguous "Cargando" used by LoadingState (E-016)', () => {
    expect(MAP_LOADING_LABEL).toBe("Cargando el mapa");
    expect(MAP_LOADING_LABEL).not.toBe("Cargando");
  });
});

describe("MAP_REMOVE_POINT_LABEL (map/mapCopy.ts)", () => {
  it('should be exactly "Quitar el punto" — distinguishable from "Quitar el horario", which coexists on the same tab (E-016)', () => {
    expect(MAP_REMOVE_POINT_LABEL).toBe("Quitar el punto");
    expect(MAP_REMOVE_POINT_LABEL).not.toBe("Quitar el horario");
    // Neither shares the other's prefix nor suffix, so a locator built from either fragment
    // cannot accidentally match both actions on the same screen.
    expect(MAP_REMOVE_POINT_LABEL.startsWith("Quitar el ")).toBe(true);
    expect(MAP_REMOVE_POINT_LABEL.endsWith("horario")).toBe(false);
  });
});

describe("MAP_ZOOM_IN_TITLE / MAP_ZOOM_OUT_TITLE (map/mapCopy.ts)", () => {
  it('should be exactly "Acercar" and "Alejar", distinct and non-empty — the titles Leaflet copies to aria-label', () => {
    expect(MAP_ZOOM_IN_TITLE).toBe("Acercar");
    expect(MAP_ZOOM_OUT_TITLE).toBe("Alejar");
    expect(MAP_ZOOM_IN_TITLE).not.toBe(MAP_ZOOM_OUT_TITLE);
  });
});
