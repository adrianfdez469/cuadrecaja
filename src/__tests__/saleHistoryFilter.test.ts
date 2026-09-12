import { describe, expect, it } from "vitest";
import {
  matchesSaleSearchTerm,
  saleHistoryEmptyReason,
  type SaleHistorySearchFields,
  type SaleHistoryEmptyInput,
} from "@/lib/venta/saleHistoryFilter";
import {
  SALE_HISTORY_EMPTY_REASONS,
  type ISaleHistoryEmptyReason,
} from "@/constants/venta";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { saleReportedAt } from "@/lib/venta/saleTime";
import { toSaleTimestamps } from "@/lib/venta/ventaTimestamps";

/**
 * F-049 — contract § "Firmas públicas" (`src/lib/venta/saleHistoryFilter.ts`,
 * not yet written by the implementer at the time this file was written: this
 * suite is authored against `.agents/specs/F-049.md`'s interface contract,
 * without seeing any implementation).
 *
 * `matchesSaleSearchTerm` is moved BYTE FOR BYTE out of
 * `src/app/ventas/page.tsx`. Its quirks are NOT bugs to clean up:
 * - the user name folds case with `toLocaleLowerCase`, every other field with
 *   `toLowerCase`;
 * - `sale.id?.` is read defensively even though the schema types it required;
 * - the term is NEVER trimmed.
 * A test that assumes any of the three is "fixed" is testing a different
 * function than the one the contract prescribes.
 *
 * `saleHistoryEmptyReason` is new pure logic (E-015: it cannot live in the
 * `.tsx`). Its whole content is a precedence among five inputs, spelled out in
 * the contract's own table, reproduced here.
 *
 * Trap this suite exists to catch (E-016, adenda F-047, 6th appearance):
 * `formatDateTime` returns `dd/mm/yyyy` + `" • "` + `HH:mm:ss` — its own JSDoc
 * says `HH:mm` and LIES. Every expected date/time value below is built by
 * CALLING formatDate/formatDateTime, never by writing a literal like "14:30".
 */

// A fixed instant, built once so every test in this file reasons about the
// same wall-clock value. Local time (matches what the device / Date
// constructor with numeric args produces), September 10 2026, 14:30:45.
const REPORTED_AT = new Date(2026, 8, 10, 14, 30, 45);

function makeSale(
  overrides: Partial<SaleHistorySearchFields> = {},
): SaleHistorySearchFields {
  return {
    id: "venta-001-ABC",
    createdAt: REPORTED_AT,
    frontendCreatedAt: undefined,
    productos: [{ name: "Café Ñandú" }, { name: "Pan integral" }],
    usuario: { nombre: "María López" },
    ...overrides,
  };
}

