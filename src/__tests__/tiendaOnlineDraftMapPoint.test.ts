import { describe, it, expect } from "vitest";
import {
  roundCoordinate,
  draftToMapPoint,
  applyMapPointToDraft,
  clearMapPointFromDraft,
  hasLonelyCoordinate,
  draftFromLocal,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import {
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
} from "@/constants/map";
import type { IMapPoint } from "@/schemas/map";

/**
 * F-025 — the four functions the contract (`.agents/specs/F-025.md` § 3.3) adds to
 * `src/utils/tiendaOnlineDraft.ts`: `roundCoordinate`, `draftToMapPoint`, `applyMapPointToDraft`
 * and `clearMapPointFromDraft`.
 *
 * DELIBERATELY a SEPARATE file from `tiendaOnlineDraft.test.ts`, which already has passing
 * coverage for `emptyContactFieldsNotice` (F-020). Importing four not-yet-implemented named
 * exports from the same module in one file would fail at module-link time and take the whole
 * file down with it — exactly the failure mode E-019's addendum warns about ("cualquier cosa
 * evaluada en la colección… un import que revienta"), except here it would be an import instead
 * of an `it.each` argument. Keeping the new, expected-red symbols in their own file means the
 * F-020 coverage stays green and unaffected while the implementer finishes this feature.
 *
 * Written against the contract, without reading the implementation.
 */

function baseDraft(overrides: Partial<ITiendaOnlineDraft> = {}): ITiendaOnlineDraft {
  return {
    publicarEnTienda: true,
    slug: "la-rampa",
    descripcion: "Bodega de barrio",
    direccion: "Calle 23",
    ciudad: "La Habana",
    provincia: "La Habana",
    latitud: "",
    longitud: "",
    telefono: "+5350000000",
    whatsapp: "+5350000000",
    email: "tienda@example.com",
    horarios: null,
    motivoDespublicacion: "",
    ...overrides,
  };
}

/** Every draft key EXCEPT latitud/longitud — used to assert the other fields are untouched. */
const NON_COORDINATE_KEYS = Object.keys(baseDraft()).filter(
  (key) => key !== "latitud" && key !== "longitud",
) as Array<keyof ITiendaOnlineDraft>;

function baseLocal(overrides: Partial<ITiendaOnlineLocal> = {}): ITiendaOnlineLocal {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    nombre: "Sucursal Centro",
    tipo: "TIENDA" as ITiendaOnlineLocal["tipo"],
    publicarEnTienda: true,
    slug: "la-rampa",
    slugQab: null,
    descripcion: "Bodega de barrio",
    direccion: "Calle 23",
    ciudad: "La Habana",
    provincia: "La Habana",
    latitud: null,
    longitud: null,
    telefono: "+5350000000",
    whatsapp: "+5350000000",
    email: "tienda@example.com",
    horarios: null,
    horariosInvalid: false,
    horariosIssues: [],
    motivoDespublicacion: null,
    publishable: true,
    firstPublishPending: true,
    syncState: { state: "SYNCED", code: null, attempts: 0, since: null },
    ...overrides,
  };
}

describe("roundCoordinate (utils/tiendaOnlineDraft.ts)", () => {
  it("should round to 6 decimals, matching the native toFixed(6) oracle", () => {
    const value = 23.1234564;
    expect(roundCoordinate(value)).toBe(Number(value.toFixed(6)));
  });

  it("should bring a 15-17 significant-figure click value down to 6 decimals", () => {
    const clickValue = 23.123456789012345;
    const rounded = roundCoordinate(clickValue);
    expect(rounded).toBe(Number(clickValue.toFixed(6)));
    const decimals = String(rounded).split(".")[1] ?? "";
    expect(decimals.length).toBeLessThanOrEqual(6);
  });

  it("should round the way toFixed rounds, for both a round-up and a round-down case", () => {
    const roundsUp = 10.1234567; // 7th decimal 7 -> rounds the 6th up
    const roundsDown = 10.1234561; // 7th decimal 1 -> stays
    expect(roundCoordinate(roundsUp)).toBe(Number(roundsUp.toFixed(6)));
    expect(roundCoordinate(roundsDown)).toBe(Number(roundsDown.toFixed(6)));
  });

  it("should turn -0 into plain 0, never negative zero", () => {
    const result = roundCoordinate(-0);
    expect(Object.is(result, 0)).toBe(true);
    expect(Object.is(result, -0)).toBe(false);
  });

  it("should never produce exponential notation when stringified, for any value in [-180, 180]", () => {
    const samples = [
      -180, -179.999999, -23.1136, -0.000001, -0.0000004, 0, 0.000001, 0.0000004, 23.1136,
      82.3666, 179.999999, 180,
    ];
    for (const value of samples) {
      const rounded = roundCoordinate(value);
      expect(String(rounded)).not.toMatch(/e/i);
    }
  });
});

