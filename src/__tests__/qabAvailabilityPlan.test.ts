import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  groupDivergentRowsByNegocio,
  chunkDivergentRows,
  toQabAvailabilityBatch,
  planAvailabilityWrites,
  emptyQabAvailabilityPhaseReport,
  normalizeSqlWhitespace,
  maxAvailabilityResponseBytes,
  QabAvailabilityTenantMismatchError,
} from "@/lib/qab/qabAvailabilityPlan";
import {
  QAB_AVAILABILITY,
  QAB_AVAILABILITY_BATCH_SIZE,
  QAB_AVAILABILITY_CASE_SQL,
  QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES,
  QAB_AVAILABILITY_MAX_RESPONSE_BYTES,
  QAB_DIVERGENCE_INDEX_MIGRATION_PATH,
} from "@/constants/qab";
import { qabAvailabilityPhaseReportSchema, qabAvailabilityBatchSchema } from "@/schemas/qabAvailability";
import type { IQabDivergentRow } from "@/schemas/qabAvailability";
import type { IQabAvailabilityPostOutcome } from "@/lib/qab/qabAvailabilityClient";

/**
 * F-007 — `src/lib/qab/qabAvailabilityPlan.ts` (contract § same name), the "todo puro"
 * module the contract calls out as the bulk of this suite: no database, no network.
 *
 * The highest-risk behaviour lives in `planAvailabilityWrites` (ADR 0050): `confirmed` is
 * the ONLY thing that authorises a write, and the value written comes from the SENT row,
 * never from the response. A response that names a pair this run never sent, or that
 * pairs a real `storeProductId` with a foreign `storeId`, must be ignored without error —
 * that is the defense against a manipulated or third-party response, and it is exactly
 * the kind of thing that breaks silently if the cross is done by `storeProductId` alone.
 *
 * `toQabAvailabilityBatch` is the other place worth extra care: the contract explicitly
 * forbids spreading a row onto the wire item, precisely so `negocioId` (or `existencia`,
 * the day the row grows one) can never leak onto the payload by accident. The key-by-key
 * check below (`Object.keys`) is the literal form the contract's own criterion 3
 * verification uses, not a "does not contain a specific key" check that a synonym could
 * slip past (E-023 in spirit: measure what IS there, not the absence of one guess).
 */

function divergentRow(overrides: Partial<IQabDivergentRow> = {}): IQabDivergentRow {
  return {
    productoTiendaId: "pt-1",
    tiendaId: "tienda-1",
    negocioId: "negocio-1",
    availability: "OUT_OF_STOCK",
    ...overrides,
  };
}

describe("groupDivergentRowsByNegocio", () => {
  it("should keep a single business's rows in their given order", () => {
    const rows = [
      divergentRow({ productoTiendaId: "pt-1" }),
      divergentRow({ productoTiendaId: "pt-2" }),
      divergentRow({ productoTiendaId: "pt-3" }),
    ];

    expect(groupDivergentRowsByNegocio(rows)).toEqual([{ negocioId: "negocio-1", rows }]);
  });

  it("should partition two businesses' rows without mixing them", () => {
    const rowA1 = divergentRow({ negocioId: "negocio-a", productoTiendaId: "a-1" });
    const rowB1 = divergentRow({ negocioId: "negocio-b", productoTiendaId: "b-1" });
    const rowA2 = divergentRow({ negocioId: "negocio-a", productoTiendaId: "a-2" });

    const groups = groupDivergentRowsByNegocio([rowA1, rowB1, rowA2]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.negocioId === "negocio-a")?.rows).toEqual([rowA1, rowA2]);
    expect(groups.find((g) => g.negocioId === "negocio-b")?.rows).toEqual([rowB1]);
  });

  it("should order the groups by each business's FIRST row, the id order the query returned", () => {
    // negocio-b's row appears first in the input, so its group must come first, even
    // though negocio-a has more rows overall.
    const rowB = divergentRow({ negocioId: "negocio-b", productoTiendaId: "b-1" });
    const rowA1 = divergentRow({ negocioId: "negocio-a", productoTiendaId: "a-1" });
    const rowA2 = divergentRow({ negocioId: "negocio-a", productoTiendaId: "a-2" });

    const groups = groupDivergentRowsByNegocio([rowB, rowA1, rowA2]);

    expect(groups.map((g) => g.negocioId)).toEqual(["negocio-b", "negocio-a"]);
  });

  it("should return [] for an empty input", () => {
    expect(groupDivergentRowsByNegocio([])).toEqual([]);
  });
});

