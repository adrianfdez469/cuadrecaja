import { describe, it, expect } from "vitest";
import { toTiendaOnlineProducto } from "@/lib/tiendaOnline/tiendaOnlineProducts";
import type { ITiendaOnlineProductoRow } from "@/lib/tiendaOnline/tiendaOnlineProducts";
import type { IQabStoreSyncState } from "@/schemas/tiendaOnline";

/**
 * F-006 — `toTiendaOnlineProducto` (`src/lib/tiendaOnline/tiendaOnlineProducts.ts`,
 * contract §6.2). PURE row projection: given a persisted product row and the
 * business's base currency, produces exactly what the publishing screen needs —
 * `monedaCode` resolved (`monedaPrecioCode ?? monedaBase`), `barcodes` flattened
 * from `codigosProducto`, and the merged sync state.
 */

const PRODUCTO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const CATEGORIA_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const PRODUCTO_TIENDA_1 = "b4f2b2b2-2222-4222-8222-222222222222";
const PRODUCTO_TIENDA_2 = "c5f3c3c3-3333-4333-8333-333333333333";
const TIENDA_1 = "d6f4d4d4-4444-4444-8444-444444444444";
const TIENDA_2 = "e7f5e5e5-5555-4555-8555-555555555555";

function syncedState(): IQabStoreSyncState {
  return { state: "SYNCED", code: null, attempts: 0, since: null };
}

function row(overrides: Partial<ITiendaOnlineProductoRow> = {}): ITiendaOnlineProductoRow {
  return {
    id: PRODUCTO_ID,
    nombre: "Agua mineral 500 ml",
    categoriaId: CATEGORIA_ID,
    publicarEnTienda: true,
    productoCanonicoId: null,
    categoria: { id: CATEGORIA_ID, nombre: "Bebidas", color: "#1E88E5" },
    codigosProducto: [{ codigo: "7501234567890" }],
    productosTienda: [
      {
        id: PRODUCTO_TIENDA_1,
        tiendaId: TIENDA_1,
        precio: 1.5,
        monedaPrecioCode: null,
        tienda: { nombre: "Sucursal Centro", publicarEnTienda: true },
      },
    ],
    ...overrides,
  } as ITiendaOnlineProductoRow;
}

describe("toTiendaOnlineProducto — field projection", () => {
  it("should carry id, nombre and publicarEnTienda through unchanged", () => {
    const producto = toTiendaOnlineProducto(row(), {
      monedaBase: "CUP",
      syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]),
    });

    expect(producto.id).toBe(PRODUCTO_ID);
    expect(producto.nombre).toBe("Agua mineral 500 ml");
    expect(producto.publicarEnTienda).toBe(true);
  });

  it("should project categoriaId/categoriaNombre from the nested categoria relation", () => {
    const producto = toTiendaOnlineProducto(row(), {
      monedaBase: "CUP",
      syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]),
    });

    expect(producto.categoriaId).toBe(CATEGORIA_ID);
    expect(producto.categoriaNombre).toBe("Bebidas");
  });

  it("should flatten codigosProducto into a plain string array", () => {
    const producto = toTiendaOnlineProducto(
      row({ codigosProducto: [{ codigo: "111" }, { codigo: "222" }] }),
      { monedaBase: "CUP", syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]) }
    );

    expect(producto.barcodes).toEqual(["111", "222"]);
  });

  it("should produce barcodes: [] when the product has no CodigoProducto row — criterion 2's shape at the screen level too", () => {
    const producto = toTiendaOnlineProducto(row({ codigosProducto: [] }), {
      monedaBase: "CUP",
      syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]),
    });

    expect(producto.barcodes).toEqual([]);
  });
});

