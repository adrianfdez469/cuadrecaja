import { describe, it, expect } from "vitest";
import {
  computeQabCatalogHash,
  qabMirrorPriceToken,
  compareQabMirrorIds,
  qabMirrorRowToken,
} from "@/lib/qab/qabReconciliationHash";
import {
  QAB_RECONCILIATION_FIELD_SEPARATOR,
  QAB_RECONCILIATION_ROW_SEPARATOR,
} from "@/constants/qab";
import type { IQabMirrorRow } from "@/schemas/qabReconciliation";

/**
 * F-008 — `src/lib/qab/qabReconciliationHash.ts` (contract § 4.1), against
 * `.agents/specs/F-008.md`. This is the heart of the feature and the ONLY module the
 * unmodified acceptance criterion 6 exercises directly.
 *
 * Everything here is written against filed-in rows, never a database client — that is
 * what makes criterion 6 runnable under Vitest at all. The four values pinned below
 * (`products: 4`, the vector's hash, and the empty-store hash) are copied verbatim from
 * the contract's own § 5, which the arch-guardian verified by executing the SQL mirror.
 * A mismatch here means an error on THIS side (the row-token format, the separators, the
 * price rule), never a stale expected value — see the contract's rule of arbitraje (§ 3).
 *
 * The byte-order case (describe block below) is NOT in the § 5 vector: `a`, `b`, `c`, `d`
 * sort identically under any collation, so the vector cannot discriminate
 * `Buffer.compare` from `localeCompare`. The pair `"B"` / `"a"` was checked in Node
 * before writing this file (`Buffer.compare` puts `"B"` first; `"B".localeCompare("a")`
 * puts it last), so it is a case that actually distinguishes the two readings (E-008).
 */

function vectorRow(id: string, precio: number): IQabMirrorRow {
  return { id, precio, monedaPrecioCode: "CUP", dispPublicada: "AVAILABLE" };
}

const vectorRows: IQabMirrorRow[] = [
  vectorRow("a", 1990.0),
  vectorRow("b", 1990.5),
  vectorRow("c", 1990.1),
  vectorRow("d", 0.0),
];

describe("computeQabCatalogHash", () => {
  it("criterion 6: the § 5 vector gives products: 4 and the contract's own hash — copied, not recalculated", () => {
    expect(computeQabCatalogHash(vectorRows)).toEqual({
      products: 4,
      hash: "62e399684e3a8eafadaae58391537955",
    });
  });

  it("gives the same result regardless of the input's own order — the vector's own order (a,b,c,d) alone would not prove any sorting happens", () => {
    const shuffled = [vectorRows[2], vectorRows[0], vectorRows[3], vectorRows[1]];
    expect(computeQabCatalogHash(shuffled)).toEqual({
      products: 4,
      hash: "62e399684e3a8eafadaae58391537955",
    });
  });

  it("criterion 3: a published store with no rows gives products: 0 and the md5 of the empty string — copied, not recalculated", () => {
    expect(computeQabCatalogHash([])).toEqual({
      products: 0,
      hash: "d41d8cd98f00b204e9800998ecf8427e",
    });
  });

  it("does not mutate its argument: the input array keeps its given order after the call", () => {
    const rows: IQabMirrorRow[] = [
      vectorRow("d", 1),
      vectorRow("c", 1),
      vectorRow("b", 1),
      vectorRow("a", 1),
    ];
    const idsBefore = rows.map((r) => r.id);

    computeQabCatalogHash(rows);

    expect(rows.map((r) => r.id)).toEqual(idsBefore);
    expect(rows.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("dispPublicada: null counts as AVAILABLE — a row differing only there gives the same hash as one with AVAILABLE spelled out", () => {
    const withNull = computeQabCatalogHash([
      { id: "a", precio: 10, monedaPrecioCode: "CUP", dispPublicada: null },
    ]);
    const withAvailable = computeQabCatalogHash([
      { id: "a", precio: 10, monedaPrecioCode: "CUP", dispPublicada: "AVAILABLE" },
    ]);

    expect(withNull).toEqual(withAvailable);
  });

  describe("byte order, not a language collation (COLLATE \"C\")", () => {
    it('orders "B" before "a", matching Buffer.compare and NOT String#localeCompare', () => {
      // Control, checked in Node before writing this file: this pair really
      // does discriminate the two readings. If it didn't, the assertions
      // below would pass under either implementation and prove nothing.
      expect(Buffer.compare(Buffer.from("B", "utf8"), Buffer.from("a", "utf8"))).toBeLessThan(0);
      expect("B".localeCompare("a")).toBeGreaterThan(0);

      const rows: IQabMirrorRow[] = [
        vectorRow("a", 10), // listed first in the input, on purpose
        vectorRow("B", 10),
      ];

      const result = computeQabCatalogHash(rows);

      // Computed independently in Node from the row-token format the
      // contract's own docstrings specify (id:price:moneda:disp|), for the
      // byte order ("B" then "a") and, as a negative, for the locale order
      // ("a" then "B") a localeCompare-based implementation would produce.
      expect(result).toEqual({ products: 2, hash: "b135db6b89b306fdb99fa93ec3672b77" });
      expect(result.hash).not.toBe("d3ddbf22c11cbeef6b617e362f2e9138");
    });
  });
});

describe("qabMirrorPriceToken", () => {
  it.each([
    [1990.0, "1990"],
    [1990.5, "1990.5"],
    [1990.1, "1990.1"],
    [0.0, "0"],
  ])("qabMirrorPriceToken(%s) === %s — the four tokens of the § 5 vector, one by one", (precio, expected) => {
    expect(qabMirrorPriceToken(precio)).toBe(expected);
  });
});

describe("compareQabMirrorIds", () => {
  it("is negative when a sorts first in bytes, positive when b does, 0 when equal", () => {
    expect(compareQabMirrorIds("a", "b")).toBeLessThan(0);
    expect(compareQabMirrorIds("b", "a")).toBeGreaterThan(0);
    expect(compareQabMirrorIds("a", "a")).toBe(0);
  });

  it('orders "B" before "a" (byte order), the opposite of what a locale collation would give', () => {
    expect(compareQabMirrorIds("B", "a")).toBeLessThan(0);
    expect(compareQabMirrorIds("a", "B")).toBeGreaterThan(0);
  });
});

describe("qabMirrorRowToken", () => {
  it("joins id, price token, currency and availability with the field separator and closes with the row separator", () => {
    const row = vectorRow("a", 1990.0);
    const expected =
      ["a", "1990", "CUP", "AVAILABLE"].join(QAB_RECONCILIATION_FIELD_SEPARATOR) +
      QAB_RECONCILIATION_ROW_SEPARATOR;

    expect(qabMirrorRowToken(row)).toBe(expected);
  });

  it("folds a null dispPublicada into AVAILABLE in the token itself", () => {
    const nullRow: IQabMirrorRow = { id: "a", precio: 1990.0, monedaPrecioCode: "CUP", dispPublicada: null };
    const availableRow: IQabMirrorRow = { id: "a", precio: 1990.0, monedaPrecioCode: "CUP", dispPublicada: "AVAILABLE" };

    expect(qabMirrorRowToken(nullRow)).toBe(qabMirrorRowToken(availableRow));
  });
});
