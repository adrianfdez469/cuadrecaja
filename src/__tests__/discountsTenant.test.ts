import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NEGOCIO_A,
  NEGOCIO_B,
  NEGOCIO_C,
  TENANT_ISOLATION_FIXTURE_ROWS,
} from "./fixtures/threeTenants";

/**
 * F-022 — `src/lib/discounts/index.ts` (contract § 1.1, ADR 0082/0083/0084/0085).
 *
 * Criterion 5 ("a test per migrated function that fails if the negocioId filter is removed")
 * for the two functions of this module: `fetchDiscountRulesForTienda` and
 * `applyDiscountsForSale`. Both migrated pure where-builders — `discountRulesWhere` and
 * `discountProductMetaWhere` — get their own direct assertions too.
 *
 * `DiscountRule` is NOT in `TENANT_RELATION_PATH` and does not belong in the shared fixture
 * (contract § 5.1.4 / ADR 0082, 0085): its rows (including the orphan with `negocioId: null`)
 * are built by hand, right here. `productoTienda` rows for the second query of
 * `applyDiscountsForSale` DO reuse `TENANT_ISOLATION_FIXTURE_ROWS`, extended locally with the
 * `producto` metadata this feature exists to protect.
 *
 * `@/lib/prisma` is mocked (external dependency, never the code under test). This mock's
 * `findMany` handlers do REAL where-evaluation against the fixture rows below (via the local
 * `matchesWhere`, not shared with `tenantIsolation.test.ts` — contract § 5.1.2): if the
 * implementation drops the `negocioId` clause, the same mock returns MORE rows than the
 * assertions allow, and the test goes red for that reason alone.
 */

const findManyDiscountRule = vi.fn();
const findManyProductoTienda = vi.fn();
const findUniqueTienda = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    discountRule: { findMany: findManyDiscountRule },
    productoTienda: { findMany: findManyProductoTienda },
    tienda: { findUnique: findUniqueTienda },
  },
}));

const {
  discountRulesWhere,
  discountProductMetaWhere,
  fetchDiscountRulesForTienda,
  applyDiscountsForSale,
  applyDiscounts,
  DISCOUNT_RULE_SELECT,
} = await import("@/lib/discounts");

const { withTenantScope } = await import("@/lib/tenantScope");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------------------- */
/* A local where-evaluator. Understands scalar equality (including `null`),         */
/* `{ field: { in: [...] } }` and one-hop relation nesting — everything these two    */
/* `where`s use. Deliberately NOT imported from tenantIsolation.test.ts (§ 5.1.2).   */
/* ------------------------------------------------------------------------------- */

type WhereClause = Record<string, unknown>;
type FixtureRow = Record<string, unknown>;

function isInOperator(value: unknown): value is { in: readonly unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Array.isArray((value as { in?: unknown }).in)
  );
}

function isNestedClause(value: unknown): value is WhereClause {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesWhere(row: FixtureRow, where: WhereClause): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] === null;
    if (isInOperator(value)) return value.in.includes(row[key]);
    if (isNestedClause(value)) {
      return matchesWhere((row[key] ?? {}) as FixtureRow, value);
    }
    return row[key] === value;
  });
}

/* ------------------------------------------------------------------------------- */
/* discountRulesWhere — PURE (ADR 0082: strict equality, never an OR on the null)   */
/* ------------------------------------------------------------------------------- */

describe("discountRulesWhere", () => {
  it("builds exactly { isActive: true, negocioId } — no OR, nothing wider", () => {
    expect(discountRulesWhere({ negocioId: NEGOCIO_A })).toEqual({
      isActive: true,
      negocioId: NEGOCIO_A,
    });
  });

  it("does not admit a row whose negocioId is null (the orphan of ADR 0082)", () => {
    const where = discountRulesWhere({ negocioId: NEGOCIO_A });
    expect(matchesWhere({ isActive: true, negocioId: null }, where)).toBe(false);
  });

  it("does not admit a row of a different negocio (the homonym)", () => {
    const where = discountRulesWhere({ negocioId: NEGOCIO_A });
    expect(matchesWhere({ isActive: true, negocioId: NEGOCIO_B }, where)).toBe(false);
  });
});

