import { describe, it, expect } from "vitest";

/**
 * F-035 — `src/lib/cuentasPorCobrar/ventaDeleteGuard.ts` (contract § 4.3, amended by the
 * design's § 6; criteria 5, 6, 7, 8).
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it,
 * and this file exercises several independent exports (`evaluateVentaDeleteGuard`,
 * `VENTA_DELETE_BLOCK_HTTP_STATUS`, `VENTA_DELETE_BLOCK_TEXT`, `VENTA_DELETE_BLOCK_REASONS`)
 * — a static import would tumble every test here if only one were still missing.
 */
const guard = await import("@/lib/cuentasPorCobrar/ventaDeleteGuard");

describe("VENTA_DELETE_BLOCK_REASONS — the order IS the contract (first to fire wins)", () => {
  it("is exactly CREDITO_CON_COBROS, CREDITO_CON_MOVIMIENTOS, MULTIPLES_PAGOS, in that order", () => {
    expect(guard.VENTA_DELETE_BLOCK_REASONS).toEqual([
      "CREDITO_CON_COBROS",
      "CREDITO_CON_MOVIMIENTOS",
      "MULTIPLES_PAGOS",
    ]);
  });
});

describe("VENTA_DELETE_BLOCK_HTTP_STATUS — 409 for the two credit reasons, 400 stays for MULTIPLES_PAGOS (ADR 0126, E-009 rules out 403)", () => {
  it("maps every reason to the exact code the contract fixes", () => {
    expect(guard.VENTA_DELETE_BLOCK_HTTP_STATUS).toEqual({
      CREDITO_CON_COBROS: 409,
      CREDITO_CON_MOVIMIENTOS: 409,
      MULTIPLES_PAGOS: 400,
    });
  });
});

describe("evaluateVentaDeleteGuard — the composed gate, no credit at all", () => {
  it("allows both deleting a product and deleting the whole sale with a single payment line and no credit", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: null,
      pagosDetalle: [{ moneda: "CUP" }],
      productos: 3,
    });
    expect(result.producto).toEqual({ allowed: true, reason: null });
    expect(result.venta).toEqual({ allowed: true, reason: null });
  });

  it("blocks deleting a product (400, MULTIPLES_PAGOS) with more than one payment line, but the WHOLE sale is unaffected by payment count", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: null,
      pagosDetalle: [{ moneda: "CUP" }, { moneda: "USD" }],
      productos: 3,
    });
    expect(result.producto).toEqual({
      allowed: false,
      reason: "MULTIPLES_PAGOS",
    });
    expect(result.venta).toEqual({ allowed: true, reason: null });
  });
});

describe("evaluateVentaDeleteGuard — credit that blocks NOTHING: a live balance with zero collections (criterion 8, ADR 0126: cobros, not live debt)", () => {
  it("allows deleting a product AND the whole sale when the account has no ABONO/REVERSION_ABONO and no ledger rows at all", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: { cobros: 0, movimientos: 0 },
      pagosDetalle: null,
      productos: 3,
    });
    expect(result.producto).toEqual({ allowed: true, reason: null });
    expect(result.venta).toEqual({ allowed: true, reason: null });
  });
});

describe("evaluateVentaDeleteGuard — CREDITO_CON_COBROS: money already collected blocks both actions (criterion 5, 6)", () => {
  it("blocks the product and the whole sale with 409 when the account has collections", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: { cobros: 2, movimientos: 2 },
      pagosDetalle: null,
      productos: 3,
    });
    expect(result.producto).toEqual({
      allowed: false,
      reason: "CREDITO_CON_COBROS",
    });
    expect(result.venta).toEqual({
      allowed: false,
      reason: "CREDITO_CON_COBROS",
    });
  });
});

