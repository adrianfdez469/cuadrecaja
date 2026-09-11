import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "path";
import type {
  IZoneRef,
  IZoneResolution,
  IZoneTariffRow,
} from "@/schemas/qabZone";

/**
 * F-039 — resolveZoneTariff / formatZoneDeliveryFee, and the committed 13-case contract
 * vector that fixes the ZONE_TARIFF precedence algorithm (contract v13).
 *
 * Written against `.agents/specs/F-039.md` §§ 4.3, 5, 6, 10.3, without reading the
 * implementer's `src/lib/tiendaOnline/zoneTariffPrecedence.ts`. This file REPLACES the one
 * from F-026 wholesale: that implementation's shape (four-digit codes, level 1|2, prefix
 * inference) is exactly what this contract retires (contract § 1).
 *
 * Every import of production code is a per-test dynamic import so a missing export never
 * tumbles the whole file (E-019), and so the hash/parse tests below — which depend on nothing
 * but the committed fixture — stay green independently of how far the implementer has gotten.
 */

const VECTOR_PATH = path.join(
  process.cwd(),
  "src/__tests__/fixtures/zoneTariffPrecedenceVector.md",
);
const VECTOR_BLOCK_SHA256 =
  "0a4fbe39e79054ffcd47b42450f1deeb35d823644b610b7602c147ff0e175bc0";
const PRECEDENCE_MODULE_PATH = "@/lib/tiendaOnline/zoneTariffPrecedence";

interface IVectorCase {
  id: string;
  zone: IZoneRef;
  rows: IZoneTariffRow[];
  expected: IZoneResolution;
}

interface IVector {
  version: string;
  fixture: { zones: unknown[]; rows: unknown[] };
  cases: IVectorCase[];
}

/** Extracts the raw block between the fence, exactly as § 6 of the contract mandates. */
function readVectorBlock(): string {
  const fixtureText = readFileSync(VECTOR_PATH, "utf8");
  const match = /```json\n([\s\S]*?)\n```/.exec(fixtureText);
  if (!match) throw new Error("No json fence in the committed vector fixture");
  return match[1];
}

// Hashed and parsed from the very same string, with no normalisation: no trim(), no CRLF
// rewriting, no JSON.parse followed by JSON.stringify (contract § 6, § 11 point 2).
function readVector(): IVector {
  return JSON.parse(readVectorBlock()) as IVector;
}

describe("committed ZONE_TARIFF precedence vector (contract v13)", () => {
  it("criterion 7: the extracted block hashes to the sha256 the contract publishes, computed at run time against a fixed literal — not against QAB_DOCS_PATH", () => {
    const block = readVectorBlock();
    const hash = createHash("sha256").update(block, "utf8").digest("hex");
    expect(hash).toBe(VECTOR_BLOCK_SHA256);
  });

  it("criterion 7 (sanity of the extraction): the parsed vector carries version '1' and exactly the 13 agreed case ids, in order", () => {
    const vector = readVector();
    expect(vector.version).toBe("1");
    expect(vector.cases).toHaveLength(13);
    expect(vector.cases.map((testCase) => testCase.id)).toEqual([
      "V1",
      "V2",
      "V3",
      "V4",
      "V5",
      "V6",
      "V7",
      "V8",
      "V9",
      "V10",
      "G1",
      "G2",
      "G3",
    ]);
  });
});

// Known statically so `it.each` below never depends on the fixture having parsed correctly:
// a corrupted fixture must only fail the dedicated hash test (criterion 7), never take down
// every other test in this file by throwing during collection (E-019).
const VECTOR_CASE_IDS = [
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V7",
  "V8",
  "V9",
  "V10",
  "G1",
  "G2",
  "G3",
] as const;

/**
 * Builds the `it.each` table without ever throwing at collection time. On a healthy fixture
 * this is just `readVector().cases`; if the committed fixture is corrupted, each of the 13
 * known case ids gets a placeholder that is guaranteed to fail its own assertion — loudly, and
 * only for the tests that actually consult the vector's content.
 */
