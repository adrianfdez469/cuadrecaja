import { describe, it, expect } from "vitest";

/**
 * F-037 — `src/lib/cuentasPorCobrar/ventaAjusteBorrado.ts` (contract § 4.4; criterion 8).
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const { splitAjusteBorrado } = await import(
  "@/lib/cuentasPorCobrar/ventaAjusteBorrado"
);

describe("splitAjusteBorrado — debt absorbs the adjustment FIRST (ADR 0135)", () => {
  it("is the contract's own worked example, criterion 8 exact: 1000/600cash/400credit, a 300 product removed leaves credit 100 and cash UNCHANGED at 600", () => {
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 400,
      saldoPendiente: 400,
      netoAjusteBase: 300,
      totalcashAnterior: 600,
      totaltransferAnterior: 0,
    });
    expect(result).toEqual({
      nuevoTotal: 700,
      nuevoCredito: 100,
      ajusteCredito: 300,
      remanenteBase: 0,
      nuevoTotalcash: 600,
      nuevoTotaltransfer: 0,
    });
  });

  it("spills a remainder onto the payment lines once the credit is exhausted", () => {
    // creditoAnterior 100, saldoPendiente 100: the debt can only absorb 100 of the 300
    // removed, so 200 has to come out of what was already paid in cash.
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 100,
      saldoPendiente: 100,
      netoAjusteBase: 300,
      totalcashAnterior: 900,
      totaltransferAnterior: 0,
    });
    expect(result.ajusteCredito).toBe(100);
    expect(result.remanenteBase).toBe(200);
    expect(result.nuevoCredito).toBe(0);
    expect(result.nuevoTotalcash).toBe(700);
    expect(result.nuevoTotaltransfer).toBe(0);
    expect(result.nuevoTotal).toBe(700);
    // The sale keeps adding up.
    expect(result.nuevoTotalcash + result.nuevoTotaltransfer + result.nuevoCredito).toBe(
      result.nuevoTotal,
    );
  });

  it("caps the credit share at saldoPendiente, not just at creditoAnterior — the third bound that keeps applyMovimientoCuentaPorCobrar from refusing SALDO_INSUFICIENTE", () => {
    // creditoAnterior 400 but saldoPendiente only 100 (a prior partial collection already
    // brought the balance down): the ledger write can only ever take 100 off the debt.
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 400,
      saldoPendiente: 100,
      netoAjusteBase: 300,
      totalcashAnterior: 600,
      totaltransferAnterior: 0,
    });
    expect(result.ajusteCredito).toBe(100);
    expect(result.remanenteBase).toBe(200);
    expect(result.nuevoCredito).toBe(300);
    expect(result.nuevoTotalcash).toBe(400);
    expect(result.nuevoTotaltransfer).toBe(0);
    expect(result.nuevoTotal).toBe(700);
    expect(result.nuevoTotalcash + result.nuevoTotaltransfer + result.nuevoCredito).toBe(
      result.nuevoTotal,
    );
  });

  it("with a NEGATIVE neto (a shrinking discount pushes the total UP), the credit share is 0 and the whole increase lands on cash", () => {
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 400,
      saldoPendiente: 400,
      netoAjusteBase: -100,
      totalcashAnterior: 600,
      totaltransferAnterior: 0,
    });
    expect(result.ajusteCredito).toBe(0);
    expect(result.remanenteBase).toBe(-100);
    expect(result.nuevoCredito).toBe(400);
    expect(result.nuevoTotalcash).toBe(700);
    expect(result.nuevoTotaltransfer).toBe(0);
    expect(result.nuevoTotal).toBe(1100);
    expect(result.nuevoTotalcash + result.nuevoTotaltransfer + result.nuevoCredito).toBe(
      result.nuevoTotal,
    );
  });

  it("the credit share is bound by all THREE arguments of the min at once — neto (500) > creditoAnterior (300) > saldoPendiente (150): a two-argument min(neto, creditoAnterior) would answer 300, and only including saldoPendiente gets to the correct 150", () => {
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 300,
      saldoPendiente: 150,
      netoAjusteBase: 500,
      totalcashAnterior: 700,
      totaltransferAnterior: 0,
    });
    expect(result.ajusteCredito).toBe(150);
    expect(result.remanenteBase).toBe(350);
    expect(result.nuevoCredito).toBe(150);
    expect(result.nuevoTotalcash).toBe(350);
    expect(result.nuevoTotaltransfer).toBe(0);
    expect(result.nuevoTotal).toBe(500);
    expect(result.nuevoTotalcash + result.nuevoTotaltransfer + result.nuevoCredito).toBe(
      result.nuevoTotal,
    );
  });

  it("with NO credit (creditoAnterior 0), reproduces today's arithmetic exactly — proportional ratios over cash and transfer, unaffected by this feature", () => {
    // Today's route: ratioCash = totalcash/total, ratioTransfer = totaltransfer/total,
    // nuevoTotal = total - neto, nuevoTotalcash = nuevoTotal * ratioCash, etc.
    const result = splitAjusteBorrado({
      totalAnterior: 1000,
      creditoAnterior: 0,
      saldoPendiente: 0,
      netoAjusteBase: 300,
      totalcashAnterior: 700,
      totaltransferAnterior: 300,
    });
    expect(result.ajusteCredito).toBe(0);
    expect(result.nuevoCredito).toBe(0);
    expect(result.nuevoTotal).toBe(700);
    expect(result.nuevoTotalcash).toBe(490); // 700 * (700/1000)
    expect(result.nuevoTotaltransfer).toBe(210); // 700 * (300/1000)
    expect(result.nuevoTotalcash + result.nuevoTotaltransfer + result.nuevoCredito).toBe(
      result.nuevoTotal,
    );
  });
});