describe("toTiendaOnlineProducto — currency resolution: monedaPrecioCode ?? monedaBase", () => {
  it("should use ProductoTienda.monedaPrecioCode when it is set", () => {
    const producto = toTiendaOnlineProducto(
      row({
        productosTienda: [
          {
            id: PRODUCTO_TIENDA_1,
            tiendaId: TIENDA_1,
            precio: 1.5,
            monedaPrecioCode: "USD",
            tienda: { nombre: "Sucursal Centro", publicarEnTienda: true },
          },
        ],
      }),
      { monedaBase: "CUP", syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]) }
    );

    expect(producto.tiendas[0]?.monedaCode).toBe("USD");
  });

  it("should fall back to monedaBase when monedaPrecioCode is null — never send an empty currency key", () => {
    const producto = toTiendaOnlineProducto(row(), {
      monedaBase: "CUP",
      syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]),
    });

    expect(producto.tiendas[0]?.monedaCode).toBe("CUP");
  });

  it("discriminating case: two locals, one with its own moneda and one falling back to base, must NOT both resolve to the same value by accident", () => {
    const producto = toTiendaOnlineProducto(
      row({
        productosTienda: [
          {
            id: PRODUCTO_TIENDA_1,
            tiendaId: TIENDA_1,
            precio: 1.5,
            monedaPrecioCode: "USD",
            tienda: { nombre: "Sucursal Centro", publicarEnTienda: true },
          },
          {
            id: PRODUCTO_TIENDA_2,
            tiendaId: TIENDA_2,
            precio: 2.0,
            monedaPrecioCode: null,
            tienda: { nombre: "Sucursal Vedado", publicarEnTienda: false },
          },
        ],
      }),
      {
        monedaBase: "EUR",
        syncStates: new Map([
          [PRODUCTO_TIENDA_1, syncedState()],
          [PRODUCTO_TIENDA_2, syncedState()],
        ]),
      }
    );

    const byTienda = new Map(producto.tiendas.map((t) => [t.tiendaId, t]));
    expect(byTienda.get(TIENDA_1)?.monedaCode).toBe("USD");
    expect(byTienda.get(TIENDA_2)?.monedaCode).toBe("EUR");
  });
});

describe("toTiendaOnlineProducto — tiendas[] projection, including tiendaPublicada (criterion 7's data)", () => {
  it("should carry tiendaPublicada from Tienda.publicarEnTienda, not derive it from anything else", () => {
    const producto = toTiendaOnlineProducto(
      row({
        productosTienda: [
          {
            id: PRODUCTO_TIENDA_1,
            tiendaId: TIENDA_1,
            precio: 1.5,
            monedaPrecioCode: null,
            tienda: { nombre: "Sucursal Centro", publicarEnTienda: false },
          },
        ],
      }),
      { monedaBase: "CUP", syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]) }
    );

    expect(producto.tiendas[0]?.tiendaPublicada).toBe(false);
  });

  it("should produce tiendas: [] for a product with no ProductoTienda row — the 'Sin local' case", () => {
    const producto = toTiendaOnlineProducto(row({ productosTienda: [] }), {
      monedaBase: "CUP",
      syncStates: new Map(),
    });

    expect(producto.tiendas).toEqual([]);
  });

  it("should carry productoTiendaId/tiendaId/tiendaNombre/precio through", () => {
    const producto = toTiendaOnlineProducto(row(), {
      monedaBase: "CUP",
      syncStates: new Map([[PRODUCTO_TIENDA_1, syncedState()]]),
    });

    expect(producto.tiendas[0]?.productoTiendaId).toBe(PRODUCTO_TIENDA_1);
    expect(producto.tiendas[0]?.tiendaId).toBe(TIENDA_1);
    expect(producto.tiendas[0]?.tiendaNombre).toBe("Sucursal Centro");
    expect(producto.tiendas[0]?.precio).toBe(1.5);
  });
});

describe("toTiendaOnlineProducto — merged sync state across every ProductoTienda row of the product", () => {
  it("should report SYNCED for a product with no ProductoTienda row at all", () => {
    const producto = toTiendaOnlineProducto(row({ productosTienda: [] }), {
      monedaBase: "CUP",
      syncStates: new Map(),
    });

    expect(producto.syncState.state).toBe("SYNCED");
  });

  it("discriminating case: with two locals, one FAILED and one PENDING, the merged state must be FAILED (worse-first) — a naive 'take the first row' would report PENDING instead", () => {
    const producto = toTiendaOnlineProducto(
      row({
        productosTienda: [
          {
            id: PRODUCTO_TIENDA_1,
            tiendaId: TIENDA_1,
            precio: 1.5,
            monedaPrecioCode: null,
            tienda: { nombre: "Sucursal Centro", publicarEnTienda: true },
          },
          {
            id: PRODUCTO_TIENDA_2,
            tiendaId: TIENDA_2,
            precio: 1.5,
            monedaPrecioCode: null,
            tienda: { nombre: "Sucursal Vedado", publicarEnTienda: true },
          },
        ],
      }),
      {
        monedaBase: "CUP",
        syncStates: new Map<string, IQabStoreSyncState>([
          [
            PRODUCTO_TIENDA_1,
            { state: "PENDING", code: null, attempts: 0, since: "2026-09-04T09:00:00.000Z" },
          ],
          [
            PRODUCTO_TIENDA_2,
            {
              state: "FAILED",
              code: "TRANSPORT",
              attempts: 2,
              since: "2026-09-04T08:00:00.000Z",
            },
          ],
        ]),
      }
    );

    expect(producto.syncState.state).toBe("FAILED");
  });
});