/* ------------------------------------------------------------------------------- */
/* discountProductMetaWhere — PURE (ADR 0085: reuses withTenantScope, no hand-rolled */
/* `tienda: { negocioId }`)                                                          */
/* ------------------------------------------------------------------------------- */

describe("discountProductMetaWhere", () => {
  it("matches withTenantScope('productoTienda', { id: { in: ids } }, negocioId) exactly", () => {
    const productoTiendaIds = ["pt-a", "pt-b"];
    expect(
      discountProductMetaWhere({ negocioId: NEGOCIO_A, productoTiendaIds }),
    ).toEqual(
      withTenantScope("productoTienda", { id: { in: productoTiendaIds } }, NEGOCIO_A),
    );
  });
});

/* ------------------------------------------------------------------------------- */
/* fetchDiscountRulesForTienda — criteria 1, 2 and 5                                 */
/* ------------------------------------------------------------------------------- */

const DISCOUNT_RULE_BASE = {
  name: null,
  type: "PERCENTAGE",
  value: 10,
  appliesTo: "TICKET",
  isActive: true,
  conditions: null,
  startDate: null,
  endDate: null,
};

/** A/B/C plus the orphan (ADR 0082) — never derived from Tienda, so `tiendaId` is a fixed dummy. */
const DISCOUNT_RULE_ROWS = [
  { ...DISCOUNT_RULE_BASE, id: "rule-a", negocioId: NEGOCIO_A },
  { ...DISCOUNT_RULE_BASE, id: "rule-b", negocioId: NEGOCIO_B },
  { ...DISCOUNT_RULE_BASE, id: "rule-c", negocioId: NEGOCIO_C },
  { ...DISCOUNT_RULE_BASE, id: "rule-orphan", negocioId: null },
];

function seedDiscountRules() {
  findManyDiscountRule.mockImplementation(
    async ({ where }: { where: WhereClause }) =>
      DISCOUNT_RULE_ROWS.filter((row) => matchesWhere(row, where)),
  );
}

