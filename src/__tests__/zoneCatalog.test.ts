import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "path";
import type { IZoneCatalogEntry } from "@/schemas/qabZone";

/**
 * F-041 — the shared zone catalog (184 rows: 16 FIRST_LEVEL, 168 MUNICIPALITY).
 *
 * Written against the interface contract in `.agents/specs/F-041.md` §§ 4.2, 10.2, without
 * reading the implementer's `src/constants/zones/zoneCatalog.ts`. Every import of production
 * code is a per-test dynamic import so a missing export in one symbol never tumbles the whole
 * file (E-019).
 */

const ZONE_INDEX_PATH = path.join(
  process.cwd(),
  "src/constants/zones/zone-index.json",
);
const ZONE_INDEX_SHA256 =
  "9bb89dd3564b0b202f975160f98be449efdc3c2b3d8594df6a7ec8009853b019";

describe("src/constants/zones/zone-index.json — committed artifact bytes", () => {
  it("criterion 1: the committed file's own bytes hash to the sha256 the contract publishes for catalog version 1.0.0", () => {
    // Hashed from the raw Buffer read off disk, never from a re-serialized JSON.parse/stringify
    // round trip — that would measure a different thing and let a reindented or reordered copy
    // pass (contract § 11, point 1).
    const bytes = readFileSync(ZONE_INDEX_PATH);
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(ZONE_INDEX_SHA256);
  });
});

describe("ZONE_CATALOG", () => {
  it("criterion 1 (reinforcement): declares version 1.0.0 with 184 rows — 16 FIRST_LEVEL and 168 MUNICIPALITY", async () => {
    const { ZONE_CATALOG } = await import("@/constants/zones/zoneCatalog");

    expect(ZONE_CATALOG.version).toBe("1.0.0");
    expect(ZONE_CATALOG.zones).toHaveLength(184);

    const firstLevel = ZONE_CATALOG.zones.filter(
      (zone: IZoneCatalogEntry) => zone.level === "FIRST_LEVEL",
    );
    const municipality = ZONE_CATALOG.zones.filter(
      (zone: IZoneCatalogEntry) => zone.level === "MUNICIPALITY",
    );
    expect(firstLevel).toHaveLength(16);
    expect(municipality).toHaveLength(168);
  });

  it("criterion 1 (shape): parses against zoneCatalogSchema without throwing", async () => {
    const { ZONE_CATALOG } = await import("@/constants/zones/zoneCatalog");
    const { zoneCatalogSchema } = await import("@/schemas/qabZone");

    // A partial seed or a mutilated row must fail this even if someone recomputed the hash
    // around it (contract § 10.2, point 3).
    expect(() => zoneCatalogSchema.parse(ZONE_CATALOG)).not.toThrow();
  });

  it("criterion 2: row 184 (index 183) declares MUNICIPALITY level and provinceCode '40' for Isla de la Juventud, never inferred from the code's shape", async () => {
    const { ZONE_CATALOG, getZoneByCode } = await import(
      "@/constants/zones/zoneCatalog"
    );

    const expectedRow: IZoneCatalogEntry = {
      code: "40.01",
      name: "Isla de la Juventud",
      level: "MUNICIPALITY",
      provinceCode: "40",
      osmRelationId: "1854614",
      osmName: "Isla de la Juventud",
      retiredAt: null,
    };

    expect(ZONE_CATALOG.zones[183]).toEqual(expectedRow);
    expect(getZoneByCode("40.01")).toEqual(expectedRow);
  });

  it("criterion 2: row 16 (index 15) is its FIRST_LEVEL counterpart, sharing the same osmRelationId", async () => {
    const { ZONE_CATALOG } = await import("@/constants/zones/zoneCatalog");

    const expectedRow: IZoneCatalogEntry = {
      code: "40",
      name: "Isla de la Juventud",
      level: "FIRST_LEVEL",
      provinceCode: null,
      osmRelationId: "1854614",
      osmName: "Isla de la Juventud",
      retiredAt: null,
    };

    expect(ZONE_CATALOG.zones[15]).toEqual(expectedRow);
  });

  it("getZoneByCode returns undefined for a code absent from the catalog", async () => {
    const { getZoneByCode } = await import("@/constants/zones/zoneCatalog");
    expect(getZoneByCode("99.99")).toBeUndefined();
  });
});
