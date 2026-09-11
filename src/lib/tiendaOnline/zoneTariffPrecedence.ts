import type {
  IZoneLevel,
  IZoneRef,
  IZoneResolution,
  IZoneResolutionStep,
  IZoneResolutionVerdict,
  IZoneTariffRow,
} from "@/schemas/qabZone";

/** Exactly two decimals, as the agreed vector writes every amount. */
const DELIVERY_FEE_DECIMALS = 2;

/**
 * Formats a wire amount as the agreed vector compares it: exactly two decimals,
 * "." as the decimal mark, no grouping and no currency symbol. 300 becomes
 * "300.00" and 0 becomes "0.00".
 *
 * This is a wire amount, not a screen amount: it is never routed through a
 * locale-aware formatter, which would produce a comma and break the comparison.
 */
export function formatZoneDeliveryFee(amount: number): string {
  return amount.toFixed(DELIVERY_FEE_DECIMALS);
}

/** One rung of the ladder, before its row has been looked up. */
interface ZoneLadderRung {
  code: string;
  level: IZoneLevel;
}

/**
 * The rungs to consult, in order.
 *
 * The second rung exists if and ONLY if the zone is declared MUNICIPALITY and
 * carries a non-empty province code. The guard is the DECLARED level, never the
 * mere presence of a province code: a FIRST_LEVEL zone that carries one stops at
 * a single rung.
 *
 * The second rung's level is the literal "FIRST_LEVEL", not the result of
 * looking that code up in any catalog — the province may be in no catalog the
 * caller holds and the path still names it as first level.
 */
function ladderFor(zone: IZoneRef): ZoneLadderRung[] {
  const rungs: ZoneLadderRung[] = [{ code: zone.code, level: zone.level }];

  if (
    zone.level === "MUNICIPALITY" &&
    typeof zone.provinceCode === "string" &&
    zone.provinceCode !== ""
  ) {
    rungs.push({ code: zone.provinceCode, level: "FIRST_LEVEL" });
  }

  return rungs;
}

/**
 * The row of a rung is the FIRST row of the array whose zoneCode is strictly
 * equal to the rung's code. Two rows for the same code: the first one wins.
 */
function rowFor(
  rows: IZoneTariffRow[],
  code: string,
): IZoneTariffRow | undefined {
  return rows.find((row) => row.zoneCode === code);
}

/**
 * What a rung's row said. `amount` is the number the rung charges, and it is
 * only ever set together with the `FEE` verdict.
 */
interface ZoneRungVerdict {
  verdict: IZoneResolutionVerdict;
  decides: boolean;
  amount: number | null;
}

/**
 * What a rung's row says, and whether it ends the walk. The table is complete
 * and mutually exclusive; there are no other branches and none may be added.
 *
 * A fee of 0 DECIDES and means free delivery. Testing the amount for
 * truthiness would read it as "no tariff" and fall through to the rung above,
 * charging a price the merchant never set.
 */
function verdictFor(row: IZoneTariffRow | undefined): ZoneRungVerdict {
  if (!row) {
    return { verdict: "ABSENT", decides: false, amount: null };
  }

  if (row.rule === "INHERIT") {
    return { verdict: "INHERIT", decides: false, amount: null };
  }

  if (row.rule === "NOT_SERVED") {
    return { verdict: "NOT_SERVED", decides: true, amount: null };
  }

  const { deliveryFee } = row;

  if (typeof deliveryFee === "number" && Number.isFinite(deliveryFee)) {
    return deliveryFee >= 0
      ? { verdict: "FEE", decides: true, amount: deliveryFee }
      : { verdict: "FEE_NEGATIVE", decides: false, amount: null };
  }

  return { verdict: "FEE_WITHOUT_AMOUNT", decides: false, amount: null };
}

/**
 * Resolves which tariff applies to one zone, mirroring the resolution
 * queandabuscando runs at checkout. Pure: no database, no network, no clock.
 *
 * The ladder has at most two rungs — the zone itself, then, ONLY when the zone
 * is declared MUNICIPALITY, its declared province. It is not a parent chain and
 * it never grows a third rung: the contract publishes no parent link.
 *
 * The second rung is decided by the DECLARED level, never by whether a province
 * code is present: a FIRST_LEVEL zone carrying a province code stops at one
 * rung. Neither level nor province is ever inferred from the code's shape.
 *
 * Returns exactly four keys, and each step exactly four, so the whole object
 * can be compared against the agreed vector in one assertion.
 */
export function resolveZoneTariff(
  zone: IZoneRef,
  rows: IZoneTariffRow[],
): IZoneResolution {
  const path: IZoneResolutionStep[] = [];

  for (const rung of ladderFor(zone)) {
    const { verdict, decides, amount } = verdictFor(rowFor(rows, rung.code));

    path.push({ code: rung.code, level: rung.level, verdict, decides });

    if (!decides) {
      // A rung that does not decide is recorded and the walk carries on. Only a
      // deciding rung stops it, which is why the rungs after one never appear.
      continue;
    }

    return amount === null
      ? { served: false, deliveryFee: null, decidedBy: rung.code, path }
      : {
          served: true,
          deliveryFee: formatZoneDeliveryFee(amount),
          decidedBy: rung.code,
          path,
        };
  }

  return { served: false, deliveryFee: null, decidedBy: null, path };
}
