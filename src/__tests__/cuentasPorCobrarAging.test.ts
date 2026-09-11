import { describe, it, expect } from "vitest";

/**
 * F-031, criteria 6, 7 and 8 — `src/lib/cuentasPorCobrar/aging.ts` (contract § 5.2).
 *
 * Imported as a namespace (`import * as aging`), not destructured, and used as
 * `aging.<symbol>` throughout. Two independent reasons, both from E-019:
 *
 *   1. If the module does not exist AT ALL yet, nothing here can run regardless of
 *      import style — expected red while the `implementer` is still working.
 *   2. If the module exists but a given export (e.g. `bucketAntiguedad`) is still
 *      missing, a NAMESPACE import still resolves fine (module namespace objects do
 *      not throw for a missing property, only `undefined`) — so only the specific
 *      test that calls the missing symbol fails, not every test in this file via a
 *      collection-time `SyntaxError` on a named import. This is exactly what
 *      criterion 8 asks for: "comprobar antes que el símbolo existe" without letting
 *      one missing symbol tumble the whole file.
 */
const aging = await import("@/lib/cuentasPorCobrar/aging");

describe("bucketAntiguedad", () => {
  it("exists as an exported function (checked before the it.each below, per criterion 8 / E-019)", () => {
    expect(typeof aging.bucketAntiguedad).toBe("function");
  });

  it.each([
    [-5, "0-30"], // a sale dated in the future has not aged at all
    [0, "0-30"],
    [30, "0-30"],
    [31, "31-60"],
    [60, "31-60"],
    [61, "61-90"],
    [90, "61-90"],
    [91, "91+"],
  ] as const)("classifies %d days as %s (criterion 8)", (dias, bucket) => {
    expect(aging.bucketAntiguedad(dias)).toBe(bucket);
  });
});

describe("AGING_BUCKETS", () => {
  it("is the four brackets in order, with the last one having no upper bound", () => {
    expect(aging.AGING_BUCKETS).toEqual([
      { bucket: "0-30", maxDays: 30 },
      { bucket: "31-60", maxDays: 60 },
      { bucket: "61-90", maxDays: 90 },
      { bucket: "91+", maxDays: null },
    ]);
  });
});

describe("MIN_OPEN_BALANCE_BASE", () => {
  it("is 0.01", () => {
    expect(aging.MIN_OPEN_BALANCE_BASE).toBe(0.01);
  });
});

describe("daysOutstanding", () => {
  it("returns whole days elapsed between fechaVenta and at, floored", () => {
    const fechaVenta = new Date("2026-01-01T00:00:00.000Z");
    const at = new Date("2026-01-31T12:00:00.000Z"); // 30.5 days later
    expect(aging.daysOutstanding(fechaVenta, at)).toBe(30);
  });

  it("returns a negative number, not clamped, when fechaVenta is later than at (a sale dated in the future)", () => {
    const fechaVenta = new Date("2026-02-10T00:00:00.000Z");
    const at = new Date("2026-02-05T00:00:00.000Z");
    expect(aging.daysOutstanding(fechaVenta, at)).toBe(-5);
  });
});

describe("buildCuentasPorCobrarSnapshot", () => {
  it("computes aging against the received `at`, never against the current clock: two calls with the SAME `at`, separated by a REAL pause (no mocked clock), return the same `dias` (criterion 6)", async () => {
    const fechaVenta = new Date("2026-01-01T00:00:00.000Z");
    const at = new Date("2026-03-01T00:00:00.000Z");
    const cuenta = {
      id: "c1",
      clienteId: "cl1",
      fechaVenta,
      montoOriginal: 100,
      movimientos: [],
    };

    const first = aging.buildCuentasPorCobrarSnapshot([cuenta], at);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = aging.buildCuentasPorCobrarSnapshot([cuenta], at);

    expect(second.cuentas[0].dias).toBe(first.cuentas[0].dias);
    expect(first.at).toBe(at);
    expect(second.at).toBe(at);
  });

  it("drops accounts at or below MIN_OPEN_BALANCE_BASE and keeps ones just above it — exactly the contract's own worked example: 0.005, 0.01 and 0.02, only 0.02 survives (criterion 7)", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    const cuenta = (id: string, montoOriginal: number, fechaVenta: Date) => ({
      id,
      clienteId: "cl1",
      fechaVenta,
      montoOriginal,
      movimientos: [],
    });

    const snapshot = aging.buildCuentasPorCobrarSnapshot(
      [
        cuenta("below", 0.005, new Date("2026-01-03T00:00:00.000Z")),
        cuenta("at-the-limit", 0.01, new Date("2026-01-02T00:00:00.000Z")),
        cuenta("above", 0.02, new Date("2026-01-01T00:00:00.000Z")),
      ],
      at,
    );

    expect(snapshot.cuentas.map((c) => c.id)).toEqual(["above"]);
    expect(snapshot.total).toBe(0.02);
  });

  it("sorts surviving accounts by fechaVenta ascending, regardless of input order (criterion 7)", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    const cuenta = (id: string, fechaVenta: Date) => ({
      id,
      clienteId: "cl1",
      fechaVenta,
      montoOriginal: 50,
      movimientos: [],
    });
    const snapshot = aging.buildCuentasPorCobrarSnapshot(
      [
        cuenta("later", new Date("2026-02-01T00:00:00.000Z")),
        cuenta("earliest", new Date("2026-01-01T00:00:00.000Z")),
        cuenta("middle", new Date("2026-01-15T00:00:00.000Z")),
      ],
      at,
    );
    expect(snapshot.cuentas.map((c) => c.id)).toEqual([
      "earliest",
      "middle",
      "later",
    ]);
  });

  it("aggregates `total` and `porBucket` from the surviving accounts' saldo, split by bracket", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    const snapshot = aging.buildCuentasPorCobrarSnapshot(
      [
        {
          id: "fresh",
          clienteId: "cl1",
          fechaVenta: new Date("2026-02-15T00:00:00.000Z"), // 14 days -> 0-30
          montoOriginal: 100,
          movimientos: [],
        },
        {
          id: "old",
          clienteId: "cl2",
          fechaVenta: new Date("2025-10-01T00:00:00.000Z"), // >91 days -> 91+
          montoOriginal: 50,
          movimientos: [],
        },
      ],
      at,
    );
    expect(snapshot.total).toBe(150);
    expect(snapshot.porBucket).toEqual({
      "0-30": 100,
      "31-60": 0,
      "61-90": 0,
      "91+": 50,
    });
  });

  it("returns the empty-snapshot shape for an empty input", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    expect(aging.buildCuentasPorCobrarSnapshot([], at)).toEqual({
      at,
      total: 0,
      porBucket: { "0-30": 0, "31-60": 0, "61-90": 0, "91+": 0 },
      cuentas: [],
    });
  });

  it("reports clienteNombre as null when absent or undefined", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    const snapshot = aging.buildCuentasPorCobrarSnapshot(
      [
        {
          id: "c1",
          clienteId: "cl1",
          fechaVenta: new Date("2026-02-01T00:00:00.000Z"),
          montoOriginal: 10,
          movimientos: [],
        },
      ],
      at,
    );
    expect(snapshot.cuentas[0].clienteNombre).toBeNull();
  });
});