function buildVectorCaseTable(): IVectorCase[] {
  try {
    const vector = readVector();
    return vector.cases;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return VECTOR_CASE_IDS.map((id) => ({
      id,
      zone: { code: "FIXTURE_DID_NOT_PARSE", level: "MUNICIPALITY", provinceCode: null },
      rows: [],
      expected: {
        served: false,
        deliveryFee: `fixture did not parse: ${message}`,
        decidedBy: null,
        path: [],
      },
    }));
  }
}

describe("resolveZoneTariff against the 13-case contract vector (criteria 4, 5)", () => {
  it.each(buildVectorCaseTable())(
    "case $id resolves the exact expected object — deliveryFee, decidedBy and path together, in one assert",
    async (testCase) => {
      const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
      // toEqual over the whole object compares the three outputs together and fails on any
      // extra or missing key — three loose asserts would let one of them be left half-done,
      // which is exactly what criterion 4 forbids.
      expect(resolveZoneTariff(testCase.zone, testCase.rows)).toEqual(
        testCase.expected,
      );
    },
  );
});

describe("resolveZoneTariff — deliveryFee is a string, never coerced (criterion 6)", () => {
  it("case G2's deliveryFee is the exact string '0.00' under strict equality, not a coerced number", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const vector = readVector();
    const g2 = vector.cases.find((testCase) => testCase.id === "G2");
    if (!g2) throw new Error("G2 missing from the committed vector");

    const result = resolveZoneTariff(g2.zone, g2.rows);
    expect(result.deliveryFee).toBe("0.00");
    expect(result.deliveryFee).not.toBe(0);
  });

  it("across all 13 cases, deliveryFee is always a two-decimal string or null, never a bare number", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const vector = readVector();
    for (const testCase of vector.cases) {
      const result = resolveZoneTariff(testCase.zone, testCase.rows);
      if (result.deliveryFee === null) continue;
      expect(typeof result.deliveryFee).toBe("string");
      expect(result.deliveryFee).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

describe("formatZoneDeliveryFee", () => {
  it("formats amounts with exactly two decimals, a dot, and no thousands grouping (contract § 5.5)", async () => {
    const { formatZoneDeliveryFee } = await import(PRECEDENCE_MODULE_PATH);
    expect(formatZoneDeliveryFee(300)).toBe("300.00");
    expect(formatZoneDeliveryFee(150)).toBe("150.00");
    expect(formatZoneDeliveryFee(250)).toBe("250.00");
    expect(formatZoneDeliveryFee(200)).toBe("200.00");
    expect(formatZoneDeliveryFee(0)).toBe("0.00");
    expect(formatZoneDeliveryFee(999999999999.99)).toBe("999999999999.99");
  });

  it("never produces a locale comma decimal mark", async () => {
    const { formatZoneDeliveryFee } = await import(PRECEDENCE_MODULE_PATH);
    expect(formatZoneDeliveryFee(300)).not.toContain(",");
  });
});

describe("resolveZoneTariff — the three written-out cases from the contract's letter (criterion 3)", () => {
  it("a municipality whose own row decides (mirrors V4)", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.07", level: "MUNICIPALITY", provinceCode: "03" },
      [{ zoneCode: "03.07", rule: "FEE", deliveryFee: 150 }],
    );
    expect(result).toEqual({
      served: true,
      deliveryFee: "150.00",
      decidedBy: "03.07",
      path: [
        { code: "03.07", level: "MUNICIPALITY", verdict: "FEE", decides: true },
      ],
    });
  });

  it("a municipality that inherits from its declared province when its own row does not decide or does not exist (mirrors V3)", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.04", level: "MUNICIPALITY", provinceCode: "03" },
      [{ zoneCode: "03", rule: "FEE", deliveryFee: 300 }],
    );
    expect(result).toEqual({
      served: true,
      deliveryFee: "300.00",
      decidedBy: "03",
      path: [
        { code: "03.04", level: "MUNICIPALITY", verdict: "ABSENT", decides: false },
        { code: "03", level: "FIRST_LEVEL", verdict: "FEE", decides: true },
      ],
    });
  });

  it("a first-level zone that only ever consults its own row, never a second rung, even with a municipality-shaped code and a province code present (mirrors V10)", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.40", level: "FIRST_LEVEL", provinceCode: "03" },
      [],
    );
    expect(result).toEqual({
      served: false,
      deliveryFee: null,
      decidedBy: null,
      path: [
        { code: "03.40", level: "FIRST_LEVEL", verdict: "ABSENT", decides: false },
      ],
    });
  });
});