describe("chunkDivergentRows", () => {
  it("should return a single page when rows fit under QAB_AVAILABILITY_BATCH_SIZE", () => {
    const rows = [divergentRow({ productoTiendaId: "pt-1" }), divergentRow({ productoTiendaId: "pt-2" })];
    expect(chunkDivergentRows(rows)).toEqual([rows]);
  });

  it("should return [] for an empty input — an empty page is never produced", () => {
    expect(chunkDivergentRows([])).toEqual([]);
  });

  it(`should split exactly QAB_AVAILABILITY_BATCH_SIZE + 1 rows into a full page and a page of ONE`, () => {
    const rows = Array.from({ length: QAB_AVAILABILITY_BATCH_SIZE + 1 }, (_, i) =>
      divergentRow({ productoTiendaId: `pt-${i}` })
    );

    const pages = chunkDivergentRows(rows);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(QAB_AVAILABILITY_BATCH_SIZE);
    expect(pages[1]).toHaveLength(1);
  });

  it("should never produce a page larger than QAB_AVAILABILITY_BATCH_SIZE, with more than double the cap", () => {
    const total = QAB_AVAILABILITY_BATCH_SIZE * 2 + 37;
    const rows = Array.from({ length: total }, (_, i) => divergentRow({ productoTiendaId: `pt-${i}` }));

    const pages = chunkDivergentRows(rows);

    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(QAB_AVAILABILITY_BATCH_SIZE);
    }
    expect(pages.reduce((sum, page) => sum + page.length, 0)).toBe(total);
  });

  it("should preserve row order across pages", () => {
    const rows = Array.from({ length: QAB_AVAILABILITY_BATCH_SIZE + 5 }, (_, i) =>
      divergentRow({ productoTiendaId: `pt-${i}` })
    );

    const pages = chunkDivergentRows(rows);
    const flattened = pages.flat();

    expect(flattened).toEqual(rows);
  });
});

describe("toQabAvailabilityBatch", () => {
  it("should map productoTiendaId/tiendaId/availability to storeProductId/storeId/availability", () => {
    const row = divergentRow({
      productoTiendaId: "pt-1",
      tiendaId: "tienda-1",
      availability: "LOW_STOCK",
    });

    const batch = toQabAvailabilityBatch("negocio-1", [row]);

    expect(batch).toEqual({
      businessId: "negocio-1",
      items: [{ storeProductId: "pt-1", storeId: "tienda-1", availability: "LOW_STOCK" }],
    });
  });

  it("should produce an item with EXACTLY these three keys, no more — never a spread of the row (criterion 3)", () => {
    const row = divergentRow({ negocioId: "negocio-1" });

    const batch = toQabAvailabilityBatch("negocio-1", [row]);

    expect(Object.keys(batch)).toEqual(["businessId", "items"]);
    expect(Object.keys(batch.items[0])).toEqual(["storeProductId", "storeId", "availability"]);
  });

  it("should never leak negocioId onto an item, even though the source row carries it", () => {
    const batch = toQabAvailabilityBatch("negocio-1", [divergentRow()]);
    expect(batch.items[0]).not.toHaveProperty("negocioId");
  });

  it("should never leak existencia or umbralBajo onto an item, if a future row grows one", () => {
    const rowWithExtraFields = {
      ...divergentRow(),
      existencia: 3,
      umbralBajo: 5,
    } as IQabDivergentRow;

    const batch = toQabAvailabilityBatch("negocio-1", [rowWithExtraFields]);

    expect(batch.items[0]).not.toHaveProperty("existencia");
    expect(batch.items[0]).not.toHaveProperty("umbralBajo");
  });

  it("should preserve row order in items", () => {
    const rows = [
      divergentRow({ productoTiendaId: "pt-1" }),
      divergentRow({ productoTiendaId: "pt-2" }),
      divergentRow({ productoTiendaId: "pt-3" }),
    ];

    const batch = toQabAvailabilityBatch("negocio-1", rows);

    expect(batch.items.map((item) => item.storeProductId)).toEqual(["pt-1", "pt-2", "pt-3"]);
  });

  it("should throw QabAvailabilityTenantMismatchError when a row belongs to another business", () => {
    const foreign = divergentRow({ negocioId: "negocio-ajeno" });
    expect(() => toQabAvailabilityBatch("negocio-1", [foreign])).toThrow(
      QabAvailabilityTenantMismatchError
    );
  });

  it("should throw even when only ONE row among many belongs to another business", () => {
    const own = divergentRow({ negocioId: "negocio-1", productoTiendaId: "pt-1" });
    const foreign = divergentRow({ negocioId: "negocio-2", productoTiendaId: "pt-2" });
    expect(() => toQabAvailabilityBatch("negocio-1", [own, foreign])).toThrow(
      QabAvailabilityTenantMismatchError
    );
  });

  it("should throw QabAvailabilityTenantMismatchError on an EMPTY rows array — a non-empty page is an invariant", () => {
    expect(() => toQabAvailabilityBatch("negocio-1", [])).toThrow(
      QabAvailabilityTenantMismatchError
    );
  });

  it("should not treat an empty negocioId as matching an empty row negocioId", () => {
    const row = divergentRow({ negocioId: "" });
    expect(() => toQabAvailabilityBatch("negocio-1", [row])).toThrow(
      QabAvailabilityTenantMismatchError
    );
  });
});

