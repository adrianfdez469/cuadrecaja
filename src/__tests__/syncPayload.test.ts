import { describe, it, expect } from "vitest";
import type { Sale, SaleProduct } from "@/store/salesStore";

/**
 * F-032, contract § 6.6 — `src/app/pos/utils/syncPayload.ts`, NEW.
 *
 * `buildSyncMultimoneda` is THE ONLY place that rebuilds a queued sale's multimoneda
 * payload. It replaces three field-by-field constructions that had already drifted —
 * `syncPendingSales`, `handleSyncAll` and `handleSyncOne` — and is exactly where
 * criterion 8 (a 100%-credit offline sale must still sync) lives or dies: an empty
 * `pagosDetalle: []` has to produce a payload, not `undefined`.
 *
 * Only a type-only import of `Sale`/`SaleProduct` here — that is erased at compile
 * time and never touches the module under test, so it cannot itself trip E-019.
 * `buildSyncMultimoneda` is loaded dynamically because it does not exist yet.
 */
const { buildSyncMultimoneda } = await import("@/app/pos/utils/syncPayload");

const PRODUCT: SaleProduct = {
  cantidad: 1,
  productoTiendaId: "pt-1",
  productId: "pt-1",
  name: "Producto",
  price: 100,
};

function baseSale(overrides: Partial<Sale> = {}): Sale {
  return {
    identifier: "sale-1",
    tiendaId: "tienda-1",
    cierreId: "cierre-1",
    usuarioId: "usuario-1",
    total: 1000,
    totalcash: 1000,
    totaltransfer: 0,
    productos: [PRODUCT],
    synced: false,
    syncState: "not_synced",
    createdAt: Date.now(),
    wasOffline: true,
    syncAttempts: 0,
    ...overrides,
  };
}

describe("buildSyncMultimoneda", () => {
  it("returns undefined when the sale carries no payment lines at all (pagosDetalle absent)", () => {
    const sale = baseSale({ pagosDetalle: undefined });
    expect(buildSyncMultimoneda(sale)).toBeUndefined();
  });

  it("E-008 / criterion 8: an EMPTY array is NOT the same as absent — a 100%-credit sale with pagosDetalle: [] DOES produce a payload", () => {
    const sale = baseSale({
      pagosDetalle: [],
      creditoBase: 1000,
      clienteNombre: "Ana Pérez",
    });
    const result = buildSyncMultimoneda(sale);
    expect(result).toBeDefined();
    expect(result?.pagosDetalle).toEqual([]);
  });

  it("defaults monedaCobro to CUP, vueltoDetalle to [], and tasaSnapshot to {} when the sale does not carry them", () => {
    const sale = baseSale({
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 1000, equivalenteBase: 1000 },
      ],
      monedaCobro: undefined,
      vueltoDetalle: undefined,
      tasaSnapshot: undefined,
    });
    const result = buildSyncMultimoneda(sale);
    expect(result?.monedaCobro).toBe("CUP");
    expect(result?.vueltoDetalle).toEqual([]);
    expect(result?.tasaSnapshot).toEqual({});
  });

  it("includes tipTotal/tipDetail only when tipTotal is above zero", () => {
    const withoutTip = baseSale({
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 1000, equivalenteBase: 1000 },
      ],
      tipTotal: 0,
    });
    const withoutTipResult = buildSyncMultimoneda(withoutTip);
    expect(withoutTipResult).toBeDefined();
    expect(
      Object.prototype.hasOwnProperty.call(withoutTipResult, "tipTotal"),
    ).toBe(false);

    const withTip = baseSale({
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 1050, equivalenteBase: 1050 },
      ],
      tipTotal: 50,
      tipDetail: [
        { tipo: "cash", moneda: "CUP", monto: 50, equivalenteBase: 50 },
      ],
    });
    const withTipResult = buildSyncMultimoneda(withTip);
    expect(withTipResult?.tipTotal).toBe(50);
    expect(withTipResult?.tipDetail).toEqual([
      { tipo: "cash", moneda: "CUP", monto: 50, equivalenteBase: 50 },
    ]);
  });

  it("includes creditoBase/clienteId/clienteNombre only when creditoBase is above zero — mirrors buildCreditExtras's own rule", () => {
    const noCredit = baseSale({
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 1000, equivalenteBase: 1000 },
      ],
      creditoBase: 0,
      clienteId: "cliente-1",
      clienteNombre: "Ana",
    });
    const noCreditResult = buildSyncMultimoneda(noCredit);
    expect(
      Object.prototype.hasOwnProperty.call(noCreditResult, "creditoBase"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(noCreditResult, "clienteId"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(noCreditResult, "clienteNombre"),
    ).toBe(false);
  });

  it("offline-new-customer shape: creditoBase and clienteNombre travel with NO clienteId key at all", () => {
    const sale = baseSale({
      pagosDetalle: [],
      creditoBase: 700,
      clienteId: undefined,
      clienteNombre: "Cliente Nuevo",
    });
    const result = buildSyncMultimoneda(sale);
    expect(result?.creditoBase).toBe(700);
    expect(result?.clienteNombre).toBe("Cliente Nuevo");
    expect(Object.prototype.hasOwnProperty.call(result, "clienteId")).toBe(
      false,
    );
  });

  it("known-customer shape: clienteId travels alongside creditoBase and clienteNombre", () => {
    const sale = baseSale({
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 600, equivalenteBase: 600 },
      ],
      creditoBase: 400,
      clienteId: "cliente-conocido",
      clienteNombre: "Ana",
    });
    const result = buildSyncMultimoneda(sale);
    expect(result).toMatchObject({
      creditoBase: 400,
      clienteId: "cliente-conocido",
      clienteNombre: "Ana",
    });
  });
});
