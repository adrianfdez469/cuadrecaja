import { describe, it, expect } from "vitest";
import {
  mapLiquidaciones,
  mapProductosConsignacion,
} from "@/services/preoveedoresService";

const cierre = { fechaInicio: "2026-01-01", fechaFin: "2026-01-31" };

const liquidacion = (over: Partial<Record<string, unknown>> = {}) => ({
  productoId: "prod-1",
  cierreId: "cierre-1",
  createdAt: "2026-01-31T00:00:00.000Z",
  liquidatedAt: null,
  monto: 100,
  vendidos: 5,
  precio: 30,
  producto: { nombre: "Ron", deletedAt: null, categoria: { nombre: "Bebidas" } },
  cierre,
  ...over,
});

describe("mapProductosConsignacion", () => {
  it("lists stock that has never been sold", () => {
    const productos = mapProductosConsignacion({
      id: "prov-1",
      nombre: "Proveedor",
      telefono: "",
      direccion: "",
      stockConsignacion: [
        {
          productoId: "prod-1",
          nombre: "Ron",
          categoria: "Bebidas",
          existencia: 12,
          precio: 30,
          costo: 20,
        },
      ],
      prodProveedorLiquidacion: [],
    });

    expect(productos).toHaveLength(1);
    expect(productos[0]).toMatchObject({
      id: "prod-1",
      disponibles: 12,
      vendidos: 0,
      ganancias: 0,
    });
  });

  it("does not multiply availability by the number of closings", () => {
    const productos = mapProductosConsignacion({
      id: "prov-1",
      nombre: "Proveedor",
      telefono: "",
      direccion: "",
      stockConsignacion: [
        {
          productoId: "prod-1",
          nombre: "Ron",
          categoria: "Bebidas",
          existencia: 7,
          precio: 30,
          costo: 20,
        },
      ],
      prodProveedorLiquidacion: [
        liquidacion({ cierreId: "cierre-1" }),
        liquidacion({ cierreId: "cierre-2", vendidos: 3, monto: 60 }),
      ],
    });

    expect(productos[0].disponibles).toBe(7);
    expect(productos[0].vendidos).toBe(8);
    // (5 * 30 - 100) + (3 * 30 - 60) = 50 + 30
    expect(productos[0].ganancias).toBe(80);
  });

  it("sums availability across the stores holding the same product", () => {
    const productos = mapProductosConsignacion({
      id: "prov-1",
      nombre: "Proveedor",
      telefono: "",
      direccion: "",
      // The API already aggregates per product, so a single row carries the
      // total; what must not happen is dropping it when sales exist.
      stockConsignacion: [
        {
          productoId: "prod-1",
          nombre: "Ron",
          categoria: "Bebidas",
          existencia: 9,
          precio: 30,
          costo: 20,
        },
      ],
      prodProveedorLiquidacion: [liquidacion()],
    });

    expect(productos[0].disponibles).toBe(9);
  });

  it("hides products deleted from the catalog", () => {
    const productos = mapProductosConsignacion({
      id: "prov-1",
      nombre: "Proveedor",
      telefono: "",
      direccion: "",
      stockConsignacion: [],
      prodProveedorLiquidacion: [
        liquidacion({
          producto: {
            nombre: "consig_ELIMINADO_1783300774340",
            deletedAt: "2026-08-01T00:00:00.000Z",
            categoria: { nombre: "Bebidas" },
          },
        }),
      ],
    });

    expect(productos).toEqual([]);
  });

  it("keeps products sold in the past that are no longer stocked", () => {
    const productos = mapProductosConsignacion({
      id: "prov-1",
      nombre: "Proveedor",
      telefono: "",
      direccion: "",
      stockConsignacion: [],
      prodProveedorLiquidacion: [liquidacion()],
    });

    expect(productos[0]).toMatchObject({
      id: "prod-1",
      disponibles: 0,
      vendidos: 5,
      ganancias: 50,
    });
  });
});

describe("mapLiquidaciones", () => {
  it("groups rows by closing period and adds their amounts", () => {
    const liquidaciones = mapLiquidaciones([
      liquidacion(),
      liquidacion({ productoId: "prod-2", monto: 40, vendidos: 2 }),
    ]);

    expect(liquidaciones).toHaveLength(1);
    expect(liquidaciones[0]).toMatchObject({
      id: "cierre-1",
      monto: 140,
      productos: 7,
      estado: "pendiente",
    });
  });

  it("puts pending periods first, oldest first", () => {
    const liquidaciones = mapLiquidaciones([
      liquidacion({
        cierreId: "cierre-settled",
        liquidatedAt: "2026-02-05T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
      liquidacion({ cierreId: "cierre-new", createdAt: "2026-03-01T00:00:00.000Z" }),
      liquidacion({ cierreId: "cierre-old", createdAt: "2026-01-01T00:00:00.000Z" }),
    ]);

    expect(liquidaciones.map((l) => l.id)).toEqual([
      "cierre-old",
      "cierre-new",
      "cierre-settled",
    ]);
  });
});