describe("fetchDiscountRulesForTienda", () => {
  it("returns exactly the rules of its own negocio (criterion 1)", async () => {
    seedDiscountRules();
    const rules = await fetchDiscountRulesForTienda({
      negocioId: NEGOCIO_A,
      tiendaId: "cualquier-tienda",
    });
    expect(rules.map((r) => r.id)).toEqual(["rule-a"]);
  });

  it("calls discountRule.findMany with discountRulesWhere(negocioId) and the existing select (criterion 5)", async () => {
    seedDiscountRules();
    await fetchDiscountRulesForTienda({ negocioId: NEGOCIO_A, tiendaId: "t" });
    expect(findManyDiscountRule).toHaveBeenCalledWith({
      where: discountRulesWhere({ negocioId: NEGOCIO_A }),
      select: DISCOUNT_RULE_SELECT,
    });
  });

  it("criterion 2, literally: an invented tiendaId with a real negocioId still returns that negocio's rules, and never looks up Tienda", async () => {
    seedDiscountRules();
    const rules = await fetchDiscountRulesForTienda({
      negocioId: NEGOCIO_A,
      tiendaId: "00000000-0000-0000-0000-000000000000",
    });
    expect(rules.map((r) => r.id)).toEqual(["rule-a"]);
    expect(findUniqueTienda).not.toHaveBeenCalled();
  });

  it("never returns the homonym's rule, for any of the three negocios (E-032 control included)", async () => {
    seedDiscountRules();
    const forA = await fetchDiscountRulesForTienda({ negocioId: NEGOCIO_A, tiendaId: "t" });
    const forB = await fetchDiscountRulesForTienda({ negocioId: NEGOCIO_B, tiendaId: "t" });
    const forC = await fetchDiscountRulesForTienda({ negocioId: NEGOCIO_C, tiendaId: "t" });

    expect(forA.map((r) => r.id)).toEqual(["rule-a"]);
    expect(forB.map((r) => r.id)).toEqual(["rule-b"]);
    expect(forC.map((r) => r.id)).toEqual(["rule-c"]);
  });

  it("never returns the orphan row (negocioId: null), for any negocio", async () => {
    seedDiscountRules();
    for (const negocioId of [NEGOCIO_A, NEGOCIO_B, NEGOCIO_C]) {
      const rules = await fetchDiscountRulesForTienda({ negocioId, tiendaId: "t" });
      expect(rules.some((r) => r.id === "rule-orphan")).toBe(false);
    }
  });

  it("returns [] out of tenant, per ADR 0084 (a negocio with no rules)", async () => {
    seedDiscountRules();
    const rules = await fetchDiscountRulesForTienda({
      negocioId: "negocio-que-no-existe",
      tiendaId: "t",
    });
    expect(rules).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------- */
/* applyDiscountsForSale — criterion 5, and the second query E-042 exists to close  */
/* ------------------------------------------------------------------------------- */

const [ptBaseA, ptBaseB, ptBaseC] = TENANT_ISOLATION_FIXTURE_ROWS.productoTienda;

const PRODUCTO_TIENDA_ROWS = [
  { ...ptBaseA, id: "pt-a", producto: { id: "prod-a", categoriaId: "cat-a" } },
  { ...ptBaseB, id: "pt-b", producto: { id: "prod-b", categoriaId: "cat-b" } },
  { ...ptBaseC, id: "pt-c", producto: { id: "prod-c", categoriaId: "cat-c" } },
];

describe("applyDiscountsForSale", () => {
  it("scopes its second query (product metadata) with discountProductMetaWhere(negocioId, ids), the exact hole E-042 named", async () => {
    findManyDiscountRule.mockResolvedValue([]);
    findManyProductoTienda.mockImplementation(
      async ({ where }: { where: WhereClause }) =>
        PRODUCTO_TIENDA_ROWS.filter((row) => matchesWhere(row, where)),
    );

    const products = [
      { productoTiendaId: "pt-a", cantidad: 1, precio: 100 },
      { productoTiendaId: "pt-b", cantidad: 1, precio: 100 },
    ];

    await applyDiscountsForSale({
      negocioId: NEGOCIO_A,
      tiendaId: ptBaseA.tiendaId as string,
      products,
      discountCodes: [],
    });

    expect(findManyProductoTienda).toHaveBeenCalledTimes(1);
    expect(findManyProductoTienda.mock.calls[0][0].where).toEqual(
      discountProductMetaWhere({
        negocioId: NEGOCIO_A,
        productoTiendaIds: ["pt-a", "pt-b"],
      }),
    );
  });

  it("cannot see another negocio's category metadata even when the sale lines reference its productoTiendaId — a CATEGORY rule on the homonym's category must NOT apply", async () => {
    findManyDiscountRule.mockResolvedValue([
      {
        id: "rule-cat-b",
        name: "Descuento categoría B",
        type: "PERCENTAGE",
        value: 50,
        appliesTo: "CATEGORY",
        isActive: true,
        conditions: { categoryIds: ["cat-b"] },
        startDate: null,
        endDate: null,
      },
    ]);
    findManyProductoTienda.mockImplementation(
      async ({ where }: { where: WhereClause }) =>
        PRODUCTO_TIENDA_ROWS.filter((row) => matchesWhere(row, where)),
    );

    const result = await applyDiscountsForSale({
      negocioId: NEGOCIO_A,
      tiendaId: ptBaseA.tiendaId as string,
      products: [{ productoTiendaId: "pt-b", cantidad: 1, precio: 100 }],
      discountCodes: [],
    });

    // If the second query leaked pt-b's real metadata (categoriaId "cat-b") into a
    // negocio-A call, this CATEGORY rule would match and discount 50. Correctly scoped,
    // pt-b's metadata never resolves under negocio A, so nothing is affected.
    expect(result.discountTotal).toBe(0);
    expect(result.applied).toEqual([]);
  });

  it("returns what applyDiscounts produces with rules: [] out of tenant — not paraphrased here (E-039, ADR 0084)", async () => {
    findManyDiscountRule.mockResolvedValue([]);
    findManyProductoTienda.mockResolvedValue([]);

    const products = [{ productoTiendaId: "cualquiera", cantidad: 2, precio: 50 }];
    const result = await applyDiscountsForSale({
      negocioId: "negocio-que-no-existe",
      tiendaId: "tienda-que-no-existe",
      products,
      discountCodes: [],
    });

    expect(result).toEqual(
      applyDiscounts({ rules: [], products, productMeta: {}, discountCodes: [] }),
    );
  });
});