describe("draftToMapPoint (utils/tiendaOnlineDraft.ts)", () => {
  it("should return a point for a valid pair", () => {
    const draft = baseDraft({ latitud: "23.1136", longitud: "-82.3666" });
    expect(draftToMapPoint(draft)).toEqual({ lat: 23.1136, lon: -82.3666 });
  });

  it("should return null when both coordinates are blank", () => {
    const draft = baseDraft({ latitud: "", longitud: "" });
    expect(draftToMapPoint(draft)).toBeNull();
  });

  it("should return null when only latitud is filled (one direction of the lonely-coordinate case)", () => {
    const draft = baseDraft({ latitud: "23.1136", longitud: "" });
    expect(draftToMapPoint(draft)).toBeNull();
  });

  it("should return null when only longitud is filled (the other direction)", () => {
    const draft = baseDraft({ latitud: "", longitud: "-82.3666" });
    expect(draftToMapPoint(draft)).toBeNull();
  });

  it('should return null for a lone "-" sign and for non-numeric text', () => {
    expect(draftToMapPoint(baseDraft({ latitud: "-", longitud: "-82.3666" }))).toBeNull();
    expect(
      draftToMapPoint(baseDraft({ latitud: "no es un número", longitud: "-82.3666" })),
    ).toBeNull();
  });

  it("should return null for a value just outside each of the four range limits", () => {
    expect(
      draftToMapPoint(baseDraft({ latitud: String(LATITUDE_MIN - 1), longitud: "0" })),
    ).toBeNull();
    expect(
      draftToMapPoint(baseDraft({ latitud: String(LATITUDE_MAX + 1), longitud: "0" })),
    ).toBeNull();
    expect(
      draftToMapPoint(baseDraft({ latitud: "0", longitud: String(LONGITUDE_MIN - 1) })),
    ).toBeNull();
    expect(
      draftToMapPoint(baseDraft({ latitud: "0", longitud: String(LONGITUDE_MAX + 1) })),
    ).toBeNull();
  });

  it("should return a point for the exact value of each of the four range limits", () => {
    expect(draftToMapPoint(baseDraft({ latitud: String(LATITUDE_MIN), longitud: "0" }))).toEqual({
      lat: LATITUDE_MIN,
      lon: 0,
    });
    expect(draftToMapPoint(baseDraft({ latitud: String(LATITUDE_MAX), longitud: "0" }))).toEqual({
      lat: LATITUDE_MAX,
      lon: 0,
    });
    expect(
      draftToMapPoint(baseDraft({ latitud: "0", longitud: String(LONGITUDE_MIN) })),
    ).toEqual({ lat: 0, lon: LONGITUDE_MIN });
    expect(
      draftToMapPoint(baseDraft({ latitud: "0", longitud: String(LONGITUDE_MAX) })),
    ).toEqual({ lat: 0, lon: LONGITUDE_MAX });
  });

  it("should return null in every case where hasLonelyCoordinate is true", () => {
    const lonelyDrafts = [
      baseDraft({ latitud: "23.1136", longitud: "" }),
      baseDraft({ latitud: "", longitud: "-82.3666" }),
      baseDraft({ latitud: "23.1136", longitud: "   " }),
    ];
    for (const draft of lonelyDrafts) {
      expect(hasLonelyCoordinate(draft)).toBe(true);
      expect(draftToMapPoint(draft)).toBeNull();
    }
  });

  it("should ALSO return null for cases where hasLonelyCoordinate is false — the implication does not reverse", () => {
    // Both filled, both unparseable: hasLonelyCoordinate is false (neither is "lonely"), but
    // draftToMapPoint must still be null. This is the discriminating case the contract calls
    // out explicitly: "sin que la implicación valga al revés".
    const bothUnparseable = baseDraft({ latitud: "abc", longitud: "xyz" });
    expect(hasLonelyCoordinate(bothUnparseable)).toBe(false);
    expect(draftToMapPoint(bothUnparseable)).toBeNull();

    // Both filled, both out of range: also not lonely, also null.
    const bothOutOfRange = baseDraft({
      latitud: String(LATITUDE_MAX + 5),
      longitud: String(LONGITUDE_MAX + 5),
    });
    expect(hasLonelyCoordinate(bothOutOfRange)).toBe(false);
    expect(draftToMapPoint(bothOutOfRange)).toBeNull();

    // Both blank: not lonely either, and null.
    const bothBlank = baseDraft({ latitud: "", longitud: "" });
    expect(hasLonelyCoordinate(bothBlank)).toBe(false);
    expect(draftToMapPoint(bothBlank)).toBeNull();
  });
});