describe("planAvailabilityWrites — the full truth table of ADR 0050", () => {
  const sentA = divergentRow({
    productoTiendaId: "pt-a",
    tiendaId: "tienda-1",
    availability: "OUT_OF_STOCK",
  });
  const sentB = divergentRow({
    productoTiendaId: "pt-b",
    tiendaId: "tienda-1",
    availability: "LOW_STOCK",
  });
  const sentC = divergentRow({
    productoTiendaId: "pt-c",
    tiendaId: "tienda-2",
    availability: "AVAILABLE",
  });

  function okOutcome(confirmed: Array<[string, string]>): IQabAvailabilityPostOutcome {
    return { kind: "ok", response: { applied: confirmed.length, confirmed } };
  }

  it('should write NOTHING when outcome.kind is "error"', () => {
    const outcome: IQabAvailabilityPostOutcome = { kind: "error", error: "TRANSPORT:timeout" };

    expect(planAvailabilityWrites([sentA, sentB], outcome)).toEqual({ groups: [], confirmed: 0 });
  });

  it("should put a fully matching pair (storeProductId AND storeId) in the group of its OWN sent availability", () => {
    const outcome = okOutcome([["pt-a", "tienda-1"]]);

    const plan = planAvailabilityWrites([sentA], outcome);

    expect(plan).toEqual({
      groups: [{ availability: "OUT_OF_STOCK", productoTiendaIds: ["pt-a"] }],
      confirmed: 1,
    });
  });

  it("should IGNORE a confirmed pair whose storeProductId is not among the sent rows", () => {
    const outcome = okOutcome([["pt-unknown", "tienda-1"]]);

    expect(planAvailabilityWrites([sentA], outcome)).toEqual({ groups: [], confirmed: 0 });
  });

  it("should IGNORE a confirmed pair whose storeId does NOT match the storeId of the sent row with that storeProductId — a manipulated response (ADR 0050)", () => {
    // pt-a was sent with tiendaId "tienda-1". A response claiming it belongs to
    // "tienda-999" must not authorise the write: crossing by storeProductId alone
    // would let a hostile or buggy response point a real product at another tienda.
    const outcome = okOutcome([["pt-a", "tienda-999"]]);

    expect(planAvailabilityWrites([sentA], outcome)).toEqual({ groups: [], confirmed: 0 });
  });

  it("should count a repeated confirmed pair only ONCE", () => {
    const outcome = okOutcome([
      ["pt-a", "tienda-1"],
      ["pt-a", "tienda-1"],
    ]);

    const plan = planAvailabilityWrites([sentA], outcome);

    expect(plan.groups).toEqual([{ availability: "OUT_OF_STOCK", productoTiendaIds: ["pt-a"] }]);
    expect(plan.confirmed).toBe(1);
  });

  it("should leave a sent row NOT written when it is absent from confirmed — it stays divergent", () => {
    const outcome = okOutcome([["pt-a", "tienda-1"]]); // pt-b not confirmed

    const plan = planAvailabilityWrites([sentA, sentB], outcome);

    const allWrittenIds = plan.groups.flatMap((g) => g.productoTiendaIds);
    expect(allWrittenIds).toEqual(["pt-a"]);
    expect(allWrittenIds).not.toContain("pt-b");
    expect(plan.confirmed).toBe(1);
  });

  it("should order groups by QAB_AVAILABILITY (OUT_OF_STOCK, LOW_STOCK, AVAILABLE), regardless of confirmation order", () => {
    // Confirm AVAILABLE (sentC) before OUT_OF_STOCK (sentA) and LOW_STOCK (sentB).
    const outcome = okOutcome([
      ["pt-c", "tienda-2"],
      ["pt-a", "tienda-1"],
      ["pt-b", "tienda-1"],
    ]);

    const plan = planAvailabilityWrites([sentA, sentB, sentC], outcome);

    expect(plan.groups.map((g) => g.availability)).toEqual(QAB_AVAILABILITY);
    expect(plan.confirmed).toBe(3);
  });

  it("should keep the ids WITHIN a group in the order they were SENT, not the order confirmed", () => {
    const sentA2 = divergentRow({ productoTiendaId: "pt-a2", tiendaId: "tienda-1", availability: "AVAILABLE" });
    const sentA3 = divergentRow({ productoTiendaId: "pt-a3", tiendaId: "tienda-1", availability: "AVAILABLE" });
    // Confirmed in reverse order of how they were sent.
    const outcome = okOutcome([
      ["pt-a3", "tienda-1"],
      ["pt-a2", "tienda-1"],
    ]);

    const plan = planAvailabilityWrites([sentA2, sentA3], outcome);

    expect(plan.groups).toEqual([
      { availability: "AVAILABLE", productoTiendaIds: ["pt-a2", "pt-a3"] },
    ]);
  });

  it("should set confirmed to the SUM of the group sizes, not the count of confirmed pairs in the response", () => {
    // The response confirms 4 pairs, but one is unknown and one is a storeId mismatch:
    // only 2 sent rows actually get written.
    const outcome = okOutcome([
      ["pt-a", "tienda-1"],
      ["pt-b", "tienda-1"],
      ["pt-unknown", "tienda-1"],
      ["pt-a", "tienda-999"],
    ]);

    const plan = planAvailabilityWrites([sentA, sentB], outcome);

    const totalIds = plan.groups.reduce((sum, g) => sum + g.productoTiendaIds.length, 0);
    expect(plan.confirmed).toBe(totalIds);
    expect(plan.confirmed).toBe(2);
  });

  it("should return { groups: [], confirmed: 0 } when confirmed is empty", () => {
    const outcome = okOutcome([]);
    expect(planAvailabilityWrites([sentA, sentB], outcome)).toEqual({ groups: [], confirmed: 0 });
  });

  it("should never produce an empty group", () => {
    const outcome = okOutcome([["pt-a", "tienda-1"]]);
    const plan = planAvailabilityWrites([sentA, sentB], outcome);
    for (const group of plan.groups) {
      expect(group.productoTiendaIds.length).toBeGreaterThan(0);
    }
  });
});

