/**
 * Resolves the delivery fee a buyer is charged for a zone, from a store's zone
 * tariff rows.
 *
 * This is a MIRROR of the resolution queandabuscando runs at checkout time: the
 * tariff rows are written here and read there, but the POS has to show the
 * manager what a buyer from each zone will be charged, so the same rule lives on
 * both sides. Divergence between the two is invisible — the manager believes he
 * charges 300 and charges 400 — which is why the agreed vector in the sync
 * contract is the only thing that keeps them in step. See ADR 0091.
 *
 * Zone codes are DPA/ONEI: a province is 2 digits and a municipality is 4, of
 * which the first 2 are its province. That prefix containment IS the hierarchy;
 * there is no separate parent link to follow.
 */

/** Municipality codes are 4 digits; the province is their first 2. */
const PROVINCE_CODE_LENGTH = 2;
const MUNICIPALITY_CODE_LENGTH = 4;

/**
 * What a single tariff row says about its zone. A discriminant rather than two
 * booleans, so `served: true` without a fee cannot be expressed at all.
 */
export type ZoneTariffRule = "FEE" | "NOT_SERVED" | "INHERIT";

export interface ZoneTariffRow {
  zoneCode: string;
  rule: ZoneTariffRule;
  /** Required when rule is FEE, absent otherwise. */
  deliveryFee?: number;
}

/**
 * One rung of the ladder: which zone was consulted and what its row said.
 * `rule: null` means there was no row at that level.
 */
export interface ZoneResolutionStep {
  zoneCode: string;
  rule: ZoneTariffRule | null;
}

export interface ZoneResolution {
  served: boolean;
  /** Only set when served. */
  deliveryFee?: number;
  /**
   * Which row decided it, for the manager-facing coverage view. Null when
   * nothing matched and the zone is unserved by omission.
   */
  decidedBy: string | null;
  /**
   * Every rung consulted, in order, and what each said.
   *
   * `decidedBy` alone cannot explain two zones to the manager: 0303 (own row
   * saying INHERIT) and 0304 (no row at all) are both decided by the same
   * province row and need different wording, and "not served with no deciding
   * row" covers both a province that declined and a zone nobody ever mentioned.
   * The screens render this, not `decidedBy`.
   */
  path: ZoneResolutionStep[];
}

/**
 * The zone's place in the hierarchy, as the shared catalog artifact declares it.
 *
 * The level is DECLARED, never derived from the code's length. Cuba has a
 * "municipio especial" —Isla de la Juventud— that sits at province level, so
 * "2 digits means province, 4 means municipality" is a rule that holds for 183
 * rows and breaks on the 184th. Worse, it breaks silently: a first-level zone
 * with a 4-digit code whose first two digits collide with a real province would
 * inherit that province's tariff, and the buyer is charged a price nobody set.
 */
export interface ZoneCatalogEntry {
  level: 1 | 2;
  /** The zone above it. Absent for first-level zones, which inherit from nothing. */
  parentCode?: string;
}

export type ZoneCatalog = ReadonlyMap<string, ZoneCatalogEntry>;

/**
 * Bootstrap hierarchy, used only when no catalog is supplied — the shared
 * artifact does not exist yet. It applies the DPA prefix rule, which is right
 * for every ordinary zone and is exactly what the catalog exists to override.
 */
function fallbackParentOf(zoneCode: string): string | undefined {
  return zoneCode.length === MUNICIPALITY_CODE_LENGTH
    ? zoneCode.slice(0, PROVINCE_CODE_LENGTH)
    : undefined;
}

function ladderFor(zoneCode: string, catalog?: ZoneCatalog): string[] {
  const entry = catalog?.get(zoneCode);
  const parent = entry ? entry.parentCode : fallbackParentOf(zoneCode);
  return parent ? [zoneCode, parent] : [zoneCode];
}

/**
 * Applies one row. Returns null when the row does not decide — either it says
 * INHERIT, or it says FEE without an amount, which the contract rejects on the
 * wire and which must not be read here as a free delivery.
 */
function decides(row: ZoneTariffRow): boolean {
  if (row.rule === "NOT_SERVED") return true;
  if (row.rule !== "FEE") return false;
  // Never a falsy check: a fee of 0 is free delivery, and reading it as "no
  // tariff" would silently fall through to the province price. And a row the
  // contract's schema would have rejected — no amount, negative, non-finite —
  // must not decide here either, or the two sides diverge: over there the row
  // was never written, so resolution falls to the next rung.
  return (
    typeof row.deliveryFee === "number" &&
    Number.isFinite(row.deliveryFee) &&
    row.deliveryFee >= 0
  );
}

/**
 * Resolves one zone against a store's rows.
 *
 * The ladder has two rungs and no more: the municipality row, then its province
 * row. A row that says INHERIT — or no row at all — falls to the next rung, and
 * a province row that inherits has nothing above it, so the zone is unserved.
 * INHERIT at province level is legal on purpose: with DELETE removed from
 * ZONE_TARIFF it is the only way a manager can retract a province-wide rule and
 * keep his municipality exceptions.
 */
export function resolveZoneTariff(
  rows: ZoneTariffRow[],
  zoneCode: string,
  catalog?: ZoneCatalog,
): ZoneResolution {
  const byCode = new Map<string, ZoneTariffRow>();
  for (const row of rows) {
    byCode.set(row.zoneCode, row);
  }

  const ladder = ladderFor(zoneCode, catalog);

  const path: ZoneResolutionStep[] = [];

  for (const code of ladder) {
    const row = byCode.get(code);
    path.push({ zoneCode: code, rule: row ? row.rule : null });
    if (!row || !decides(row)) continue;

    return row.rule === "NOT_SERVED"
      ? { served: false, decidedBy: code, path }
      : { served: true, deliveryFee: row.deliveryFee, decidedBy: code, path };
  }

  return { served: false, decidedBy: null, path };
}

/**
 * The coverage a buyer would see, resolved zone by zone. The manager configures
 * a province row plus exceptions, which is unreadable as a list of rows — this
 * is what the tariff screen shows him instead.
 */
export function resolveCoverage(
  rows: ZoneTariffRow[],
  zoneCodes: string[],
  catalog?: ZoneCatalog,
): Map<string, ZoneResolution> {
  const coverage = new Map<string, ZoneResolution>();
  for (const zoneCode of zoneCodes) {
    coverage.set(zoneCode, resolveZoneTariff(rows, zoneCode, catalog));
  }
  return coverage;
}
