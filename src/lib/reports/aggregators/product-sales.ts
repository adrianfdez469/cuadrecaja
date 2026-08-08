import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

/** Per-product totals for a range, in base currency. */
export type ProductSalesRow = {
  storeProductId: string;
  productId: string | null;
  nombre: string;
  categoryId: string | null;
  categoryName: string;
  isConsignment: boolean;
  unidades: number;
  ventasBrutas: number;
  ventasNetas: number;
  ganancia: number;
  costo: number;
  descuento: number;
};

export type ProductSalesResult = {
  rows: ProductSalesRow[];
  byStoreProductId: Map<string, ProductSalesRow>;
};

/**
 * Aggregates sales by store product. Feeds the dashboard rankings and every
 * inventory report (turnover, dead stock, ABC), so they all share one pass.
 */
export function createProductSalesAggregator(): SalesAggregator<ProductSalesResult> {
  const byStoreProductId = new Map<string, ProductSalesRow>();

  return {
    consume(sale: NormalizedSale) {
      for (const line of sale.lines) {
        let row = byStoreProductId.get(line.storeProductId);

        if (!row) {
          row = {
            storeProductId: line.storeProductId,
            productId: line.dimension?.productId ?? null,
            nombre: line.dimension?.displayName ?? "Producto desconocido",
            categoryId: line.dimension?.categoryId ?? null,
            categoryName: line.dimension?.categoryName ?? "Sin categoría",
            isConsignment: line.dimension?.isConsignment ?? false,
            unidades: 0,
            ventasBrutas: 0,
            ventasNetas: 0,
            ganancia: 0,
            costo: 0,
            descuento: 0,
          };
          byStoreProductId.set(line.storeProductId, row);
        }

        row.unidades += line.quantity;
        row.ventasBrutas += line.grossAmount;
        row.ventasNetas += line.netAmount;
        row.ganancia += line.netProfit;
        row.costo += line.costAmount;
        row.descuento += line.discountAmount;
      }
    },
    finalize() {
      return { rows: Array.from(byStoreProductId.values()), byStoreProductId };
    },
  };
}

/** Profit as a percentage of net sales — 0 when the product sold nothing. */
export function rentabilidadPorcentual(row: ProductSalesRow): number {
  if (row.ventasNetas <= 0) return 0;
  return (row.ganancia / row.ventasNetas) * 100;
}