describe("matchesSaleSearchTerm", () => {
  // 1. Empty term matches every sale — the identity of "search off", and half
  // of acceptance criterion 4 (deactivating the trace filter must not hide
  // anything the search itself would have hidden).
  describe("empty term — the identity of the predicate", () => {
    it("matches a fully-populated sale", () => {
      expect(matchesSaleSearchTerm(makeSale(), "")).toBe(true);
    });

    it("matches a sale with no productos and no usuario too", () => {
      const sale = makeSale({ productos: undefined, usuario: undefined });
      expect(matchesSaleSearchTerm(sale, "")).toBe(true);
    });
  });

  // 2. Matches by id, by product name, and by user name, each in isolation:
  // the other fields deliberately do NOT contain the term, so a match can
  // only have come from the field under test.
  describe("matches by a single field, in isolation", () => {
    it("matches by id", () => {
      const sale = makeSale({
        id: "venta-001-ABC",
        productos: [{ name: "Producto genérico" }],
        usuario: { nombre: "Usuario genérico" },
      });
      expect(matchesSaleSearchTerm(sale, "001-abc")).toBe(true);
    });

    it("matches by product name", () => {
      const sale = makeSale({
        id: "venta-000-XYZ",
        productos: [{ name: "Café Ñandú" }],
        usuario: { nombre: "Zzz Qqq" },
      });
      expect(matchesSaleSearchTerm(sale, "ñandú")).toBe(true);
    });

    it("matches by user name", () => {
      const sale = makeSale({
        id: "venta-000-XYZ",
        productos: [{ name: "Producto genérico" }],
        usuario: { nombre: "María López" },
      });
      expect(matchesSaleSearchTerm(sale, "lópez")).toBe(true);
    });
  });

  // 3. Matches by the FORMATTED date and time, expected values built by
  // calling the real formatters — never a hand-written literal.
  describe("matches against the formatted date and time", () => {
    it("matches the formatted date, built via formatDate on the sale's reported instant", () => {
      const sale = makeSale({
        createdAt: REPORTED_AT,
        frontendCreatedAt: undefined,
      });
      const reportedAt = saleReportedAt(toSaleTimestamps(sale));
      const expectedDate = formatDate(reportedAt);
      expect(matchesSaleSearchTerm(sale, expectedDate)).toBe(true);
    });

    it("matches the time-of-day portion of formatDateTime, which includes SECONDS despite its HH:mm JSDoc", () => {
      const sale = makeSale({
        createdAt: REPORTED_AT,
        frontendCreatedAt: undefined,
      });
      const reportedAt = saleReportedAt(toSaleTimestamps(sale));
      const fullDateTime = formatDateTime(reportedAt);

      const bulletIndex = fullDateTime.indexOf(" • ");
      expect(bulletIndex).toBeGreaterThan(-1);
      const timePart = fullDateTime.slice(bulletIndex + " • ".length);

      // Verified by calling the formatter, not by trusting its JSDoc: the time
      // part carries three colon-separated components (HH:mm:ss), not two.
      expect(timePart.split(":")).toHaveLength(3);
      expect(matchesSaleSearchTerm(sale, timePart)).toBe(true);
    });

    it('matches a lone space term, because formatDateTime joins its halves with " • " and a single space is part of that separator', () => {
      // This is the same fact that makes the term NOT-trimmed observable: an
      // active term of just " " still matches every sale, via the date/time
      // fields' own separator.
      expect(matchesSaleSearchTerm(makeSale(), " ")).toBe(true);
    });

    it("matches against saleReportedAt's own precedence: frontendCreatedAt, when present, wins over createdAt", () => {
      const deviceInstant = new Date(2020, 0, 1, 8, 0, 0);
      const serverInstant = new Date(2026, 8, 10, 14, 30, 45);
      const sale = makeSale({
        createdAt: serverInstant,
        frontendCreatedAt: deviceInstant,
      });

      const expectedDeviceDate = formatDate(deviceInstant);
      const serverOnlyDate = formatDate(serverInstant);

      expect(matchesSaleSearchTerm(sale, expectedDeviceDate)).toBe(true);
      expect(matchesSaleSearchTerm(sale, serverOnlyDate)).toBe(false);
    });
  });

  // 4. Case folding in both directions.
  describe("case-insensitivity, in both directions", () => {
    it("matches an uppercase term against lowercase data", () => {
      const sale = makeSale({ usuario: { nombre: "maria lopez" } });
      expect(matchesSaleSearchTerm(sale, "MARIA")).toBe(true);
    });

    it("matches a lowercase term against uppercase data", () => {
      const sale = makeSale({ usuario: { nombre: "MARIA LOPEZ" } });
      expect(matchesSaleSearchTerm(sale, "maria")).toBe(true);
    });

    it("folds case on product names too", () => {
      const sale = makeSale({ productos: [{ name: "PAN INTEGRAL" }] });
      expect(matchesSaleSearchTerm(sale, "pan integral")).toBe(true);
    });
  });

  // 5. Missing optional fields must not throw, and must simply not match by
  // the missing field.
  describe("missing optional fields", () => {
    it("does not throw, and does not match by product, when productos is absent", () => {
      const sale = makeSale({
        productos: undefined,
        usuario: { nombre: "María López" },
      });
      expect(() => matchesSaleSearchTerm(sale, "pan")).not.toThrow();
      expect(matchesSaleSearchTerm(sale, "pan")).toBe(false);
    });

    it("does not throw, and does not match by user, when usuario is absent", () => {
      const sale = makeSale({
        usuario: undefined,
        productos: [{ name: "Pan" }],
      });
      expect(() => matchesSaleSearchTerm(sale, "lópez")).not.toThrow();
      expect(matchesSaleSearchTerm(sale, "lópez")).toBe(false);
    });

    it("does not throw when a product entry has no name", () => {
      const sale = makeSale({
        productos: [{ name: undefined }],
        usuario: { nombre: "María" },
      });
      expect(() => matchesSaleSearchTerm(sale, "algo")).not.toThrow();
    });

    it("does not throw when id is absent — the defensive `sale.id?.` the contract prescribes", () => {
      const sale = makeSale({
        id: undefined,
        productos: undefined,
        usuario: undefined,
      });
      expect(() => matchesSaleSearchTerm(sale, "anything")).not.toThrow();
      expect(matchesSaleSearchTerm(sale, "anything")).toBe(false);
    });
  });

  // 6. No match anywhere.
  it("returns false when the term matches nothing", () => {
    expect(matchesSaleSearchTerm(makeSale(), "zzz-no-such-term-zzz")).toBe(
      false,
    );
  });

  // 7. frontendCreatedAt absent: the date matched against is createdAt's,
  // because saleReportedAt already resolves the absence. No branch of its own
  // to test beyond this.
  it("matches against createdAt's formatted date when frontendCreatedAt is absent", () => {
    const sale = makeSale({
      createdAt: REPORTED_AT,
      frontendCreatedAt: undefined,
    });
    expect(matchesSaleSearchTerm(sale, formatDate(REPORTED_AT))).toBe(true);
  });

  // The trap: NOT trimmed. A trailing space that is not part of the actual
  // text breaks the match — if the implementation trimmed the term, this
  // would go green when it must go red.
  it("does NOT trim the term: a trailing space not present in the data breaks the match", () => {
    const sale = makeSale({
      usuario: { nombre: "María López" },
      productos: undefined,
      id: "x",
    });
    expect(matchesSaleSearchTerm(sale, "lópez ")).toBe(false);
    expect(matchesSaleSearchTerm(sale, "lópez")).toBe(true);
  });
});