describe("emptyQabAvailabilityPhaseReport", () => {
  it("should return every counter at zero, capped false and byBusiness empty", () => {
    expect(emptyQabAvailabilityPhaseReport()).toEqual({
      rows: 0,
      capped: false,
      businesses: 0,
      requests: 0,
      confirmed: 0,
      written: 0,
      byBusiness: [],
    });
  });

  it("should satisfy qabAvailabilityPhaseReportSchema", () => {
    expect(qabAvailabilityPhaseReportSchema.safeParse(emptyQabAvailabilityPhaseReport()).success).toBe(
      true
    );
  });
});

describe("normalizeSqlWhitespace", () => {
  it("should collapse a run of spaces into a single space", () => {
    expect(normalizeSqlWhitespace("a    b")).toBe("a b");
  });

  it("should collapse tabs and newlines into a single space", () => {
    expect(normalizeSqlWhitespace("a\t\tb\n\nc")).toBe("a b c");
  });

  it("should trim leading and trailing whitespace", () => {
    expect(normalizeSqlWhitespace("   a b   ")).toBe("a b");
  });

  it("should leave already-normalised text untouched", () => {
    expect(normalizeSqlWhitespace("a b c")).toBe("a b c");
  });

  it("should treat differently indented but equivalent SQL as equal", () => {
    const a = `CASE WHEN existencia <= 0             THEN 'OUT_OF_STOCK'
            WHEN existencia <= "umbralBajo"  THEN 'LOW_STOCK'
            ELSE                                  'AVAILABLE' END`;
    const b = `CASE WHEN existencia <= 0 THEN 'OUT_OF_STOCK' WHEN existencia <= "umbralBajo" THEN 'LOW_STOCK' ELSE 'AVAILABLE' END`;

    expect(normalizeSqlWhitespace(a)).toBe(normalizeSqlWhitespace(b));
  });
});

