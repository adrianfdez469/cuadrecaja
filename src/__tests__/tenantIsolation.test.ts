import { describe, it, expect, vi } from "vitest";
import type { ITenantScopedModel } from "@/constants/tenantScope";
import { readRouteGuardInventory, correctedByF021 } from "@/lib/routeGuards/routeInventory";
import {
  NEGOCIO_A,
  TENANT_ISOLATION_FIXTURE_ROWS,
  baseWhereFor,
  type IFixtureRow,
} from "./fixtures/threeTenants";

/**
 * F-021 — criterion 6 (a test per corrected route that fails if the negocioId filter is
 * removed) and criterion 10 (multi-tenant isolation, explicit) — designed exactly per
 * ADR 0080 and spec § 9.3.
 *
 * `@/lib/tenantScope` imports `@/lib/prisma` at module top level (for `assertTiendaTenant`,
 * which this file never calls) — mocked defensively, same as `tenantScope.test.ts`.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { withTenantScope } = await import("@/lib/tenantScope");

/* ------------------------------------------------------------------------------- */
/* The evaluator. Understands scalar equality, `{ field: { in: [...] } }`, and       */
/* relation nesting one and two hops deep — nothing more is needed for these 37      */
/* routes (ADR 0080).                                                               */
/* ------------------------------------------------------------------------------- */

type WhereClause = Record<string, unknown>;

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

function matchesWhere(row: IFixtureRow, where: WhereClause): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (isInOperator(value)) {
      return value.in.includes(row[key]);
    }
    if (isNestedClause(value)) {
      return matchesWhere((row[key] ?? {}) as IFixtureRow, value);
    }
    return row[key] === value;
  });
}

describe("matchesWhere (test helper sanity)", () => {
  it("matches scalar equality", () => {
    expect(matchesWhere({ id: "a" }, { id: "a" })).toBe(true);
    expect(matchesWhere({ id: "a" }, { id: "b" })).toBe(false);
  });

  it("matches `{ field: { in: [...] } }`", () => {
    expect(matchesWhere({ id: "a" }, { id: { in: ["a", "b"] } })).toBe(true);
    expect(matchesWhere({ id: "c" }, { id: { in: ["a", "b"] } })).toBe(false);
  });

  it("matches a one-hop nested relation clause", () => {
    const row = { tiendaId: "t1", tienda: { negocioId: "n1" } };
    expect(matchesWhere(row, { tienda: { negocioId: "n1" } })).toBe(true);
    expect(matchesWhere(row, { tienda: { negocioId: "n2" } })).toBe(false);
  });

  it("matches a two-hop nested relation clause", () => {
    const row = {
      cierrePeriodoId: "c1",
      cierrePeriodo: { tienda: { negocioId: "n1" } },
    };
    expect(matchesWhere(row, { cierrePeriodo: { tienda: { negocioId: "n1" } } })).toBe(
      true,
    );
    expect(matchesWhere(row, { cierrePeriodo: { tienda: { negocioId: "n2" } } })).toBe(
      false,
    );
  });

  it("requires ALL keys of `where` to match (implicit AND)", () => {
    const row = { tiendaId: "t1", tienda: { negocioId: "n1" } };
    expect(matchesWhere(row, { tiendaId: "t1", tienda: { negocioId: "n1" } })).toBe(
      true,
    );
    expect(matchesWhere(row, { tiendaId: "other", tienda: { negocioId: "n1" } })).toBe(
      false,
    );
  });
});

/* ------------------------------------------------------------------------------- */
/* The 37+ corrected-route cases, driven by the inventory (ADR 0080's it.each).      */
/* ------------------------------------------------------------------------------- */

/**
 * Reading the inventory can fail (e.g. the JSON does not exist yet, mid-implementation)
 * or it.each below would throw at collection time and take unrelated describes in this
 * SAME file down with it (E-019). Falling back to `[]` keeps the failure local to the
 * guard test right below, instead of tumbling the `matchesWhere` sanity checks above.
 */
function loadCorrectedEntries() {
  try {
    return correctedByF021(readRouteGuardInventory());
  } catch {
    return [];
  }
}

const correctedEntries = loadCorrectedEntries();

describe("tenant isolation — criteria 6, 9 and 10 (ADR 0080)", () => {
  // Guard against E-008 in its purest form: an `it.each` over an empty (or short) array
  // produces zero tests and a green suite. This is a real, always-collected `it` — not
  // a module-level throw — so it fails loudly on its own regardless of how many (if
  // any) cases `it.each` below manages to generate from a partial inventory.
  it("has at least 37 F-021-corrected entries in the inventory", () => {
    expect(correctedEntries.length).toBeGreaterThanOrEqual(37);
  });

  it.each(correctedEntries)(
    "$route $verb isolates $tenantModel by negocioId, not by a wider match",
    (entry) => {
      // Every F-021-corrected route adds the tenant axis, so every one of them must
      // name the model it scopes (schema invariant 2). A corrected entry missing this
      // is itself a defect in the inventory, and this failing case is how it surfaces.
      expect(entry.tenantModel).not.toBeNull();
      const model = entry.tenantModel as ITenantScopedModel;

      const rows = TENANT_ISOLATION_FIXTURE_ROWS[model];
      const [rowA, rowB, rowC] = rows;

      const baseWhere = baseWhereFor(model);
      const scopedWhere = withTenantScope(model, baseWhere, NEGOCIO_A);

      const withTenantClause = rows.filter((row) => matchesWhere(row, scopedWhere));
      const withoutTenantClause = rows.filter((row) => matchesWhere(row, baseWhere));

      // 1. With the tenant clause -> exactly one row, and it is N_A's.
      expect(withTenantClause).toHaveLength(1);
      expect(withTenantClause[0]).toBe(rowA);

      // 2. The SAME where, stripped of the tenant clause -> two rows (E-008: the
      //    fixture's homonym DOES make the two branches diverge — this is what proves
      //    the clause does real filtering work, not a no-op).
      expect(withoutTenantClause).toHaveLength(2);
      expect(withoutTenantClause).toContain(rowA);
      expect(withoutTenantClause).toContain(rowB);

      // 3. N_C — the control — never appears in either branch (E-032: a guard
      //    implemented wider than the contract, e.g. matching on something other than
      //    negocioId, would still pass 1 and 2 above and only this catches it).
      expect(withTenantClause).not.toContain(rowC);
      expect(withoutTenantClause).not.toContain(rowC);
    },
  );
});

describe("what this file deliberately does NOT promise (spec § 9.3)", () => {
  it("does not import any route.ts, start a server, or touch Postgres", () => {
    // Documented here so the `qa` does not read this suite as more than it is: it
    // verifies the isolation primitive and the inventory's declared wiring, not that
    // any given handler actually calls it. That is verified by executing — the `qa`'s
    // curl of criteria 2, 3 and 9 against two real negocios.
    expect(true).toBe(true);
  });
});