describe("applyMapPointToDraft (utils/tiendaOnlineDraft.ts)", () => {
  const point: IMapPoint = { lat: 23.123456789, lon: -82.366654321 };

  it("should write both coordinates, rounded to 6 decimals", () => {
    const result = applyMapPointToDraft(baseDraft(), point);
    expect(Number(result.latitud)).toBe(Number(point.lat.toFixed(6)));
    expect(Number(result.longitud)).toBe(Number(point.lon.toFixed(6)));
  });

  it("should not touch any of the other draft fields", () => {
    const original = baseDraft({ latitud: "1", longitud: "2" });
    const result = applyMapPointToDraft(original, point);
    for (const key of NON_COORDINATE_KEYS) {
      expect(result[key]).toEqual(original[key]);
    }
  });

  it("should round-trip: draftToMapPoint(applyMapPointToDraft(d, p)) equals p rounded", () => {
    const draft = applyMapPointToDraft(baseDraft(), point);
    const roundTripped = draftToMapPoint(draft);
    expect(roundTripped).toEqual({
      lat: Number(point.lat.toFixed(6)),
      lon: Number(point.lon.toFixed(6)),
    });
  });

  it("should produce the SAME coordinate strings draftFromLocal would rebuild from a saved row with those numbers — so the save bar clears after saving", () => {
    const applied = applyMapPointToDraft(baseDraft(), point);
    const roundedLat = Number(point.lat.toFixed(6));
    const roundedLon = Number(point.lon.toFixed(6));

    const rebuiltFromRow = draftFromLocal(
      baseLocal({ latitud: roundedLat, longitud: roundedLon }),
    );

    expect(applied.latitud).toBe(rebuiltFromRow.latitud);
    expect(applied.longitud).toBe(rebuiltFromRow.longitud);
  });
});

describe("clearMapPointFromDraft (utils/tiendaOnlineDraft.ts)", () => {
  it("should leave both coordinates as empty strings", () => {
    const draft = baseDraft({ latitud: "23.1136", longitud: "-82.3666" });
    const result = clearMapPointFromDraft(draft);
    expect(result.latitud).toBe("");
    expect(result.longitud).toBe("");
  });

  it("should not touch any of the other draft fields", () => {
    const original = baseDraft({ latitud: "23.1136", longitud: "-82.3666" });
    const result = clearMapPointFromDraft(original);
    for (const key of NON_COORDINATE_KEYS) {
      expect(result[key]).toEqual(original[key]);
    }
  });

  it("should make draftToMapPoint of the result null", () => {
    const draft = baseDraft({ latitud: "23.1136", longitud: "-82.3666" });
    const result = clearMapPointFromDraft(draft);
    expect(draftToMapPoint(result)).toBeNull();
  });
});
