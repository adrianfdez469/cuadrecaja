import { describe, it, expect } from "vitest";

/**
 * F-037 — `src/lib/ventaMapper.ts` (contract § 5; criteria 1, 3, 5). The file itself is
 * pre-existing (F-031/F-034), but `buildVentaCreditoResumen` and the four new fields it
 * feeds into `mapVentaToIVenta` are new to this feature.
 *
 * Dynamic import (E-019): `mapVentaToIVenta` already exists today, but
 * `buildVentaCreditoResumen` does not yet — a static `import { mapVentaToIVenta,
 * buildVentaCreditoResumen } from "..."` would tumble the whole file (including the
 * mapVentaToIVenta tests that have nothing to do with the new export) until both exist.
 */
const ventaMapper = await import("@/lib/ventaMapper");

/** The minimum shape mapVentaToIVenta needs, independent of the new credit fields. */
function baseRow() {
  return {
    id: "venta-1",
    createdAt: new Date("2026-03-05T00:00:00.000Z"),
    total: 1000,
    totalcash: 600,
    totaltransfer: 0,
    discountTotal: 0,
    tiendaId: "tienda-1",
    usuarioId: "usuario-1",
    cierrePeriodoId: "cierre-1",
    syncId: null,
    usuario: { id: "usuario-1", nombre: "Cajero Uno" },
    productos: [
      {
        id: "vp-1",
        cantidad: 1,
        productoTiendaId: "pt-1",
        precio: 1000,
        producto: {
          proveedor: null,
          producto: { nombre: "Producto A", id: "prod-1" },
        },
      },
    ],
  };
}

describe("mapVentaToIVenta — a row WITHOUT any credit field keeps compiling and reading as it does today (criterion 1: no false marks)", () => {
  it("defaults creditoBase to 0, leaves clienteId/clienteNombre undefined, and credito null", () => {
    const output = ventaMapper.mapVentaToIVenta(baseRow());
    expect(output.creditoBase).toBe(0);
    expect(output.clienteId).toBeUndefined();
    expect(output.clienteNombre).toBeUndefined();
    expect(output.credito ?? null).toBeNull();
  });
});

describe("mapVentaToIVenta — a row WITH credit propagates all four new fields (criterion 3, 5)", () => {
  it("propagates creditoBase, clienteId, clienteNombre and the credito block built from cuentaPorCobrar", () => {
    const row = {
      ...baseRow(),
      creditoBase: 400,
      clienteId: "cliente-bruno",
      cliente: { id: "cliente-bruno", nombre: "Bruno Instalaciones" },
      cuentaPorCobrar: {
        id: "cuenta-1",
        montoOriginal: 400,
        saldoPendiente: 400,
        settledAt: null,
        movimientos: [] as { tipo: "ABONO"; monto: number }[],
      },
    };
    const output = ventaMapper.mapVentaToIVenta(row);
    expect(output.creditoBase).toBe(400);
    expect(output.clienteId).toBe("cliente-bruno");
    expect(output.clienteNombre).toBe("Bruno Instalaciones");
    expect(output.credito).toEqual({
      cuentaId: "cuenta-1",
      montoOriginal: 400,
      saldoPendiente: 400,
      settledAt: null,
      cobros: 0,
      cobrosMontoBase: 0,
      movimientos: 0,
    });
  });
});

describe("buildVentaCreditoResumen — null with no account, the full block with one", () => {
  it("returns null when the row has no CuentaPorCobrar (null)", () => {
    expect(ventaMapper.buildVentaCreditoResumen(null)).toBeNull();
  });

  it("returns null when the row has no CuentaPorCobrar (undefined — callers that never included it)", () => {
    expect(ventaMapper.buildVentaCreditoResumen(undefined)).toBeNull();
  });

  it("combines the account row with summarizeVentaCobros over its own two collections", () => {
    const result = ventaMapper.buildVentaCreditoResumen({
      id: "cuenta-bruno",
      montoOriginal: 1000,
      saldoPendiente: 500,
      settledAt: null,
      movimientos: [
        { tipo: "ABONO", monto: 200 },
        { tipo: "ABONO", monto: 300 },
      ],
    });
    expect(result).toEqual({
      cuentaId: "cuenta-bruno",
      montoOriginal: 1000,
      saldoPendiente: 500,
      settledAt: null,
      cobros: 2,
      cobrosMontoBase: 500,
      movimientos: 2,
    });
  });
});
