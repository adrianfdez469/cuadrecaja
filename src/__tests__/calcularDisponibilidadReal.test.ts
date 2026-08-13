import { describe, it, expect } from "vitest";
import { calcularDisponibilidadReal } from "@/app/pos/utils/calcularDisponibilidadReal";
import type { IProductoTiendaV2 } from "@/schemas/producto";

const PACK = 10;

/** Only the fields the calculation reads; the schema is far wider. */
function producto({
  id,
  productoId,
  existencia,
  fraccionDeId = null,
  unidadesPorFraccion = null,
}: {
  id: string;
  productoId: string;
  existencia: number;
  fraccionDeId?: string | null;
  unidadesPorFraccion?: number | null;
}): IProductoTiendaV2 {
  return {
    id,
    productoId,
    existencia,
    producto: { fraccionDeId, unidadesPorFraccion },
  } as unknown as IProductoTiendaV2;
}

const caja = producto({ id: "pt-caja", productoId: "caja", existencia: 4 });
const suelto = producto({
  id: "pt-suelto",
  productoId: "suelto",
  existencia: 3,
  fraccionDeId: "caja",
  unidadesPorFraccion: PACK,
});

describe("calcularDisponibilidadReal", () => {
  it("is the plain existencia for a normal product", () => {
    expect(calcularDisponibilidadReal(caja, [caja, suelto])).toEqual({
      disponible: 4,
      esFraccion: false,
    });
  });

  it("adds what is inside the unopened packs for a fraction", () => {
    // 3 loose + 4 packs of 10 = 43 sellable right now.
    expect(calcularDisponibilidadReal(suelto, [caja, suelto])).toEqual({
      disponible: 43,
      esFraccion: true,
    });
  });

  it("no longer caps a fraction at one pack per sale", () => {
    // The old rule returned unidadesPorFraccion - 1 (9) no matter the stock.
    const { disponible } = calcularDisponibilidadReal(suelto, [caja, suelto]);
    expect(disponible).toBeGreaterThan(PACK - 1);
  });

  it("counts only the loose units when the parent is out of stock", () => {
    const cajaVacia = producto({
      id: "pt-caja",
      productoId: "caja",
      existencia: 0,
    });
    expect(calcularDisponibilidadReal(suelto, [cajaVacia, suelto])).toEqual({
      disponible: 3,
      esFraccion: true,
    });
  });

  it("counts only the loose units when the parent is not in the list", () => {
    expect(calcularDisponibilidadReal(suelto, [suelto])).toEqual({
      disponible: 3,
      esFraccion: true,
    });
  });

  it("falls back to the loose units when there is no product list at all", () => {
    expect(calcularDisponibilidadReal(suelto, [])).toEqual({
      disponible: 3,
      esFraccion: true,
    });
  });

  it("never reports a negative availability", () => {
    const negativo = producto({
      id: "pt-x",
      productoId: "x",
      existencia: -5,
    });
    expect(calcularDisponibilidadReal(negativo, [negativo]).disponible).toBe(0);
  });

  it("is zero for a missing product", () => {
    expect(calcularDisponibilidadReal(null, [])).toEqual({
      disponible: 0,
      esFraccion: false,
    });
  });

  it("treats a fraction with no pack size as a normal product", () => {
    const roto = producto({
      id: "pt-roto",
      productoId: "roto",
      existencia: 7,
      fraccionDeId: "caja",
      unidadesPorFraccion: 0,
    });
    expect(calcularDisponibilidadReal(roto, [caja, roto])).toEqual({
      disponible: 7,
      esFraccion: false,
    });
  });
});
