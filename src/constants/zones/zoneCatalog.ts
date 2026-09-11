import zoneIndex from "@/constants/zones/zone-index.json";
import type { IZoneCatalog, IZoneCatalogEntry } from "@/schemas/qabZone";

/**
 * The 184 shared zones, in the artifact's own order. The bytes are the ones
 * queandabuscando publishes; the test pins them by sha256.
 *
 * Read as the imported object, NOT validated at import time: the hash test is
 * the guarantee, and a throw while importing in production would be worse than
 * a red test. See ADR 0143.
 *
 * The assertion goes through `unknown` on purpose: TypeScript widens `level` to
 * `string` when it infers the JSON, so the direct assertion to the union does
 * not compile. It is an affirmation, not a check — what backs it are the hash
 * test and the shape test, not the compiler.
 */
export const ZONE_CATALOG = zoneIndex as unknown as IZoneCatalog;

/**
 * Built once at module load, so a lookup is a hash hit and not a linear scan
 * over 184 rows on every call.
 */
const ZONES_BY_CODE: ReadonlyMap<string, IZoneCatalogEntry> = new Map(
  ZONE_CATALOG.zones.map((zone) => [zone.code, zone] as const),
);

/**
 * Lookup by DPA code. Returns the row the artifact declares, with its level and
 * its province verbatim: nothing here reads the code's shape, its length or its
 * dot to work either of them out.
 */
export function getZoneByCode(code: string): IZoneCatalogEntry | undefined {
  return ZONES_BY_CODE.get(code);
}