describe("QAB_AVAILABILITY_CASE_SQL vs the F-001 migration — static drift check (ADR 0048)", () => {
  it("should be a literal, whitespace-insensitive substring of the migration that created idx_disp_divergente", () => {
    // Deterministic, no database: this is the defense against the expression written in
    // the query silently falling out of sync with the one Postgres actually indexed
    // (E-014). It does NOT prove the index is used with real volume — that is QA's job
    // with EXPLAIN (ANALYZE, BUFFERS) against a seeded table (E-023) — it only proves the
    // two texts have not diverged.
    const migrationPath = path.join(process.cwd(), QAB_DIVERGENCE_INDEX_MIGRATION_PATH);
    const migrationText = readFileSync(migrationPath, "utf8");

    expect(normalizeSqlWhitespace(migrationText)).toContain(
      normalizeSqlWhitespace(QAB_AVAILABILITY_CASE_SQL)
    );
  });

  it("should not be an empty string — a vacuous substring check would pass against anything", () => {
    expect(normalizeSqlWhitespace(QAB_AVAILABILITY_CASE_SQL).length).toBeGreaterThan(20);
  });
});

/**
 * ADR 0051 / contract § "Obligatorio: regresión a escala de página completa". This is the
 * gap that let the stall through cycle 1: every fixture used a handful of items, so nothing
 * dimensioned by QAB_AVAILABILITY_BATCH_SIZE was ever exercised at the size that actually
 * breaks. Two DIFFERENT things need covering, and they are not the same test:
 *
 * 1. The arithmetic relation between QAB_AVAILABILITY_MAX_RESPONSE_BYTES and
 *    maxAvailabilityResponseBytes(BATCH_SIZE) — required by the contract, but it derives
 *    both sides from the SAME two constants, so it holds by construction and only breaks if
 *    someone edits the arithmetic itself.
 * 2. The assumption NEITHER side of that relation checks: that a real emitted id actually
 *    fits QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES. That budget is a guess about id length,
 *    not a derived number, and nothing above notices if the guess stops holding — a longer id
 *    (a bigger cuid2, a composite, a tenant prefix) reproduces the exact silent stall this
 *    cycle exists to close, and the constants-only assertion would keep passing regardless.
 */
describe("maxAvailabilityResponseBytes and QAB_AVAILABILITY_MAX_RESPONSE_BYTES (ADR 0051)", () => {
  it("QAB_AVAILABILITY_MAX_RESPONSE_BYTES must cover a full confirmation of QAB_AVAILABILITY_BATCH_SIZE items — the one-line assertion the contract requires, so nobody can move one constant without recomputing the other", () => {
    expect(QAB_AVAILABILITY_MAX_RESPONSE_BYTES).toBeGreaterThanOrEqual(
      maxAvailabilityResponseBytes(QAB_AVAILABILITY_BATCH_SIZE)
    );
  });

  it("should grow with items — a constant function would make the relation above meaningless", () => {
    expect(maxAvailabilityResponseBytes(QAB_AVAILABILITY_BATCH_SIZE)).toBeGreaterThan(
      maxAvailabilityResponseBytes(0)
    );
  });
});

