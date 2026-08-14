import { describe, it, expect } from "vitest";
import { buildProductIndex } from "@/app/pos/utils/buildProductIndex";
import { calcularDisponibilidadReal } from "@/app/pos/utils/calcularDisponibilidadReal";
import type { IProductoTiendaV2 } from "@/schemas/producto";

const PACK = 10;

/** Only the fields the index reads; the schema is far wider. */
function producto({
  id,
  productoId,
  nombre = id,
  existencia,
  categoriaId = "cat-1",
  fraccionDeId = null,
  unidadesPorFraccion = null,
}: {
  id: string;
  productoId: string;
  nombre?: string;
  existencia: number;
  categoriaId?: string;
  fraccionDeId?: string | null;
  unidadesPorFraccion?: number | null;
}): IProductoTiendaV2 {
  return {
    id,
    productoId,
    existencia,
    producto: {
      nombre,
      categoria: { id: categoriaId },
      fraccionDeId,
      unidadesPorFraccion,
    },
  } as unknown as IProductoTiendaV2;
}

const caja = producto({
  id: "pt-caja",
  productoId: "caja",
  nombre: "Caja de cigarros",
  existencia: 4,
});
const suelto = producto({
  id: "pt-suelto",
  productoId: "suelto",
  nombre: "Cigarro suelto",
  existencia: 3,
  fraccionDeId: "caja",
  unidadesPorFraccion: PACK,
});

describe("buildProductIndex", () => {
  it("normalizes the name once, stripping accents and case", () => {
    const [entry] = buildProductIndex([
      producto({
        id: "pt-1",
        productoId: "p-1",
        nombre: "  Café   CON  Leché ",
        existencia: 1,
      }),
    ]);
    expect(entry.normalizedName).toBe("cafe con leche");
  });

  it("carries the category id used by the pill filter", () => {
    const [entry] = buildProductIndex([
      producto({
        id: "pt-1",
        productoId: "p-1",
        existencia: 1,
        categoriaId: "bebidas",
      }),
    ]);
    expect(entry.categoriaId).toBe("bebidas");
  });

  it("is the plain existencia for a normal product", () => {
    const [entry] = buildProductIndex([caja, suelto]);
    expect(entry).toMatchObject({
      disponible: 4,
      esFraccion: false,
      existencia: 4,
    });
  });

  it("adds what is inside the unopened packs for a fraction", () => {
    // 3 loose + 4 packs of 10 = 43 sellable right now.
    const [, entry] = buildProductIndex([caja, suelto]);
    expect(entry).toMatchObject({
      disponible: 43,
      esFraccion: true,
      existencia: 3,
    });
  });

  it("counts only the loose units when the parent is out of stock", () => {
    const cajaVacia = producto({
      id: "pt-caja",
      productoId: "caja",
      existencia: 0,
    });
    const [, entry] = buildProductIndex([cajaVacia, suelto]);
    expect(entry.disponible).toBe(3);
  });

  it("counts only the loose units when the parent is not in the list", () => {
    const [entry] = buildProductIndex([suelto]);
    expect(entry.disponible).toBe(3);
  });

  it("clamps a negative existencia to zero", () => {
    const [entry] = buildProductIndex([
      producto({ id: "pt-1", productoId: "p-1", existencia: -5 }),
    ]);
    expect(entry).toMatchObject({ disponible: 0, existencia: 0 });
  });

  it("treats a zero or missing unidadesPorFraccion as a normal product", () => {
    const roto = producto({
      id: "pt-roto",
      productoId: "roto",
      existencia: 2,
      fraccionDeId: "caja",
      unidadesPorFraccion: 0,
    });
    const [, entry] = buildProductIndex([caja, roto]);
    expect(entry).toMatchObject({ disponible: 2, esFraccion: false });
  });

  // The index exists to avoid calling calcularDisponibilidadReal per card per
  // render. It may only do that while both agree on every product.
  it("agrees with calcularDisponibilidadReal across the catalog", () => {
    const cajaVacia = producto({
      id: "pt-caja-vacia",
      productoId: "caja-vacia",
      existencia: 0,
    });
    const huerfano = producto({
      id: "pt-huerfano",
      productoId: "huerfano",
      existencia: 7,
      fraccionDeId: "caja-inexistente",
      unidadesPorFraccion: 5,
    });
    const catalog = [caja, suelto, cajaVacia, huerfano];

    for (const entry of buildProductIndex(catalog)) {
      const reference = calcularDisponibilidadReal(
        entry.productoTienda,
        catalog,
      );
      expect({
        disponible: entry.disponible,
        esFraccion: entry.esFraccion,
      }).toEqual(reference);
    }
  });
});