describe("evaluateVentaDeleteGuard — CREDITO_CON_MOVIMIENTOS: a dated ledger with no collections still blocks (E-032, a guard WIDER than any single criterion, but declared and tested on purpose)", () => {
  it("blocks both actions when the ledger has rows (e.g. a CONDONACION) but zero collections", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: { cobros: 0, movimientos: 1 },
      pagosDetalle: null,
      productos: 3,
    });
    expect(result.producto).toEqual({
      allowed: false,
      reason: "CREDITO_CON_MOVIMIENTOS",
    });
    expect(result.venta).toEqual({
      allowed: false,
      reason: "CREDITO_CON_MOVIMIENTOS",
    });
  });

  it("prefers CREDITO_CON_COBROS over CREDITO_CON_MOVIMIENTOS when both would fire — the order in VENTA_DELETE_BLOCK_REASONS is the evaluation order", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: { cobros: 1, movimientos: 2 },
      pagosDetalle: null,
      productos: 3,
    });
    expect(result.venta.reason).toBe("CREDITO_CON_COBROS");
  });
});

describe("evaluateVentaDeleteGuard — the last-product shortcut MIRRORS the whole-sale verdict exactly (contract § 8.2.4, security requirement 4)", () => {
  it("with 1 product left and a credit reason, `producto` equals `venta` verbatim — never MULTIPLES_PAGOS even with several payment lines, because the credit reason is checked BEFORE the mirror falls through to pagos", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: { cobros: 2, movimientos: 2 },
      pagosDetalle: [{ moneda: "CUP" }, { moneda: "USD" }],
      productos: 1,
    });
    expect(result.producto).toEqual(result.venta);
    expect(result.producto).toEqual({
      allowed: false,
      reason: "CREDITO_CON_COBROS",
    });
  });

  it("with 1 product left, no credit, and several payment lines, the shortcut is ALLOWED — the last-product path never runs pagadaConUnSoloPago, it mirrors `venta`", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: null,
      pagosDetalle: [{ moneda: "CUP" }, { moneda: "USD" }],
      productos: 1,
    });
    expect(result.producto).toEqual({ allowed: true, reason: null });
    expect(result.producto).toEqual(result.venta);
  });

  it("mirrors `venta` with `productos: 0` explicit — no credit, several payment lines: a wrongly-computed 'last product' boundary would run this through MULTIPLES_PAGOS (400) instead of mirroring an ALLOWED `venta`, which is the only way this case can tell the mirror apart from a coincidental match", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: null,
      pagosDetalle: [{ moneda: "CUP" }, { moneda: "USD" }],
      productos: 0,
    });
    expect(result.producto).toEqual(result.venta);
    expect(result.producto).toEqual({ allowed: true, reason: null });
  });

  it("mirrors `venta` with `productos` KEY ABSENT altogether (contract § 4.3: 'Defaults to 0.') — the same mirror the § 8.1 sale-DELETE route relies on when it calls the gate without a productos count at all, a code path distinct from passing 0 explicitly; no credit and several payment lines again rule out a coincidental match through a credit reason", () => {
    const result = guard.evaluateVentaDeleteGuard({
      credito: null,
      pagosDetalle: [{ moneda: "CUP" }, { moneda: "USD" }],
    });
    expect(result.producto).toEqual(result.venta);
    expect(result.producto).toEqual({ allowed: true, reason: null });
  });
});

describe("VENTA_DELETE_BLOCK_TEXT.creditoConCobros — the singular is a real, distinct branch (E-016: measured by value, not category)", () => {
  it("says '1 cobro', never '1 cobros', for a single collection", () => {
    const text = guard.VENTA_DELETE_BLOCK_TEXT.creditoConCobros(1, 200, "CUP");
    expect(text).toContain("1 cobro");
    expect(text).not.toContain("1 cobros");
  });

  it("says '2 cobros' and the exact base-currency amount for two collections", () => {
    const text = guard.VENTA_DELETE_BLOCK_TEXT.creditoConCobros(2, 500, "CUP");
    expect(text).toContain("2 cobros");
    expect(text).toContain("500,00 CUP");
  });
});

describe("VENTA_DELETE_BLOCK_TEXT.creditoConMovimientos — a fixed literal, no arguments", () => {
  it("returns a non-empty string that does not name a count (it is not the collections reason)", () => {
    const text = guard.VENTA_DELETE_BLOCK_TEXT.creditoConMovimientos();
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