describe("QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES vs a REAL id, not a hand-picked stand-in", () => {
  const schemaText = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

  /** The literal `id ... @default(...)` line inside `model <name> { ... }`. */
  function idFieldDeclarationOf(modelName: string): string {
    const modelBlock = schemaText.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
    if (!modelBlock) {
      throw new Error(`model ${modelName} not found in prisma/schema.prisma`);
    }
    const idLine = modelBlock[0].split("\n").find((line) => /^\s*id\s+String/.test(line));
    if (!idLine) {
      throw new Error(`model ${modelName} has no "id String" field in prisma/schema.prisma`);
    }
    return idLine;
  }

  it("ProductoTienda.id and Tienda.id must still be @default(uuid()) — the tripwire for the assumption the next test measures: 36-character ids. If this ever fails, the byte budget below must be re-derived, not silently trusted", () => {
    expect(idFieldDeclarationOf("ProductoTienda")).toContain("@default(uuid())");
    expect(idFieldDeclarationOf("Tienda")).toContain("@default(uuid())");
  });

  it("a confirmed entry built from two REAL generated ids must fit QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES — this is the assumption that stalls a business forever if it stops holding, not the arithmetic between the two constants derived from each other", () => {
    // node:crypto's randomUUID() is the same RFC 4122 v4 shape Prisma's
    // `uuid()` default produces: 36 characters. A hardcoded stand-in string
    // would keep "passing" even if the real generator's output changed length;
    // this measures an id actually produced the way the schema produces one.
    const pair: [string, string] = [randomUUID(), randomUUID()];
    // The trailing "," accounts for the separator `JSON.stringify` inserts
    // between array entries when `confirmed` holds more than one pair.
    const entryBytes = Buffer.byteLength(JSON.stringify(pair) + ",", "utf8");

    expect(entryBytes).toBeLessThan(QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES);
  });

  it("should FAIL that same budget for an id long enough to break it — proves the check above discriminates instead of passing vacuously (E-008)", () => {
    // 65-character ids: a plausible stand-in for a longer generator (a bigger
    // cuid2, a tenant-prefixed composite id). Two of them no longer fit inside
    // QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES (128) the way two uuids do.
    const longId = "a".repeat(65);
    const pair: [string, string] = [longId, longId];
    const entryBytes = Buffer.byteLength(JSON.stringify(pair) + ",", "utf8");

    expect(entryBytes).toBeGreaterThan(QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES);
  });
});

describe("full page (QAB_AVAILABILITY_BATCH_SIZE) — every BATCH_SIZE-shaped symbol exercised at real scale", () => {
  function manyRows(n: number, negocioId = "negocio-1"): IQabDivergentRow[] {
    return Array.from({ length: n }, (_, i) =>
      divergentRow({
        negocioId,
        productoTiendaId: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, "0")}`,
        tiendaId: `11111111-2222-4333-8444-${String(i).padStart(12, "0")}`,
      })
    );
  }

  it("chunkDivergentRows should return a SINGLE page of exactly QAB_AVAILABILITY_BATCH_SIZE rows, not split", () => {
    const rows = manyRows(QAB_AVAILABILITY_BATCH_SIZE);

    const pages = chunkDivergentRows(rows);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(QAB_AVAILABILITY_BATCH_SIZE);
  });

  it("toQabAvailabilityBatch should build a full page that satisfies qabAvailabilityBatchSchema's own max — the exact boundary the contract's wire cap sits at", () => {
    const rows = manyRows(QAB_AVAILABILITY_BATCH_SIZE);

    const batch = toQabAvailabilityBatch("negocio-1", rows);

    expect(batch.items).toHaveLength(QAB_AVAILABILITY_BATCH_SIZE);
    expect(qabAvailabilityBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("planAvailabilityWrites should write ALL QAB_AVAILABILITY_BATCH_SIZE rows when every one is confirmed — confirmed and the summed group sizes both equal BATCH_SIZE, not a handful", () => {
    const rows = manyRows(QAB_AVAILABILITY_BATCH_SIZE);
    const confirmed: Array<[string, string]> = rows.map((row) => [row.productoTiendaId, row.tiendaId]);
    const outcome: IQabAvailabilityPostOutcome = {
      kind: "ok",
      response: { applied: confirmed.length, confirmed },
    };

    const plan = planAvailabilityWrites(rows, outcome);

    expect(plan.confirmed).toBe(QAB_AVAILABILITY_BATCH_SIZE);
    const totalIds = plan.groups.reduce((sum, group) => sum + group.productoTiendaIds.length, 0);
    expect(totalIds).toBe(QAB_AVAILABILITY_BATCH_SIZE);
  });
});
