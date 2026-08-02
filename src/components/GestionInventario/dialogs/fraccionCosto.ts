import type { IProductoTiendaV2 } from "@/schemas/producto";

/**
 * Cost of a fractioned product is derived from the base product's cost in
 * this tienda, split across the units per fraction — e.g. loose cigarettes
 * priced from the cost of the pack they come from.
 */
export function calcularCostoFraccion(
  productoBaseId: string,
  unidadesPorFraccion: number,
  productosTienda: IProductoTiendaV2[],
): { costo: string; monedaCostoCode: string | null } | null {
  const baseTienda = productosTienda.find(
    (pt) => pt.productoId === productoBaseId,
  );
  if (!baseTienda || unidadesPorFraccion <= 0) return null;

  const costoCalculado = baseTienda.costo / unidadesPorFraccion;
  return {
    costo: String(Math.round(costoCalculado * 100) / 100),
    monedaCostoCode: baseTienda.monedaCostoCode ?? null,
  };
}
