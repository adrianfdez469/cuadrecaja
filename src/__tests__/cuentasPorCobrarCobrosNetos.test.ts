import { describe, it, expect } from "vitest";
import { convertToBase } from "@/lib/currency";
import type { IPagoLinea } from "@/schemas/pago";

/**
 * F-035 — `src/lib/cuentasPorCobrar/cobrosNetos.ts` (contract § 4bis, ADR 0128). Covers
 * testability symbol 15: `netCollectionRows`, the mirror-in-negative that lets a
 * REVERSION_ABONO subtract from the cash engines (`buildResumenMonedas`, `valueAbonos`)
 * WITHOUT either of them changing a line.
 *
 * This is the pure test that sustains ADR 0128: without negating the mirror, the net of
 * a collection and its reversal comes out DOUBLE instead of zero (E-008) — the whole
 * point of § 12's delegation onto F-032's two touched points.
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const { netCollectionRows } = await import("@/lib/cuentasPorCobrar/cobrosNetos");

function pagoLinea(over: Partial<IPagoLinea> = {}): IPagoLinea {
  return { tipo: "cash", moneda: "CUP", monto: 1, equivalenteBase: 1, ...over };
}

describe("netCollectionRows — an ABONO passes through unchanged", () => {
  it("keeps id, fecha, tasaSnapshot and pagosDetalle exactly as they arrived", () => {
    const fecha = new Date("2026-02-01T00:00:00.000Z");
    const pagosDetalle = [pagoLinea({ moneda: "USD", monto: 100, equivalenteBase: 12000 })];
    const tasaSnapshot = { USD: 120 };
    const [row] = netCollectionRows([
      { id: "m1", tipo: "ABONO", fecha, tasaSnapshot, pagosDetalle },
    ]);
    expect(row.id).toBe("m1");
    expect(row.fecha).toEqual(fecha);
    expect(row.tasaSnapshot).toEqual(tasaSnapshot);
    expect(row.pagosDetalle).toEqual(pagosDetalle);
  });
});

describe("netCollectionRows — a REVERSION_ABONO becomes the origin's lines, NEGATED, with the origin's rate and the reversal's own date", () => {
  it("negates both monto and equivalenteBase on every line", () => {
    // No fechaOrigen here on purpose: which date wins (the reversal's, not the origin's) is
    // its own dedicated test right below ("uses the REVERSAL's own fecha..."). This test's
    // only job is the sign flip, so it declares only the date it actually uses.
    const fechaReversion = new Date("2026-02-20T00:00:00.000Z");
    const origenPagos = [
      pagoLinea({ tipo: "cash", moneda: "USD", monto: 100, equivalenteBase: 12000 }),
    ];
    const [row] = netCollectionRows([
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: fechaReversion,
        tasaSnapshot: null, // ADR 0127: a REVERSION_ABONO is persisted with tasaSnapshot: null
        pagosDetalle: null, // ADR 0127: and with pagosDetalle: null
        revierte: { pagosDetalle: origenPagos, tasaSnapshot: { USD: 120 } },
      },
    ]);
    expect(row.pagosDetalle).toHaveLength(1);
    expect(row.pagosDetalle![0].monto).toBe(-100);
    expect(row.pagosDetalle![0].equivalenteBase).toBe(-12000);
    expect(row.pagosDetalle![0].moneda).toBe("USD");
  });

  it("uses the ORIGIN's tasaSnapshot, not the reversal's own (which is null)", () => {
    const [row] = netCollectionRows([
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: new Date("2026-02-20T00:00:00.000Z"),
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: {
          pagosDetalle: [pagoLinea({ moneda: "USD", monto: 100, equivalenteBase: 12000 })],
          tasaSnapshot: { USD: 120 },
        },
      },
    ]);
    expect(row.tasaSnapshot).toEqual({ USD: 120 });
  });

  it("uses the REVERSAL's own fecha, not the origin's — the cash effect lands when the reversal happens", () => {
    const fechaOrigen = new Date("2026-02-01T00:00:00.000Z");
    const fechaReversion = new Date("2026-02-20T00:00:00.000Z");
    const [row] = netCollectionRows([
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: fechaReversion,
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: {
          pagosDetalle: [pagoLinea({ monto: 400, equivalenteBase: 400 })],
          tasaSnapshot: {},
        },
      },
    ]);
    expect(row.fecha).toEqual(fechaReversion);
    expect(row.fecha).not.toEqual(fechaOrigen);
  });

  it("preserves moneda, tipo and transferDestinationId of each origin line while negating amounts", () => {
    const destino = crypto.randomUUID();
    const [row] = netCollectionRows([
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: new Date(),
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: {
          pagosDetalle: [
            pagoLinea({
              tipo: "transfer",
              moneda: "CUP",
              monto: 500,
              equivalenteBase: 500,
              transferDestinationId: destino,
            }),
          ],
          tasaSnapshot: {},
        },
      },
    ]);
    const [line] = row.pagosDetalle!;
    expect(line.tipo).toBe("transfer");
    expect(line.moneda).toBe("CUP");
    expect(line.monto).toBe(-500);
    expect(line.equivalenteBase).toBe(-500);
    expect(line.transferDestinationId).toBe(destino);
  });

  it("does NOT mutate the original origin lines in place", () => {
    const origenPagos = [pagoLinea({ monto: 100, equivalenteBase: 12000 })];
    netCollectionRows([
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: new Date(),
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: { pagosDetalle: origenPagos, tasaSnapshot: {} },
      },
    ]);
    expect(origenPagos[0].monto).toBe(100);
    expect(origenPagos[0].equivalenteBase).toBe(12000);
  });
});

describe("netCollectionRows — a reversal whose origin did NOT come in the join contributes nothing", () => {
  it("does not throw, and its total contribution (summed like the two cash engines would) is zero", () => {
    const rows = [
      {
        id: "rev-huerfana",
        tipo: "REVERSION_ABONO" as const,
        fecha: new Date(),
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: null,
      },
      {
        id: "rev-sin-revierte",
        tipo: "REVERSION_ABONO" as const,
        fecha: new Date(),
        tasaSnapshot: null,
        pagosDetalle: null,
        // `revierte` intentionally omitted (undefined), not just null
      },
    ];
    let result: ReturnType<typeof netCollectionRows> = [];
    expect(() => {
      result = netCollectionRows(rows);
    }).not.toThrow();
    const total = result.reduce(
      (sum, row) =>
        sum + (row.pagosDetalle ?? []).reduce((s, line) => s + line.equivalenteBase, 0),
      0,
    );
    expect(total).toBe(0);
  });
});

describe("netCollectionRows — the § 4bis worked example: an ABONO and its mirror net to exactly 0", () => {
  it("100 USD cash at 120 plus 500 CUP by transfer: the collection is worth 12500, its mirror -12500, net 0", () => {
    const tasas = { USD: 120 };
    const origenId = crypto.randomUUID();
    const destino = crypto.randomUUID();
    const origenPagos: IPagoLinea[] = [
      pagoLinea({ tipo: "cash", moneda: "USD", monto: 100, equivalenteBase: 12000 }),
      pagoLinea({
        tipo: "transfer",
        moneda: "CUP",
        monto: 500,
        equivalenteBase: 500,
        transferDestinationId: destino,
      }),
    ];

    const rows = netCollectionRows([
      {
        id: origenId,
        tipo: "ABONO",
        fecha: new Date("2026-02-01T00:00:00.000Z"),
        tasaSnapshot: tasas,
        pagosDetalle: origenPagos,
      },
      {
        id: "rev1",
        tipo: "REVERSION_ABONO",
        fecha: new Date("2026-02-20T00:00:00.000Z"),
        tasaSnapshot: null,
        pagosDetalle: null,
        revierte: { pagosDetalle: origenPagos, tasaSnapshot: tasas },
      },
    ]);

    // Value every line through convertToBase (the SAME function buildResumenMonedas and
    // valueAbonos use), the way the two real cash engines would sum them.
    const netTotal = rows.reduce((sum, row) => {
      const rowTotal = (row.pagosDetalle ?? []).reduce(
        (s, line) => s + convertToBase(line.monto, line.moneda, row.tasaSnapshot ?? {}),
        0,
      );
      return sum + rowTotal;
    }, 0);

    expect(netTotal).toBe(0);

    const [origenRow, reversionRow] = rows;
    expect(
      origenRow.pagosDetalle!.reduce((s, l) => s + l.equivalenteBase, 0),
    ).toBe(12500);
    expect(
      reversionRow.pagosDetalle!.reduce((s, l) => s + l.equivalenteBase, 0),
    ).toBe(-12500);
  });
});
