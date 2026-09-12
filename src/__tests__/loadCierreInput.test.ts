import { describe, it, expect, vi } from "vitest";

/**
 * F-032, criterion 9 — the two `where` builders of `@/lib/cierre/loadCierreInput.ts`
 * (contract § 4.1), extracted to exported functions precisely so the `OR` trap can be
 * asserted with `toEqual` on the whole object, without a database.
 *
 * `loadCierreInput` imports `@/lib/prisma` at module top level; mocked defensively,
 * same pattern as `caja.test.ts`.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { openReceivablesWhere, periodCollectionsWhere } = await import(
  "@/lib/cierre/loadCierreInput"
);

const corte = new Date("2026-09-03T00:00:00Z");

describe("openReceivablesWhere (F-032, criterion 9)", () => {
  it("selects tiendaId, fechaVenta <= corte, AND settled-null OR settled-after-corte — never `settledAt: null` alone", () => {
    expect(openReceivablesWhere("T1", corte)).toEqual({
      tiendaId: "T1",
      fechaVenta: { lte: corte },
      OR: [{ settledAt: null }, { settledAt: { gt: corte } }],
    });
  });

  it("THE TRAP ITSELF: the OR clause is what keeps an account settled after the cutoff in the recomputation — dropping it to `settledAt: null` collapses every already-collected debt out of every past period's recalculation", () => {
    const where = openReceivablesWhere("T1", corte);
    // The naive "simplification" the contract and criterion 9 warn against.
    const wronglySimplified = { tiendaId: "T1", fechaVenta: { lte: corte } };
    expect(where).not.toEqual(wronglySimplified);
    // The OR branch that recovers a settled-after-the-cutoff account must be present,
    // literally, not just "some OR" — an implementation that inverted the comparison
    // (settledAt: { lt: corte }, say) would still have an OR and still fail this.
    expect(where.OR).toEqual([{ settledAt: null }, { settledAt: { gt: corte } }]);
  });

  it("control case (E-008's third check, recommended by contract § 12.1): two stores of the SAME negocio differ ONLY by tiendaId — a guard that filtered by negocio instead of tienda, or dropped tiendaId from the where, would make these equal", () => {
    const t1 = openReceivablesWhere("T1", corte);
    const t1b = openReceivablesWhere("T1b", corte);
    expect(t1).not.toEqual(t1b);
    expect(t1.tiendaId).toBe("T1");
    expect(t1b.tiendaId).toBe("T1b");
    // Everything else about the two where clauses is identical for the same corte.
    expect({ ...t1, tiendaId: undefined }).toEqual({
      ...t1b,
      tiendaId: undefined,
    });
  });
});

describe("periodCollectionsWhere (F-032, criterion 8 / criterion 3-6 support; F-035 § 12.1, ADR 0128)", () => {
  const fechaInicio = new Date("2026-09-01T00:00:00Z");
  const fechaFin = new Date("2026-09-03T01:18:00Z");

  // F-035 § 12.1 (ADR 0128, the negative mirror) widens this where's `tipo` clause from the
  // single value `"ABONO"` to `{ in: ["ABONO", "REVERSION_ABONO"] }`: a reversal now has to
  // enter the same period-collections query as the ABONO it undoes, so `netCollectionRows`
  // can net the two against each other. This is F-032 code broken FROM OUTSIDE by F-035's
  // contract, exactly the E-026 addendum shape (tsc/lint green, this suite red) — updating it
  // is dev-tester's boundary, not the implementer's (E-046), and it is fixed against § 12.1's
  // literal text, not against whatever the real function happens to return.
  //
  // This exact `toEqual` is what would catch someone narrowing the filter back down to a
  // single value later — that is its whole point per § 12.1's own text ("el toEqual es lo que
  // atrapa que alguien reduzca el filtro otra vez").
  //
  // What this assertion CANNOT and does not claim to discriminate: § 12.1's second point (the
  // `findMany`'s `select` gaining `tipo` and `revierte: { select: { pagosDetalle, tasaSnapshot } }`)
  // is a DIFFERENT piece of code — inline in `loadCierreInput`'s own Prisma call, not part of
  // `periodCollectionsWhere`'s return value — so widening THIS `where` assertion cannot prove
  // that `select` also grew. That half is explicitly the `qa`'s to verify by execution: § 12.1
  // says so directly ("Casos nuevos... que el qa verifica ejecutando") and criterion 13 of
  // § 12.2 names it outright ("es el include de revierte lo que se está auditando"). Extending
  // `periodCollectionsWhere`'s own coverage cannot substitute for that without either reading
  // the real `loadCierreInput` implementation to reproduce its full Prisma call graph in a mock
  // (which would defeat testing blind against the contract) or the contract exposing a second
  // pure, testable symbol for that `select` — neither is the case today.
  it("selects ABONO **and** REVERSION_ABONO rows of the store's cuentaPorCobrar, within [fechaInicio, fechaFin]", () => {
    expect(periodCollectionsWhere("T1", fechaInicio, fechaFin)).toEqual({
      tipo: { in: ["ABONO", "REVERSION_ABONO"] },
      cuentaPorCobrar: { tiendaId: "T1" },
      fecha: { gte: fechaInicio, lte: fechaFin },
    });
  });

  it("has no upper bound while the period is still open (fechaFin null) — same shape the MovimientoStock query already uses", () => {
    expect(periodCollectionsWhere("T1", fechaInicio, null)).toEqual({
      tipo: { in: ["ABONO", "REVERSION_ABONO"] },
      cuentaPorCobrar: { tiendaId: "T1" },
      fecha: { gte: fechaInicio },
    });
  });

  it("does NOT narrow back down to a bare 'ABONO' string — the exact regression § 12.1 warns about", () => {
    const where = periodCollectionsWhere("T1", fechaInicio, fechaFin);
    expect(where.tipo).not.toBe("ABONO");
    expect(where.tipo).toEqual({ in: ["ABONO", "REVERSION_ABONO"] });
  });

  it("control case: two stores of the SAME negocio differ ONLY by the tiendaId inside cuentaPorCobrar", () => {
    const t1 = periodCollectionsWhere("T1", fechaInicio, fechaFin);
    const t1b = periodCollectionsWhere("T1b", fechaInicio, fechaFin);
    expect(t1).not.toEqual(t1b);
    expect(t1.cuentaPorCobrar).toEqual({ tiendaId: "T1" });
    expect(t1b.cuentaPorCobrar).toEqual({ tiendaId: "T1b" });
  });
});
