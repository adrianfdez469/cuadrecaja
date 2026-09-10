import { describe, it, expect } from "vitest";

/**
 * F-031, contract § 4.2, § 11.1 — `src/lib/clientes/clienteUpsert.ts`.
 *
 * `decideClienteUpsert` is THE ONLY definition of the criterion-4 rule (reactivate a
 * soft-deleted cliente instead of failing on the `@@unique([nombre, negocioId])`).
 * `createOrReactivateCliente` touches Prisma and is explicitly OUT of this suite's
 * scope (contract § 11.2): verified by executing against the database (criteria 3/4).
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019).
 */
const { decideClienteUpsert } = await import("@/lib/clientes/clienteUpsert");

describe("decideClienteUpsert", () => {
  it('returns "CREATE" when no row exists with that name in the business', () => {
    expect(decideClienteUpsert(null)).toBe("CREATE");
  });

  it('returns "REACTIVATE" when the row is present and soft-deleted (deletedAt not null)', () => {
    expect(
      decideClienteUpsert({ id: "cliente-1", deletedAt: new Date("2026-01-01") }),
    ).toBe("REACTIVATE");
  });

  it('returns "DUPLICATE" when the row is present and active (deletedAt null)', () => {
    expect(decideClienteUpsert({ id: "cliente-1", deletedAt: null })).toBe("DUPLICATE");
  });

  it("discriminates purely on deletedAt, not on the id value", () => {
    // Same rule regardless of which id the active row happens to carry.
    expect(decideClienteUpsert({ id: "any-other-id", deletedAt: null })).toBe(
      "DUPLICATE",
    );
  });
});
