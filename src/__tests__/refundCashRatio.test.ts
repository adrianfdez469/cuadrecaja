import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F-032, criterion 11 — `refundCashRatio` and `applyComprasYDevolucionesToResumenMap`
 * (`@/lib/movimiento/caja.ts`, contract § 2.1/2.2).
 *
 * `@/lib/movimiento/caja` imports `@/lib/prisma` at module top level; mocked
 * defensively here, same pattern as `caja.test.ts` and `tenantScope.test.ts`.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const {
  refundCashRatio,
  applyComprasYDevolucionesToResumenMap,
  calcularTotalesMovimientosPeriodo,
} = await import("@/lib/movimiento/caja");

describe("refundCashRatio (F-032, criterion 11)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 when there is no debt portion — undefined, null, zero and negative all count as 'no debt'", () => {
    expect(refundCashRatio(100, undefined)).toBe(1);
    expect(refundCashRatio(100, null)).toBe(1);
    expect(refundCashRatio(100, 0)).toBe(1);
    expect(refundCashRatio(100, -5)).toBe(1);
    expect(refundCashRatio(100, NaN)).toBe(1);
  });

  it("returns the share of the refund that left the drawer when the debt is partial", () => {
    expect(refundCashRatio(100, 40)).toBeCloseTo(0.6, 10);
  });

  it("returns 0 when the whole refund was applied to the debt", () => {
    expect(refundCashRatio(100, 100)).toBe(0);
  });

  it("clamps to 0 when the debt portion exceeds the refund — never a negative ratio", () => {
    expect(refundCashRatio(100, 150)).toBe(0);
  });

  it("returns 0 when there IS a debt portion but the refund itself cannot be measured (non-finite or <= 0) — the conservative reading is that the drawer does not go down", () => {
    expect(refundCashRatio(0, 50)).toBe(0);
    expect(refundCashRatio(-10, 50)).toBe(0);
    expect(refundCashRatio(NaN, 50)).toBe(0);
  });
});

describe("applyComprasYDevolucionesToResumenMap — DEVOLUCION_VENTA with montoAplicadoADeuda (criterion 11)", () => {
  it("does NOT lower the drawer when the refund was applied entirely to the debt, but DOES lower it when the same refund has no debt portion", () => {
    const devolucion = (montoAplicadoADeuda: number | null) => ({
      tipo: "DEVOLUCION_VENTA",
      costoTotal: 40,
      montoReembolso: 100,
      montoOriginal: 100,
      monedaOriginal: "CUP",
      montoAplicadoADeuda,
    });

    const appliedToDebt: Record<
      string,
      { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
    > = { CUP: { totalEfectivo: 500, totalTransfer: 0, equivalenteBase: 500 } };
    applyComprasYDevolucionesToResumenMap(
      appliedToDebt,
      [devolucion(100)],
      "CUP",
      {},
    );
    expect(appliedToDebt.CUP.totalEfectivo).toBe(500);
    expect(appliedToDebt.CUP.equivalenteBase).toBe(500);

    const refundedInCash: Record<
      string,
      { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
    > = { CUP: { totalEfectivo: 500, totalTransfer: 0, equivalenteBase: 500 } };
    applyComprasYDevolucionesToResumenMap(
      refundedInCash,
      [devolucion(null)],
      "CUP",
      {},
    );
    expect(refundedInCash.CUP.totalEfectivo).toBe(400);
    expect(refundedInCash.CUP.equivalenteBase).toBe(400);
  });

  it("lowers the drawer only by the cash-left portion when the debt is partial", () => {
    const map: Record<
      string,
      { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
    > = { CUP: { totalEfectivo: 500, totalTransfer: 0, equivalenteBase: 500 } };
    applyComprasYDevolucionesToResumenMap(
      map,
      [
        {
          tipo: "DEVOLUCION_VENTA",
          costoTotal: 40,
          montoReembolso: 100,
          montoOriginal: 100,
          monedaOriginal: "CUP",
          montoAplicadoADeuda: 60,
        },
      ],
      "CUP",
      {},
    );
    // ratio = (100 - 60) / 100 = 0.4; only 40 of the 100 left the drawer.
    expect(map.CUP.totalEfectivo).toBe(500 - 40);
    expect(map.CUP.equivalenteBase).toBe(500 - 40);
  });

  it("the COMPRA branch is untouched by montoAplicadoADeuda — it is a DEVOLUCION_VENTA-only field", () => {
    const map: Record<
      string,
      { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
    > = {};
    applyComprasYDevolucionesToResumenMap(
      map,
      [
        {
          tipo: "COMPRA",
          formaPago: "EFECTIVO_CAJA",
          montoOriginal: 80,
          monedaOriginal: "CUP",
          // present but irrelevant to a COMPRA
          montoAplicadoADeuda: 999,
        } as never,
      ],
      "CUP",
      {},
    );
    expect(map.CUP.totalEfectivo).toBe(-80);
  });
});

describe("calcularTotalesMovimientosPeriodo — control: montoAplicadoADeuda never moves the margin reversal (criterion 11)", () => {
  it("totalDevoluciones stays montoReembolso - costoTotal regardless of how much of the refund went to debt", () => {
    const base = {
      tipo: "DEVOLUCION_VENTA" as const,
      costoTotal: 40,
      montoReembolso: 100,
      montoOriginal: 100,
      monedaOriginal: "CUP",
    };
    const withoutDebt = calcularTotalesMovimientosPeriodo(
      [{ ...base }],
      "CUP",
      {},
    );
    const appliedFully = calcularTotalesMovimientosPeriodo(
      [{ ...base, montoAplicadoADeuda: 100 }],
      "CUP",
      {},
    );
    const appliedPartially = calcularTotalesMovimientosPeriodo(
      [{ ...base, montoAplicadoADeuda: 60 }],
      "CUP",
      {},
    );
    expect(withoutDebt.totalDevoluciones).toBe(60);
    expect(appliedFully.totalDevoluciones).toBe(60);
    expect(appliedPartially.totalDevoluciones).toBe(60);
  });
});
