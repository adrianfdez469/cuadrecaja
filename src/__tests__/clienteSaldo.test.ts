import { describe, it, expect } from "vitest";

/**
 * F-033, contract § 4.3, § 11.1 — `src/lib/clientes/clienteSaldo.ts`.
 * `attachSaldo` entered the testability list in the "Segunda enmienda" (dictamen A,
 * § 11.1 "Ampliación tras la implementación"), found while implementing.
 *
 * `buildSaldoPorClienteMap` and `attachSaldo` are the only PURE symbols of this module;
 * `loadSaldoPorCliente` touches Prisma and is out of this suite's scope (contract
 * § 11.2) — verified by executing against the database (criterion 3, riesgo § 13.3:
 * needs a seeded `CuentaPorCobrar` with `saldoPendiente > 0` and `settledAt: null`).
 *
 * This module imports `@/lib/prisma` at its top, but `loadSaldoPorCliente` — the only
 * symbol that actually calls it — is never invoked here, so no mock is required: the
 * dictamen confirms this module already imports cleanly from the suite as-is.
 *
 * Dynamic top-level `await import`: kept for consistency with the rest of this suite
 * so a future symbol added to this module cannot tumble the whole file (E-019).
 */
const { buildSaldoPorClienteMap, attachSaldo } = await import(
  "@/lib/clientes/clienteSaldo"
);

describe("buildSaldoPorClienteMap", () => {
  it("sums multiple rows for the same clienteId", () => {
    const result = buildSaldoPorClienteMap([
      { clienteId: "c1", saldoPendiente: 10.3389 },
      { clienteId: "c1", saldoPendiente: 5.34 },
    ]);
    // 10.3389 + 5.34 = 15.6789, rounded to two decimals -> 15.68 (unambiguous: the
    // third decimal digit is 8, well clear of any .xx5 floating-point edge case).
    expect(result.c1).toBe(15.68);
  });

  it("keeps totals of different clienteIds isolated from one another", () => {
    const result = buildSaldoPorClienteMap([
      { clienteId: "c1", saldoPendiente: 100 },
      { clienteId: "c2", saldoPendiente: 7 },
      { clienteId: "c1", saldoPendiente: 50 },
    ]);
    expect(result.c1).toBe(150);
    expect(result.c2).toBe(7);
  });

  it("rounds each total to two decimals, same rounding as computeSaldoAlCierre", () => {
    const result = buildSaldoPorClienteMap([{ clienteId: "c1", saldoPendiente: 33.333 }]);
    expect(result.c1).toBe(33.33);
  });

  it("omits a clienteId absent from rows — the caller defaults it to 0, not this function", () => {
    const result = buildSaldoPorClienteMap([{ clienteId: "c1", saldoPendiente: 10 }]);
    expect("c2" in result).toBe(false);
    expect(result.c2).toBeUndefined();
  });

  it("returns an empty object for an empty input", () => {
    expect(buildSaldoPorClienteMap([])).toEqual({});
  });

  it(
    "rounds ONCE after summing raw values — NOT once per row before summing " +
      "(edge case found by the implementer). 0.014 + 0.014: summed raw first the " +
      "total is 0.028, which rounds to 0.03; rounding each row to 0.01 first and " +
      "then summing gives 0.02 instead. The two approaches must disagree here, or " +
      "this test would pass even with the wrong one (E-008)",
    () => {
      const result = buildSaldoPorClienteMap([
        { clienteId: "c1", saldoPendiente: 0.014 },
        { clienteId: "c1", saldoPendiente: 0.014 },
      ]);
      expect(result.c1).toBe(0.03);
    },
  );
});

describe("attachSaldo", () => {
  it(
    "a cliente PRESENT in the map receives its figure — a NON-ZERO figure, so this " +
      "case cannot be confused with the absent one (E-008: testing with a present-but-" +
      "zero value would not distinguish the two branches)",
    () => {
      const cliente = { id: "c1", nombre: "Ana Pérez" };
      const result = attachSaldo(cliente, { c1: 125.5 });
      expect(result.saldo).toBe(125.5);
    },
  );

  it("a cliente ABSENT from the map receives 0", () => {
    const cliente = { id: "c-not-in-map", nombre: "Bruno" };
    const result = attachSaldo(cliente, { c1: 125.5 });
    expect(result.saldo).toBe(0);
  });

  it("does not mutate the object it receives", () => {
    const cliente = { id: "c1", nombre: "Ana Pérez" };
    const snapshot = { ...cliente };
    attachSaldo(cliente, { c1: 125.5 });
    expect(cliente).toEqual(snapshot);
  });

  it("keeps every other field of the cliente it attaches saldo to", () => {
    const cliente = {
      id: "c1",
      nombre: "Ana Pérez",
      telefono: "55551234",
      descripcion: "Cliente frecuente",
    };
    const result = attachSaldo(cliente, { c1: 10 });
    expect(result).toEqual({ ...cliente, saldo: 10 });
  });
});
