import { describe, it, expect } from "vitest";

/**
 * F-037 — `src/lib/cuentasPorCobrar/ventaCreditoEstado.ts` (contract § 4.1, § 4.2;
 * criteria 1, 2, 6).
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it,
 * and this file exercises TWO independent exports (`resolveVentaCreditoEstado` and
 * `summarizeVentaCobros`) — a static `import { X, Y } from "..."` would tumble both sets
 * of tests if only one of the two were missing.
 */
const ventaCreditoEstado = await import(
  "@/lib/cuentasPorCobrar/ventaCreditoEstado"
);
const { MIN_OPEN_BALANCE_BASE } = await import("@/lib/cuentasPorCobrar/aging");

describe("VENTA_CREDITO_ESTADOS — the three-value enum, one declaration (E-014)", () => {
  it("has exactly SIN_CREDITO, CON_SALDO, SALDADA, in that order", () => {
    expect(ventaCreditoEstado.VENTA_CREDITO_ESTADOS).toEqual([
      "SIN_CREDITO",
      "CON_SALDO",
      "SALDADA",
    ]);
  });
});

describe("resolveVentaCreditoEstado — read from EXPLICIT fields, never deduced (E-013, criterion 2)", () => {
  it("is SIN_CREDITO for a cash sale with creditoBase 0 and no credito block (V1, the control)", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 0,
        credito: null,
      }),
    ).toBe("SIN_CREDITO");
  });

  it("is SIN_CREDITO for the E-013 rounding-remainder sale — total 10.00, totalcash 9.99: the DEDUCTION (cash+transfer < total) would call this credit, and the explicit field says it is not (criterion 2, exact)", () => {
    // total 10.00, totalcash 9.99, totaltransfer 0: totalcash + totaltransfer (9.99) <
    // total (10.00) would flag this as credit under the deduction the criterion forbids.
    // These three fields are passed alongside creditoBase/credito on purpose — the input
    // is STRUCTURAL (contract § 4.1), so a resolver that peeked at total/totalcash instead
    // of creditoBase would see the same trap a hand-rolled deduction would, and still has
    // to answer SIN_CREDITO.
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        total: 10.0,
        totalcash: 9.99,
        totaltransfer: 0,
        creditoBase: 0,
        credito: null,
      } as Parameters<typeof ventaCreditoEstado.resolveVentaCreditoEstado>[0]),
    ).toBe("SIN_CREDITO");
  });

  it("is CON_SALDO for a credit sale with a live, unsettled balance (V3/V4 shape)", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 400,
        credito: { saldoPendiente: 400, settledAt: null },
      }),
    ).toBe("CON_SALDO");
  });

  it("is SALDADA once settledAt carries a date, even though creditoBase is still positive", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 300,
        credito: { saldoPendiente: 0, settledAt: new Date("2026-01-01") },
      }),
    ).toBe("SALDADA");
  });

  it("reads settledAt as a STRING too (E-074: /ventas gets it over the wire unparsed) and still resolves SALDADA", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 300,
        credito: {
          saldoPendiente: 0,
          settledAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    ).toBe("SALDADA");
  });

  it("is CON_SALDO for a credit sale whose block has not travelled yet (queued offline, no account) — never SALDADA by omission", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 1000,
        credito: null,
      }),
    ).toBe("CON_SALDO");
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 1000,
      }),
    ).toBe("CON_SALDO");
  });

  it("reads settledAt: undefined as 'not settled' (still CON_SALDO) — one of the THREE forms of a live account fixed by § 0.6 (d): with strict:false a `.nullable()` Zod field infers as optional, so `undefined` is a real shape on the wire, not just `null`", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 400,
        credito: { saldoPendiente: 400, settledAt: undefined },
      }),
    ).toBe("CON_SALDO");
  });

  it("reads a WHOLLY ABSENT settledAt key as 'not settled' too (still CON_SALDO) — the third form of § 0.6 (d), distinct from passing `undefined` explicitly: a resolver comparing with `=== null` only would treat both undefined and the absent key as 'is set' and wrongly answer SALDADA", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 400,
        credito: { saldoPendiente: 400 } as {
          saldoPendiente: number;
          settledAt?: Date | string | null;
        },
      }),
    ).toBe("CON_SALDO");
  });

  it("treats a balance AT the MIN_OPEN_BALANCE_BASE threshold as settled, and just above it as still open", () => {
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 400,
        credito: { saldoPendiente: MIN_OPEN_BALANCE_BASE, settledAt: null },
      }),
    ).toBe("SALDADA");
    expect(
      ventaCreditoEstado.resolveVentaCreditoEstado({
        creditoBase: 400,
        credito: {
          saldoPendiente: MIN_OPEN_BALANCE_BASE + 0.01,
          settledAt: null,
        },
      }),
    ).toBe("CON_SALDO");
  });
});

