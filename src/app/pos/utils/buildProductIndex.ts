import { IProductoTiendaV2 } from "@/schemas/producto";
import { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";
import { normalizeSearch } from "@/utils/formatters";

/**
 * One catalog product, with everything the grid needs already resolved.
 *
 * Every value here used to be recomputed per card on every render: the name
 * normalized three times per keystroke, and `calcularDisponibilidadReal`
 * called twice per card — each one scanning the whole catalog to find a
 * fraction's parent, which made painting the grid quadratic.
 */
export interface PosProductEntry {
  productoTienda: IProductoTiendaV2;
  /** `normalizeSearch(nombre)`, computed once per catalog load. */
  normalizedName: string;
  categoriaId: string;
  /** Units sellable right now, parents included. Cart quantity NOT deducted. */
  disponible: number;
  esFraccion: boolean;
  existencia: number;
}

/**
 * Precomputes the per-product values the POS grid reads on every render.
 *
 * Mirrors the rules of `calcularDisponibilidadReal` — which stays as the
 * single-product entry point used by the quantity dialog and the cart — but
 * resolves a fraction's parent through a map instead of a linear scan, so the
 * whole catalog costs one pass rather than one per fractioned product.
 */
export function buildProductIndex(
  products: IProductoTiendaV2[],
): PosProductEntry[] {
  const existenciaByProductoId = new Map<string, number>();
  for (const p of products) {
    if (p?.productoId) {
      existenciaByProductoId.set(p.productoId, Math.max(0, p.existencia || 0));
    }
  }

  return products.map((productoTienda) => {
    const existencia = Math.max(0, productoTienda.existencia || 0);
    const producto = productoTienda.producto;
    const fraccionDeId = producto?.fraccionDeId;
    const unidadesPorFraccion = producto?.unidadesPorFraccion;
    const esFraccion = Boolean(
      fraccionDeId && unidadesPorFraccion && unidadesPorFraccion > 0,
    );

    // A fraction can also be sold out of unopened parent packs: the sale
    // breaks as many as it needs, so those units really are available.
    const existenciaPadre = esFraccion
      ? (existenciaByProductoId.get(fraccionDeId) ?? 0)
      : 0;

    return {
      productoTienda,
      normalizedName: normalizeSearch(producto?.nombre ?? ""),
      categoriaId: producto?.categoria?.id ?? "",
      disponible: esFraccion
        ? existencia + existenciaPadre * unidadesPorFraccion
        : existencia,
      esFraccion,
      existencia,
    };
  });
}

/** A catalog entry with its price already expressed in the base currency. */
export interface PosProductCard extends PosProductEntry {
  priceBase: number;
}

/**
 * Adds the base-currency price to every entry.
 *
 * Separate from `buildProductIndex` because the two change on different
 * clocks: the catalog is reloaded when stock moves, while the rates can be
 * refreshed without a single product having changed.
 */
export function withBasePrices(
  entries: PosProductEntry[],
  tasasVigentes: ITasaSnapshot,
  monedaBase: string,
): PosProductCard[] {
  return entries.map((entry) => ({
    ...entry,
    priceBase: convertToBase(
      entry.productoTienda.precio,
      entry.productoTienda.monedaPrecioCode ?? monedaBase,
      tasasVigentes,
      monedaBase,
    ),
  }));
}