describe("resolveZoneTariff purity (criterion 3)", () => {
  it("the module's source never mentions prisma, axios, or calls fetch(", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/tiendaOnline/zoneTariffPrecedence.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/prisma|axios|fetch\(/);
  });
});

describe("resolveZoneTariff — the four cases the vector does not carry, that contract § 5 still defines (contract § 10.4)", () => {
  it("a municipality with no declared province and no rows: a single ABSENT rung, never served", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "07.01", level: "MUNICIPALITY", provinceCode: null },
      [],
    );
    expect(result).toEqual({
      served: false,
      deliveryFee: null,
      decidedBy: null,
      path: [
        { code: "07.01", level: "MUNICIPALITY", verdict: "ABSENT", decides: false },
      ],
    });
  });

  it("two rows for the same zone code: the first one in array order wins", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.05", level: "MUNICIPALITY", provinceCode: "03" },
      [
        { zoneCode: "03.05", rule: "FEE", deliveryFee: 100 },
        { zoneCode: "03.05", rule: "FEE", deliveryFee: 900 },
      ],
    );
    expect(result.deliveryFee).toBe("100.00");
    expect(result.decidedBy).toBe("03.05");
  });

  it("a FEE row with a null amount is FEE_WITHOUT_AMOUNT and does not decide; the province's FEE 300 decides instead", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    // The product's own schema types deliveryFee as `number | undefined` (contract § 4.1), but
    // § 5.3's verdict table also routes an explicit `null` through FEE_WITHOUT_AMOUNT. Covered
    // here with a cast, per the contract's own instruction — not by widening the product type.
    const rowWithNullFee = {
      zoneCode: "03.20",
      rule: "FEE",
      deliveryFee: null,
    } as unknown as IZoneTariffRow;

    const result = resolveZoneTariff(
      { code: "03.20", level: "MUNICIPALITY", provinceCode: "03" },
      [rowWithNullFee, { zoneCode: "03", rule: "FEE", deliveryFee: 300 }],
    );
    expect(result).toEqual({
      served: true,
      deliveryFee: "300.00",
      decidedBy: "03",
      path: [
        {
          code: "03.20",
          level: "MUNICIPALITY",
          verdict: "FEE_WITHOUT_AMOUNT",
          decides: false,
        },
        { code: "03", level: "FIRST_LEVEL", verdict: "FEE", decides: true },
      ],
    });
  });

  it("a FEE row with a non-finite amount (NaN) is also FEE_WITHOUT_AMOUNT", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.21", level: "MUNICIPALITY", provinceCode: "03" },
      [
        { zoneCode: "03.21", rule: "FEE", deliveryFee: NaN },
        { zoneCode: "03", rule: "FEE", deliveryFee: 300 },
      ],
    );
    expect(result.path[0]).toEqual({
      code: "03.21",
      level: "MUNICIPALITY",
      verdict: "FEE_WITHOUT_AMOUNT",
      decides: false,
    });
    expect(result.decidedBy).toBe("03");
  });

  it("a row belonging to another zone code never participates", async () => {
    const { resolveZoneTariff } = await import(PRECEDENCE_MODULE_PATH);
    const result = resolveZoneTariff(
      { code: "03.05", level: "MUNICIPALITY", provinceCode: "03" },
      [{ zoneCode: "04", rule: "FEE", deliveryFee: 500 }],
    );
    expect(result).toEqual({
      served: false,
      deliveryFee: null,
      decidedBy: null,
      path: [
        { code: "03.05", level: "MUNICIPALITY", verdict: "ABSENT", decides: false },
        { code: "03", level: "FIRST_LEVEL", verdict: "ABSENT", decides: false },
      ],
    });
  });
});