describe("ventaChipSaldo — the figure the credit chip paints, server balance first, charged credit as fallback", () => {
  it("is undefined for a cash sale — the chip of a sale with no credit shows nothing at all", () => {
    expect(
      ventaCreditoEstado.ventaChipSaldo({ creditoBase: 0, credito: null }),
    ).toBeUndefined();
    expect(ventaCreditoEstado.ventaChipSaldo({})).toBeUndefined();
  });

  it("is the server's live balance when the credit block travelled", () => {
    expect(
      ventaCreditoEstado.ventaChipSaldo({
        creditoBase: 400,
        credito: { saldoPendiente: 150, settledAt: null },
      }),
    ).toBe(150);
  });

  it("is the charged credit (creditoBase) for a sale still unsynced, whose block did not travel — the POS knows its debt to the cent", () => {
    expect(
      ventaCreditoEstado.ventaChipSaldo({ creditoBase: 1000, credito: null }),
    ).toBe(1000);
    expect(ventaCreditoEstado.ventaChipSaldo({ creditoBase: 1000 })).toBe(1000);
  });

  it("is 0 for a settled sale — harmless: CreditoEstadoChip hides the figure unless the state is CON_SALDO", () => {
    expect(
      ventaCreditoEstado.ventaChipSaldo({
        creditoBase: 300,
        credito: { saldoPendiente: 0, settledAt: new Date("2026-01-01") },
      }),
    ).toBe(0);
  });
});

describe("summarizeVentaCobros — how much this debt has taken in, and how many times (criterion 6)", () => {
  it("counts two ABONO rows as 2 collections and sums them in base currency", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "ABONO", monto: 200 },
        { tipo: "ABONO", monto: 300 },
      ]),
    ).toEqual({ cobros: 2, cobrosMontoBase: 500, movimientos: 2 });
  });

  it("a reverted abono counts 0 collections and 0 base amount, but leaves movimientos at 2", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "ABONO", monto: 200 },
        { tipo: "REVERSION_ABONO", monto: 200 },
      ]),
    ).toEqual({ cobros: 0, cobrosMontoBase: 0, movimientos: 2 });
  });

  it("a CONDONACION leaves cobros at 0 and movimientos at 1 — it moves no physical money", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "CONDONACION", monto: 400 },
      ]),
    ).toEqual({ cobros: 0, cobrosMontoBase: 0, movimientos: 1 });
  });

  it("counts every row's tipo toward movimientos, but only ABONO/REVERSION_ABONO toward cobros — an AJUSTE_DEVOLUCION does not inflate the collection count", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "ABONO", monto: 200 },
        { tipo: "AJUSTE_DEVOLUCION", monto: 150 },
      ]),
    ).toEqual({ cobros: 1, cobrosMontoBase: 200, movimientos: 2 });
  });

  it("floors BOTH cobros AND cobrosMontoBase at 0 for an orphan REVERSION_ABONO whose ABONO is not in the array — '2 cobros por -300,00 CUP' would be a bug on screen, not a message (§ 4.2 amendment)", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "REVERSION_ABONO", monto: 300 },
      ]),
    ).toEqual({ cobros: 0, cobrosMontoBase: 0, movimientos: 1 });
  });

  it("does NOT floor a reversal that DOES have its collection in the same ledger — the contract's own worked example: ABONO 200 + ABONO 300 + REVERSION_ABONO 300 nets to 1 collection of 200, never floored to 0 just because a REVERSION_ABONO is present", () => {
    expect(
      ventaCreditoEstado.summarizeVentaCobros([
        { tipo: "ABONO", monto: 200 },
        { tipo: "ABONO", monto: 300 },
        { tipo: "REVERSION_ABONO", monto: 300 },
      ]),
    ).toEqual({ cobros: 1, cobrosMontoBase: 200, movimientos: 3 });
  });

  it("returns all zeros for an empty ledger — a sale with no CuentaPorCobrar movements yet", () => {
    expect(ventaCreditoEstado.summarizeVentaCobros([])).toEqual({
      cobros: 0,
      cobrosMontoBase: 0,
      movimientos: 0,
    });
  });
});