describe("saleHistoryEmptyReason", () => {
  // The precedence table from the contract, reproduced verbatim. This is the
  // whole content of the function: get one row wrong and this table catches
  // it, because E-008 — a fixture that only tries the "obvious" branch would
  // let a reordered guard pass.
  const cases: Array<{
    description: string;
    input: SaleHistoryEmptyInput;
    expected: ISaleHistoryEmptyReason | null;
  }> = [
    {
      description: "rows visible, everything else off -> no message",
      input: {
        totalCount: 5,
        visibleCount: 3,
        searchTerm: "",
        syncTraceFilterActive: false,
        anySaleWithSyncTrace: false,
      },
      expected: null,
    },
    {
      description:
        "rows visible even with both controls on -> no message, whatever the other inputs say",
      input: {
        totalCount: 5,
        visibleCount: 1,
        searchTerm: "pan",
        syncTraceFilterActive: true,
        anySaleWithSyncTrace: true,
      },
      expected: null,
    },
    {
      description: "empty period, nothing active -> NO_SALES_IN_PERIOD",
      input: {
        totalCount: 0,
        visibleCount: 0,
        searchTerm: "",
        syncTraceFilterActive: false,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_IN_PERIOD",
    },
    {
      description:
        "empty period wins over a term AND the trace filter active -> NO_SALES_IN_PERIOD (the precedence this feature intentionally changes vs. today)",
      input: {
        totalCount: 0,
        visibleCount: 0,
        searchTerm: "pan",
        syncTraceFilterActive: true,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_IN_PERIOD",
    },
    {
      description:
        "criterion 6, literal: trace filter on, period holds no traced sale -> NO_SALES_WITH_SYNC_TRACE",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: "",
        syncTraceFilterActive: true,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_WITH_SYNC_TRACE",
    },
    {
      description:
        "the search term does not change the answer when there is no traced sale to search among",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: "pan",
        syncTraceFilterActive: true,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_WITH_SYNC_TRACE",
    },
    {
      description:
        "traced sales exist, the term excluded them all -> NO_TRACED_SALES_FOR_SEARCH",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: "pan",
        syncTraceFilterActive: true,
        anySaleWithSyncTrace: true,
      },
      expected: "NO_TRACED_SALES_FOR_SEARCH",
    },
    {
      description:
        "filter off: anySaleWithSyncTrace is not read -> NO_SALES_FOR_SEARCH even when true",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: "pan",
        syncTraceFilterActive: false,
        anySaleWithSyncTrace: true,
      },
      expected: "NO_SALES_FOR_SEARCH",
    },
    {
      description: "filter off, plain search miss -> NO_SALES_FOR_SEARCH",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: "pan",
        syncTraceFilterActive: false,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_FOR_SEARCH",
    },
    {
      description:
        "a single space IS an active term, same as today -> NO_SALES_FOR_SEARCH",
      input: {
        totalCount: 5,
        visibleCount: 0,
        searchTerm: " ",
        syncTraceFilterActive: false,
        anySaleWithSyncTrace: false,
      },
      expected: "NO_SALES_FOR_SEARCH",
    },
  ];

  it.each(cases)("$description", ({ input, expected }) => {
    expect(saleHistoryEmptyReason(input)).toBe(expected);
  });

  it("reaches all four values of SALE_HISTORY_EMPTY_REASONS across the table above — none of the four is dead", () => {
    const reached = new Set(
      cases
        .map(({ input }) => saleHistoryEmptyReason(input))
        .filter((r): r is ISaleHistoryEmptyReason => r !== null),
    );
    expect(reached).toEqual(new Set(SALE_HISTORY_EMPTY_REASONS));
  });

  it("never returns a value outside the closed vocabulary, or null", () => {
    for (const { input } of cases) {
      const result = saleHistoryEmptyReason(input);
      if (result !== null) {
        expect(SALE_HISTORY_EMPTY_REASONS).toContain(result);
      }
    }
  });
});
